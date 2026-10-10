import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { Document } from '../../models/document.model';
import {
  documentDate, documentExtension, documentKindInfo, documentSurface, documentTitle, formatBytes, opensInEditor,
} from '../../models/document-kind';
import { DocService } from '../../services/doc.service';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { DocumentsStoreService } from '../../services/documents-store.service';
import { LoggerService } from '../../services/logger.service';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';
import { WriteActionDirective } from '../../shared/write-access/write-action.directive';

const PLATFORM_LABELS: Record<string, string> = {
  google: 'Google', google_business_profile: 'Google', youtube: 'YouTube', facebook: 'Facebook', instagram: 'Instagram',
  reddit: 'Reddit', bluesky: 'Bluesky', threads: 'Threads', linkedin: 'LinkedIn',
};

/** A YouTube, Vimeo or TikTok link as an embeddable player URL (never autoplays). */
export function videoEmbedUrl ( url: string | null | undefined ): string | null {
  const value = String( url || '' );
  const youtube = value.match( /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/ );
  if ( youtube ) return `https://www.youtube.com/embed/${ youtube[1] }`;
  const vimeo = value.match( /vimeo\.com\/(?:video\/)?(\d+)/ );
  if ( vimeo ) return `https://player.vimeo.com/video/${ vimeo[1] }`;
  const tiktok = value.match( /tiktok\.com\/.*\/video\/(\d+)/ );
  if ( tiktok ) return `https://www.tiktok.com/embed/v2/${ tiktok[1] }`;
  return null;
}

/**
 * One document (design_handoff_todd_docs 2e/2f/2g). The result nav steps
 * through the list the Documents grid opened it from. The left column
 * previews by kind: a PDF page, the image, or a player that never
 * autoplays; anything else gets a tinted type plate. The right column has
 * the actions, metadata, TODD's summary and what it's connected to.
 * Editing title/topic/description/social eligibility and deleting moved
 * here from the old vault carousel.
 */
@Component( {
  selector: 'app-document-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DkIconComponent, WriteActionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document-detail.component.html',
  styleUrl: './document-detail.component.css',
} )
export class DocumentDetailComponent implements OnInit {
  private readonly route = inject( ActivatedRoute );
  private readonly router = inject( Router );
  private readonly store = inject( DocumentsStoreService );
  private readonly docService = inject( DocService );
  private readonly notifications = inject( DocsNotificationService );
  private readonly logger = inject( LoggerService );
  private readonly sanitizer = inject( DomSanitizer );
  private readonly destroyRef = inject( DestroyRef );
  private readonly isBrowser = isPlatformBrowser( inject( PLATFORM_ID ) );

  readonly id = signal( '' );
  readonly fetched = signal<Document | null>( null );
  readonly notFound = signal( false );
  readonly moreOpen = signal( false );
  readonly editing = signal( false );
  readonly saving = signal( false );
  readonly playing = signal( false );
  editForm = { title: '', topic: '', description: '', eligibleForSocial: false };

  readonly doc = computed<Document | null>( () => this.store.byId( this.id() ) || this.fetched() );
  readonly info = computed( () => documentKindInfo( this.doc() ) );
  readonly surface = computed( () => documentSurface( this.doc() ) );
  readonly extension = computed( () => documentExtension( this.doc() ) );
  readonly title = computed( () => documentTitle( this.doc() ) );
  readonly canEdit = computed( () => !!this.store.tenantId() );

  /** "PDF · Proposal", "Image · Media", "Video · Media". */
  readonly subtitle = computed( () => {
    const surface = this.surface();
    const first = surface === 'image' ? 'Image' : surface === 'video' ? 'Video' : this.extension();
    return `${ first } · ${ this.info().label }`;
  } );

