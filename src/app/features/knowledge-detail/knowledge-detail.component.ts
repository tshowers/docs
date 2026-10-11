import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { KnowledgeAnswer, KnowledgeItem, domainOf, isStale, normalizeKnowledge, recommendationTint, shortLink } from '../../models/knowledge';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { DocumentsStoreService } from '../../services/documents-store.service';
import { KnowledgeStoreService } from '../../services/knowledge-store.service';
import { LoggerService } from '../../services/logger.service';
import { ResponseFlowService } from '../../services/response-flow.service';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';
import { WriteActionDirective } from '../../shared/write-access/write-action.directive';

/** The citation Copy citation puts on the clipboard (same format as the old Knowledge Base). */
export function formatCitation ( answer: KnowledgeAnswer, accessed = new Date() ): string {
  const src = answer?.source || '';
  return `${ answer.answer } Source: ${ domainOf( src ) }. ${ src } (accessed ${ accessed.toISOString().slice( 0, 10 ) }).`;
}

/**
 * One Knowledge answer (design_handoff_todd_docs 2d), mapped onto the
 * response-flow record: category and confirmed date as tags, the question,
 * numbered evidence with source chips, recommendations, resources and
 * keywords. Edit opens Response Flow; "Send to Maya for a post" hands the
 * answer to Social like the old card's # button. "Used in N proposals" and
 * which draft prompted the question appear once the editor records them.
 */
@Component( {
  selector: 'app-knowledge-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, DkIconComponent, WriteActionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './knowledge-detail.component.html',
  styleUrl: './knowledge-detail.component.css',
} )
export class KnowledgeDetailComponent implements OnInit {
  private readonly route = inject( ActivatedRoute );
  private readonly router = inject( Router );
  private readonly store = inject( KnowledgeStoreService );
  private readonly docs = inject( DocumentsStoreService );
  private readonly api = inject( ResponseFlowService );
  private readonly notifications = inject( DocsNotificationService );
  private readonly logger = inject( LoggerService );
  private readonly destroyRef = inject( DestroyRef );
  private readonly isBrowser = isPlatformBrowser( inject( PLATFORM_ID ) );

  readonly id = signal( '' );
  readonly fetched = signal<KnowledgeItem | null>( null );
  readonly notFound = signal( false );
  readonly moreOpen = signal( false );

  readonly item = computed( () => this.store.byId( this.id() ) || this.fetched() );
  readonly signedIn = this.store.signedIn;
  readonly stale = computed( () => !!this.item() && isStale( this.item()! ) );

  readonly confirmed = computed( () => {
    const raw = this.item()?.updatedAt || this.item()?.createdAt;
    const date = raw ? new Date( raw ) : null;
    return date && !isNaN( date.getTime() ) ? date : null;
  } );

  readonly added = computed( () => {
    const raw = this.item()?.createdAt;
    const date = raw ? new Date( raw ) : null;
    return date && !isNaN( date.getTime() ) ? date : null;
  } );

  readonly nextCheck = computed( () => {
    const confirmed = this.confirmed();
    return confirmed ? new Date( confirmed.getFullYear() + 1, confirmed.getMonth(), confirmed.getDate() ) : null;
  } );

  /** The proposals that used this answer, as far as Documents knows them. */
  readonly usedIn = computed( () => ( this.item()?.usedInProposals || [] ).map( ( id ) => {
    const doc = this.docs.byId( id );
    const status = String( doc?.status || 'draft' ).toLowerCase();
    const tint = status === 'won' ? 'green' : status === 'lost' ? 'pink' : status === 'submitted' ? 'blue' : 'yellow';
    return { id, title: String( doc?.title || doc?.name || 'Proposal' ).replace( /^Proposal · /, '' ), status: status.charAt( 0 ).toUpperCase() + status.slice( 1 ), tint };
  } ) );

  readonly resultSet = this.store.resultSet;
  readonly position = computed( () => this.resultSet()?.ids.indexOf( this.id() ) ?? -1 );
  readonly total = computed( () => this.resultSet()?.ids.length || 0 );
  readonly backLabel = computed( () => this.resultSet()?.label || 'Knowledge' );

