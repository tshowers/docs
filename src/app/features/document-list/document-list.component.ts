import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { Document } from '../../models/document.model';
import {
  DOCUMENT_KINDS, DocumentKind, documentExtension, documentKind, documentKindInfo, documentMatches, documentSurface, documentTitle, parseDay, shortDocumentDate,
} from '../../models/document-kind';
import { PageAction } from '../../models/page-actions.models';
import { DocsAuthService } from '../../services/docs-auth.service';
import { DocsPageActionsService } from '../../services/docs-page-actions.service';
import { DocumentsStoreService } from '../../services/documents-store.service';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';
import { HighlightPart, highlightParts } from '../../shared/highlight';
import { WriteActionDirective } from '../../shared/write-access/write-action.directive';

interface DocumentCard {
  doc: Document;
  id: string;
  kind: DocumentKind;
  kindLabel: string;
  folder: string;
  tint: string;
  extension: string;
  surface: 'image' | 'video' | 'pdf' | 'file';
  title: HighlightPart[];
  summary: string;
  date: string;
  flag: string;
}

/**
 * Documents (design_handoff_todd_docs 1h): Find's All grid. A search pill
 * with Add files, filter pills by kind with counts, "N found for {q}", and
 * a 4-column grid of cards (image, video tile or tinted type plate on top).
 * A card opens the single-document view at /documents/:id, which steps
 * through this same result set. Replaces the carousel/desk/pins vault.
 */