  readonly metadata = computed( () => {
    const doc = this.doc();
    if ( !doc ) return [];
    const date = documentDate( doc );
    const file = [doc.name, formatBytes( doc.sizeBytes )].filter( Boolean ).join( ' · ' );
    return [
      { label: 'Topic', value: doc.topic || '' },
      { label: 'Author', value: doc.author || '' },
      { label: 'Updated', value: date ? date.toLocaleDateString( 'en-US', { month: 'short', day: 'numeric', year: 'numeric' } ) : '' },
      { label: 'Status', value: doc.status || '' },
      { label: 'Folder', value: this.info().plural },
      { label: 'File', value: file },
    ].filter( ( row ) => row.value );
  } );

  readonly summary = computed( () => String( this.doc()?.summary || this.doc()?.description || '' ) );

  readonly postedLabel = computed( () => {
    const doc = this.doc();
    if ( !doc?.lastPostedAt ) return '';
    const platforms = doc.lastPostedPlatforms || [];
    const where = platforms.length > 1 ? `${ platforms.length } platforms` : PLATFORM_LABELS[platforms[0]] || platforms[0] || 'social';
    const date = new Date( doc.lastPostedAt );
    return isNaN( date.getTime() ) ? `Posted to ${ where }` : `Posted to ${ where } · ${ date.toLocaleDateString( 'en-US', { month: 'short', day: 'numeric' } ) }`;
  } );

  /** Links this record actually carries (RFP for a proposal, contact). */
  readonly connections = computed( () => {
    const doc = this.doc() as ( Document & { rfpId?: string } ) | null;
    const rows: { label: string; tint: string; route: string }[] = [];
    if ( doc?.rfpId ) {
      const rfp = this.store.byId( doc.rfpId );
      rows.push( { label: `RFP: ${ rfp ? documentTitle( rfp ) : 'source RFP' }`, tint: 'violet', route: `/documents/${ doc.rfpId }` } );
    }
    if ( doc?.contactId ) rows.push( { label: 'Contact', tint: 'pink', route: '' } );
    return rows;
  } );

  readonly safeSrc = computed<SafeResourceUrl | null>( () => {
    const src = this.doc()?.src;
    return src ? this.sanitizer.bypassSecurityTrustResourceUrl( src ) : null;
  } );

  readonly embedUrl = computed<SafeResourceUrl | null>( () => {
    const url = videoEmbedUrl( this.doc()?.src );
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl( url ) : null;
  } );

  // ── Result nav ─────────────────────────────────────────────────
  readonly resultSet = this.store.resultSet;
  readonly position = computed( () => this.resultSet()?.ids.indexOf( this.id() ) ?? -1 );
  readonly total = computed( () => this.resultSet()?.ids.length || 0 );
  readonly backLabel = computed( () => this.resultSet()?.label || 'Documents' );

  ngOnInit (): void {
    this.route.paramMap.pipe( takeUntilDestroyed( this.destroyRef ) ).subscribe( ( params ) => {
      this.id.set( String( params.get( 'id' ) || '' ) );
      this.editing.set( false );
      this.playing.set( false );
      this.moreOpen.set( false );
      this.notFound.set( false );
      this.fetched.set( null );
      this.loadIfMissing();
    } );
  }

  private loadIfMissing (): void {
    this.store.load().pipe( takeUntilDestroyed( this.destroyRef ) ).subscribe( () => {
      if ( this.store.byId( this.id() ) ) return;
      // A direct link to a document outside the list (or a guest sample).
      this.docService.getDocument( this.id() ).subscribe( {
        next: ( doc ) => doc?.id ? this.fetched.set( doc as Document ) : this.notFound.set( true ),
        error: () => this.notFound.set( true ),
      } );
    } );
  }

  back (): void {
    const set = this.resultSet();
    void this.router.navigate( [set?.returnUrl || '/documents'], { queryParams: set?.returnQuery || {} } );
  }

  step ( delta: number ): void {
    const set = this.resultSet();
    const index = this.position();
    if ( !set || index < 0 ) return;
    const next = set.ids[index + delta];
    if ( next ) void this.router.navigate( ['/documents', next], { replaceUrl: true } );
  }