  readonly domainOf = domainOf;
  readonly shortLink = shortLink;
  readonly recommendationTint = recommendationTint;

  ngOnInit (): void {
    this.route.paramMap.pipe( takeUntilDestroyed( this.destroyRef ) ).subscribe( ( params ) => {
      this.id.set( String( params.get( 'id' ) || '' ) );
      this.moreOpen.set( false );
      this.notFound.set( false );
      this.fetched.set( null );
      this.docs.load().pipe( takeUntilDestroyed( this.destroyRef ) ).subscribe();
      this.store.load().pipe( takeUntilDestroyed( this.destroyRef ) ).subscribe( () => {
        if ( this.store.byId( this.id() ) ) return;
        if ( !this.store.signedIn() ) {
          this.notFound.set( true );
          return;
        }
        this.api.getResponseFlow( this.id() ).subscribe( {
          next: ( raw ) => raw?.id ? this.fetched.set( normalizeKnowledge( raw ) ) : this.notFound.set( true ),
          error: () => this.notFound.set( true ),
        } );
      } );
    } );
  }

  back (): void {
    const set = this.resultSet();
    void this.router.navigate( [set?.returnUrl || '/knowledge'], { queryParams: set?.returnQuery || {} } );
  }

  step ( delta: number ): void {
    const set = this.resultSet();
    const next = set?.ids[this.position() + delta];
    if ( set && this.position() >= 0 && next ) void this.router.navigate( ['/knowledge', next], { replaceUrl: true } );
  }

  @HostListener( 'document:keydown', ['$event'] )
  onKeydown ( event: KeyboardEvent ): void {
    if ( ( event.target as HTMLElement | null )?.closest( 'input, textarea, select, [contenteditable]' ) ) return;
    if ( event.key === 'ArrowLeft' ) this.step( -1 );
    if ( event.key === 'ArrowRight' ) this.step( 1 );
    if ( event.key === 'Escape' ) this.moreOpen.set( false );
  }

  edit (): void {
    void this.router.navigate( ['/knowledge/response-flow'], { queryParams: { id: this.id() } } );
  }

  sendToMaya (): void {
    const item = this.item();
    if ( !item?.id || !this.isBrowser ) return;
    const params = new URLSearchParams( { sourceType: 'response-flow', sourceId: item.id, title: item.question || '' } );
    window.location.href = `https://todd.taliferro.tech/outreach/social?${ params.toString() }`;
  }

  async copyCitation ( answer: KnowledgeAnswer ): Promise<void> {
    try {
      await navigator.clipboard.writeText( formatCitation( answer ) );
      this.notifications.show( 'Copied', 'Citation copied to clipboard.', 'success' );
    } catch {
      this.notifications.show( 'Copy failed', 'Could not copy the citation.', 'warning' );
    }
  }

  remove (): void {
    const item = this.item();
    this.moreOpen.set( false );
    if ( !item?.id || !this.isBrowser ) return;
    if ( !window.confirm( `Delete “${ item.question }”? TODD will ask again the next time a proposal needs it.` ) ) return;
    const set = this.resultSet();
    const index = this.position();
    this.api.removeResponseFlow( item.id ).subscribe( {
      next: () => {
        this.store.remove( item.id );
        this.notifications.show( 'Answer deleted', 'It was removed from Knowledge.', 'success' );
        const next = set?.ids.filter( ( id ) => id !== item.id )[Math.max( 0, index )];
        if ( next ) void this.router.navigate( ['/knowledge', next], { replaceUrl: true } );
        else this.back();
      },
      error: ( error ) => {
        this.logger.error( 'Error deleting knowledge item:', error );
        this.notifications.show( 'Delete failed', 'TODD could not delete this answer. Please try again.', 'warning' );
      },
    } );
  }

  initial ( url: string ): string {
    return ( domainOf( url ).charAt( 0 ) || '?' ).toUpperCase();
  }
}