@Component( {
  selector: 'app-document-list',
  standalone: true,
  imports: [CommonModule, RouterModule, DkIconComponent, WriteActionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document-list.component.html',
  styleUrl: './document-list.component.css'
} )
export class DocumentListComponent implements OnInit, OnDestroy {
  private readonly route = inject( ActivatedRoute );
  private readonly router = inject( Router );
  private readonly store = inject( DocumentsStoreService );
  private readonly auth = inject( DocsAuthService );
  private readonly pageActions = inject( DocsPageActionsService );
  private readonly destroyRef = inject( DestroyRef );
  private readonly isBrowser = isPlatformBrowser( inject( PLATFORM_ID ) );

  readonly query = signal( '' );
  readonly kind = signal<DocumentKind | 'all'>( 'all' );
  readonly loading = computed( () => !this.store.loaded() );
  readonly signedIn = signal( false );
  readonly isEmbedded = this.route.snapshot.queryParamMap.get( 'embedded' ) === 'true';

  /** Everything matching the search, before the kind filter (the pill counts). */
  private readonly matching = computed( () => this.store.documents().filter( ( doc ) => documentMatches( doc, this.query() ) ) );

  readonly filters = computed( () => {
    const docs = this.matching();
    const counts = new Map<DocumentKind, number>();
    docs.forEach( ( doc ) => counts.set( documentKind( doc ), ( counts.get( documentKind( doc ) ) || 0 ) + 1 ) );
    return [
      { kind: 'all' as const, label: 'All', count: docs.length },
      ...DOCUMENT_KINDS.filter( ( info ) => counts.get( info.kind ) ).map( ( info ) => ( { kind: info.kind, label: info.plural, count: counts.get( info.kind ) || 0 } ) ),
    ];
  } );

  readonly visible = computed( () => {
    const kind = this.kind();
    return kind === 'all' ? this.matching() : this.matching().filter( ( doc ) => documentKind( doc ) === kind );
  } );

  readonly cards = computed<DocumentCard[]>( () => this.visible().map( ( doc ) => this.toCard( doc ) ) );

  /** "8 found for king county" / "12 documents". */
  readonly countLabel = computed( () => {
    const n = this.visible().length;
    const q = this.query().trim();
    return q ? `${ n } found` : `${ n } ${ n === 1 ? 'document' : 'documents' }`;
  } );

  ngOnInit (): void {
    this.auth.isLoggedIn().pipe( takeUntilDestroyed( this.destroyRef ) ).subscribe( ( value ) => this.signedIn.set( !!value ) );
    this.route.queryParamMap.pipe( takeUntilDestroyed( this.destroyRef ) ).subscribe( ( params ) => {
      // Old links (?focus=id from the assistant, Find and notifications) open the document.
      const focus = String( params.get( 'focus' ) || '' ).trim();
      if ( focus ) {
        void this.router.navigate( ['/documents', focus], { replaceUrl: true } );
        return;
      }
      this.query.set( params.get( 'q' ) || '' );
      const kind = params.get( 'kind' ) as DocumentKind | null;
      this.kind.set( kind && DOCUMENT_KINDS.some( ( info ) => info.kind === kind ) ? kind : 'all' );
    } );
    this.store.load().pipe( takeUntilDestroyed( this.destroyRef ) ).subscribe( () => this.restoreScroll() );
    this.publishPageActions();
  }

  ngOnDestroy (): void {
    this.pageActions.clearPageActions( 'document-list' );
  }

  onSearch ( value: string ): void {
    this.query.set( value );
    this.syncUrl();
  }

  setKind ( kind: DocumentKind | 'all' ): void {
    this.kind.set( kind );
    this.syncUrl();
  }

  /** Remembers this result set so the single view can show "i of n" and come back here. */
  open ( card: DocumentCard ): void {
    const q = this.query().trim();
    const kindInfo = DOCUMENT_KINDS.find( ( info ) => info.kind === this.kind() );
    const n = this.visible().length;
    const label = q ? `${ n } found for ${ q }` : kindInfo ? `${ n } ${ kindInfo.plural }` : `${ n } documents`;
    this.store.resultSet.set( {
      ids: this.visible().map( ( doc ) => String( doc.id ) ),
      label,
      returnUrl: '/documents',
      returnQuery: this.currentQueryParams(),
      scrollY: this.isBrowser ? window.scrollY : 0,
    } );
    void this.router.navigate( ['/documents', card.id] );
  }

  trackCard ( _index: number, card: DocumentCard ): string {
    return card.id;
  }

  private toCard ( doc: Document ): DocumentCard {
    const info = documentKindInfo( doc );
    return {
      doc,
      id: String( doc.id ),
      kind: info.kind,
      kindLabel: info.label,
      folder: info.plural,
      tint: info.tint,
      extension: documentExtension( doc ),
      surface: documentSurface( doc ),
      title: highlightParts( documentTitle( doc ), this.query() ),
      summary: String( doc.summary || doc.description || doc.topic || '' ),
      date: shortDocumentDate( doc ),
      flag: this.flagFor( doc, info.kind ),
    };
  }

  /** The yellow flag: an RFP's due date or a compliance file's expiry, when it's ahead. */
  private flagFor ( doc: Document, kind: DocumentKind ): string {
    if ( !doc.dueDate ) return '';
    const date = parseDay( doc.dueDate );
    if ( !date || date.getTime() < Date.now() ) return '';
    const label = date.toLocaleDateString( 'en-US', { month: 'short', day: 'numeric' } );
    return kind === 'compliance' ? `Expires ${ label }` : `Due ${ label }`;
  }

  private currentQueryParams (): Record<string, string> {
    const params: Record<string, string> = {};
    if ( this.query().trim() ) params['q'] = this.query().trim();
    if ( this.kind() !== 'all' ) params['kind'] = this.kind();
    return params;
  }

  private syncUrl (): void {
    void this.router.navigate( [], { relativeTo: this.route, queryParams: { q: this.query() || null, kind: this.kind() === 'all' ? null : this.kind() }, queryParamsHandling: 'merge', replaceUrl: true } );
  }

  /** Back from a document returns to the same scroll position. */
  private restoreScroll (): void {
    const set = this.store.resultSet();
    if ( !this.isBrowser || !set || set.returnUrl !== '/documents' ) return;
    this.store.resultSet.set( null );
    setTimeout( () => window.scrollTo( 0, set.scrollY ), 0 );
  }

  private publishPageActions (): void {
    const actions: PageAction[] = [
      { id: 'document-list-add', label: 'Add files', icon: 'fa-solid fa-plus', kind: 'route', route: '/upload', order: 10, group: 'context' },
      { id: 'document-list-editor', label: 'New document', icon: 'fa-solid fa-file-lines', kind: 'route', route: '/new', order: 20, group: 'context' },
      { id: 'document-list-opportunities', label: 'Opportunities', icon: 'fa-solid fa-inbox', kind: 'route', route: '/opportunities', order: 30, group: 'context' },
      { id: 'document-list-knowledge', label: 'Knowledge', icon: 'fa-solid fa-book', kind: 'route', route: '/knowledge', order: 40, group: 'context' },
    ];
    this.pageActions.setPageActions( {
      pageId: 'document-list',
      context: { pageId: 'document-list', feature: 'documents', entityType: 'document' },
      actions,
    } );
  }
}