  @HostListener( 'document:keydown', ['$event'] )
  onKeydown ( event: KeyboardEvent ): void {
    const target = event.target as HTMLElement | null;
    if ( this.editing() || target?.closest( 'input, textarea, select, [contenteditable]' ) ) return;
    if ( event.key === 'ArrowLeft' ) this.step( -1 );
    if ( event.key === 'ArrowRight' ) this.step( 1 );
    if ( event.key === 'Escape' ) this.moreOpen.set( false );
  }

  // ── Actions ────────────────────────────────────────────────────
  open (): void {
    const doc = this.doc();
    if ( !doc ) return;
    if ( opensInEditor( doc ) ) {
      void this.router.navigate( ['/docs/editor', doc.id] );
      return;
    }
    if ( this.surface() === 'video' ) {
      this.playing.set( true );
      return;
    }
    if ( doc.src && this.isBrowser ) window.open( doc.src, '_blank', 'noopener' );
  }

  async share (): Promise<void> {
    if ( !this.isBrowser ) return;
    const url = `${ window.location.origin }/documents/${ this.id() }`;
    try {
      if ( navigator.share ) {
        await navigator.share( { title: this.title(), url } );
        return;
      }
      await navigator.clipboard.writeText( url );
      this.notifications.show( 'Link copied', 'Anyone in your workspace can open it.', 'success' );
    } catch { /* share sheet dismissed */ }
  }

  /** "Post": lets Maya pick this image or video for a social post. */
  sendToMaya (): void {
    const doc = this.doc();
    if ( !doc?.id || !this.canEdit() ) return;
    this.save( { eligibleForSocial: true }, 'Sent to Maya', 'Maya can pick this for a post.' );
  }

  startEdit (): void {
    const doc = this.doc();
    if ( !doc ) return;
    this.moreOpen.set( false );
    this.editForm = { title: doc.title || '', topic: doc.topic || '', description: doc.description || '', eligibleForSocial: doc.eligibleForSocial === true };
    this.editing.set( true );
  }

  saveEdit (): void {
    this.save( { ...this.editForm }, 'Document updated', 'Your changes were saved.' );
  }

  private save ( payload: Partial<Document>, title: string, message: string ): void {
    const doc = this.doc();
    if ( !doc?.id ) return;
    this.saving.set( true );
    this.docService.updateDocument( doc.id, payload, this.store.tenantId() ).subscribe( {
      next: ( updated ) => {
        this.saving.set( false );
        this.editing.set( false );
        const merged = { ...doc, ...payload, ...( updated || {} ) } as Document;
        this.store.replace( merged );
        if ( this.fetched() ) this.fetched.set( merged );
        this.notifications.show( title, message, 'success' );
      },
      error: ( error ) => {
        this.saving.set( false );
        this.logger.error( 'Error updating document:', error );
        this.notifications.show( 'Update failed', 'TODD could not save your changes. Please try again.', 'warning' );
      },
    } );
  }

  download (): void {
    const src = this.doc()?.src;
    this.moreOpen.set( false );
    if ( src && this.isBrowser ) window.open( src, '_blank', 'noopener' );
  }

  remove (): void {
    const doc = this.doc();
    this.moreOpen.set( false );
    if ( !doc?.id || !this.isBrowser ) return;
    if ( !window.confirm( `Delete “${ this.title() }”? This can't be undone.` ) ) return;
    const set = this.resultSet();
    const index = this.position();
    this.docService.removeDocument( doc.id, this.store.tenantId() ).subscribe( {
      next: () => {
        this.store.remove( doc.id );
        this.notifications.show( 'Document deleted', `“${ this.title() }” was removed.`, 'success' );
        const next = set?.ids.filter( ( id ) => id !== String( doc.id ) )[Math.max( 0, index )];
        if ( next ) void this.router.navigate( ['/documents', next], { replaceUrl: true } );
        else this.back();
      },
      error: ( error ) => {
        this.logger.error( 'Error deleting document:', error );
        this.notifications.show( 'Delete failed', 'TODD could not delete this document. Please try again.', 'warning' );
      },
    } );
  }
}
