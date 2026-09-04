import { CdkDragEnd, CdkDragMove, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, Output, PLATFORM_ID, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { AlertService } from '../../services/alert.service';
import { DocsAuthService } from '../../services/docs-auth.service';
import { LoggerService } from '../../services/logger.service';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { DocsPageActionsService } from '../../services/docs-page-actions.service';
import { SoundService } from '../../services/sound.service';
import { DocsTipService } from '../../services/docs-tip.service';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { ToddTipComponent } from '../../shared/todd-tip/todd-tip.component';
import { SafeVideoUrlPipe } from '../../shared/pipes/safe-video-url-pipe';
import { ClickSoundDirective } from '../../shared/directives/click-sound.directive';
import { PageAction } from '../../models/page-actions.models';
import { Document } from '../../models/document.model';
import { DocService } from '../../services/doc.service';
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';

declare var bootstrap: any;

type DocumentViewMode = 'carousel' | 'desk' | 'pins';
type DeskLightboxKind = 'image' | 'pdf' | null;

interface DeskLayoutItem {
  x: number;
  y: number;
  rotation: number;
  zIndex: number;
  updatedAt?: number;
}

interface DeskCanvasMetrics {
  width: number;
  height: number;
  paddingX: number;
  paddingY: number;
}

/**
 * Ported from features/document/document-list/document-list.component.ts
 * (route was `documents`, now `/docs/documents`) - the vault view with its
 * carousel/desk/pins view modes, drag-drop desk layout (@angular/cdk added
 * as a new dependency for this port - the only component that needs it),
 * and inline editing. Logic is otherwise unchanged; only route targets
 * were rewritten (`/document` -> `/docs/upload`, `/document-editor` ->
 * `/docs/editor`) and services swapped for this app's equivalents.
 */
@Component( {
  selector: 'app-document-list',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule, DragDropModule, BackToTopComponent, SafeVideoUrlPipe, ToddTipComponent, PreloaderComponent, ClickSoundDirective, CockpitBrowseModeBannerComponent],
  templateUrl: './document-list.component.html',
  styleUrl: './document-list.component.css'
} )
export class DocumentListComponent implements AfterViewInit, OnDestroy {
  @ViewChild( 'heroVideo', { static: false } ) heroVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild( 'deskCanvas', { static: false } ) deskCanvasRef?: ElementRef<HTMLDivElement>;
  @ViewChild( 'deskFocusTarget', { static: false } ) deskFocusTargetRef?: ElementRef<HTMLDivElement>;

  @Output() itemSelected = new EventEmitter<Document>();
  @Output() loader = new EventEmitter<boolean>();
  @Input() userId!: string;

  private heroVideoKickAttempts = 0;
  private readonly platformId = inject( PLATFORM_ID );
  private readonly isBrowser = isPlatformBrowser( this.platformId );
  private readonly isMobileDevice = this.detectMobileDevice();
  private dragOffsets: Record<string, { x: number; y: number; }> = {};
  private readonly defaultCanvasWidth = 960;
  private readonly defaultCanvasHeight = 740;
  private readonly deskViewBreakpoint = 992;

  showVideo = false;
  documents: Document[] = [];
  searchTerm = '';
  activeIndex = 0;
  selectedDocument: Document | null = null;
  documentSummary = '';
  documentKeywords: string[] = [];
  pageSize = 100;
  showDocumentListOnMobile = true;
  isSmallScreen = this.isBrowser ? window.innerWidth < 992 : true;
  isMobile = this.isBrowser ? window.innerWidth < 768 : true;
  lightboxVideoUrl: string | null = null;
  docTipText = '';
  isLoading = false;
  isEmbedded = false;
  tenantId!: string;
  lightboxVideoMode: 'embed' | 'file' | null = null;
  viewMode: DocumentViewMode = 'carousel';
  deskLayout: Record<string, DeskLayoutItem> = {};
  draggingDocumentId: string | null = null;
  activeDeskDocumentId: string | null = null;
  interactingDeskDocumentId: string | null = null;
  deskLightboxDocument: Document | null = null;
  deskLightboxKind: DeskLightboxKind = null;
  deskLightboxUrl: string | null = null;
  deskFocusEligible = false;
  deskFocusHover = false;
  maxDeskZIndex = 10;
  private focusedDocumentId = '';

  constructor (
    private authService: DocsAuthService,
    private logger: LoggerService,
    private alertService: AlertService,
    private route: ActivatedRoute,
    private router: Router,
    private documentService: DocService,
    private tipService: DocsTipService,
    private soundService: SoundService,
    private pageActionsService: DocsPageActionsService,
    private notificationService: DocsNotificationService
  ) { }

  ngOnInit (): void {
    this.isEmbedded = this.route.snapshot.queryParamMap.get( 'embedded' ) === 'true';
    this.alertService.closeAlertAfterTimeout( 'autoCloseAlert', 10000 );
    this.docTipText = this.tipService.getRandomTipText( 'documents' );
    this.publishPageActions();
    this.restoreDeskViewMode();
    this.route.queryParamMap.subscribe( params => {
      this.focusedDocumentId = String( params.get( 'focus' ) || '' ).trim();
      if ( this.focusedDocumentId ) {
        this.setActiveDocumentById( this.focusedDocumentId );
      }
    } );
    this.setupPage();
  }

  ngAfterViewInit (): void {
    setTimeout( () => {
      this.showVideo = this.isBrowser && !this.isMobileDevice;

      if ( this.showVideo ) {
        setTimeout( () => this.kickHeroVideo(), 0 );
      }
    }, 300 );

    if ( this.isBrowser ) {
      try {
        document.addEventListener( 'visibilitychange', () => {
          if ( !document.hidden && this.showVideo ) this.kickHeroVideo();
        } );
      } catch { }
      window.scrollTo( 0, 0 );
      this.syncDeskLayoutToViewport();
    }
  }

  ngOnDestroy (): void {
    this.pageActionsService.clearPageActions( 'document-list' );
  }

  private detectMobileDevice (): boolean {
    if ( !this.isBrowser ) return false;

    try {
      const userAgent = window.navigator.userAgent || '';
      const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test( userAgent );
      const smallScreen = window.innerWidth <= 768;
      const touchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      return mobileUserAgent || ( smallScreen && touchDevice );
    } catch {
      return false;
    }
  }

  private kickHeroVideo (): void {
    const el = this.heroVideoRef?.nativeElement;
    if ( !el ) return;

    el.muted = true;

    const attemptPlay = () => {
      try {
        const p = el.play();
        if ( p && typeof ( p as any ).catch === 'function' ) {
          ( p as Promise<void> ).catch( () => {
            if ( this.heroVideoKickAttempts < 6 ) {
              this.heroVideoKickAttempts++;
              setTimeout( attemptPlay, 250 );
            }
          } );
        }
      } catch {
        if ( this.heroVideoKickAttempts < 6 ) {
          this.heroVideoKickAttempts++;
          setTimeout( attemptPlay, 250 );
        }
      }
    };

    attemptPlay();
  }

  setupPage (): void {
    this.authService.getTenantId().subscribe( tenantId => {
      this.tenantId = String( tenantId || '' );
      this.logger.info( 'DOCUMENT TENANT IS', this.tenantId );
      this.restoreDeskViewMode();
      this.restoreDeskLayout();
      this.loadDocuments();
    } );
  }

  get filteredDocuments (): Document[] {
    const term = ( this.searchTerm || '' ).trim().toLowerCase();

    if ( !term ) {
      return this.documents || [];
    }

    return ( this.documents || [] ).filter( doc => {
      const haystack = [
        doc?.title || '',
        doc?.topic || '',
        doc?.type || '',
        doc?.author || '',
        doc?.summary || '',
        doc?.description || ''
      ].join( ' ' ).toLowerCase();

      return haystack.includes( term );
    } );
  }

  get activeDocument (): Document | null {
    const docs = this.filteredDocuments;
    if ( !docs.length ) return null;

    const safeIndex = Math.min( Math.max( this.activeIndex, 0 ), docs.length - 1 );
    return docs[safeIndex] || null;
  }

  get previousDocument (): Document | null {
    const docs = this.filteredDocuments;
    if ( docs.length < 2 ) return null;

    const index = this.activeIndex <= 0 ? docs.length - 1 : this.activeIndex - 1;
    return docs[index] || null;
  }

  get nextDocument (): Document | null {
    const docs = this.filteredDocuments;
    if ( docs.length < 2 ) return null;

    const index = this.activeIndex >= docs.length - 1 ? 0 : this.activeIndex + 1;
    return docs[index] || null;
  }

  get canUseDeskView (): boolean {
    return this.isBrowser && window.innerWidth >= this.deskViewBreakpoint;
  }

  get isDeskViewActive (): boolean {
    return this.canUseDeskView && this.viewMode === 'desk';
  }

  get isPinsViewActive (): boolean {
    return this.canUseDeskView && this.viewMode === 'pins';
  }

  get deskLightboxTitle (): string {
    return this.deskLightboxDocument?.title || this.deskLightboxDocument?.name || 'Document';
  }

  get deskLightboxTypeLabel (): string {
    if ( this.deskLightboxKind === 'image' ) return 'Image focus';
    if ( this.deskLightboxKind === 'pdf' ) return 'PDF focus';
    return 'Focused document';
  }

  onSearchDocuments ( value: string ): void {
    this.searchTerm = value || '';
    this.activeIndex = 0;
    this.ensureDeskLayoutsForFilteredDocuments();
  }

  showPreviousDocument (): void {
    const docs = this.filteredDocuments;
    if ( !docs.length ) return;

    this.activeIndex = this.activeIndex <= 0 ? docs.length - 1 : this.activeIndex - 1;
  }

  showNextDocument (): void {
    const docs = this.filteredDocuments;
    if ( !docs.length ) return;

    this.activeIndex = this.activeIndex >= docs.length - 1 ? 0 : this.activeIndex + 1;
  }

  setActiveDocumentById ( documentId?: string ): void {
    if ( !documentId ) return;

    const index = this.filteredDocuments.findIndex( doc => String( doc?.id || '' ) === String( documentId ) );
    if ( index >= 0 ) {
      this.activeIndex = index;
    }
  }

  getDocumentPreviewKind ( doc: Document | null | undefined ): 'image' | 'video' | 'file' {
    if ( !doc ) return 'file';

    const type = String( doc?.type || '' ).toLowerCase();
    const src = String( doc?.src || '' ).toLowerCase();

    if ( type.includes( 'image' ) || src.match( /\.(png|jpg|jpeg|gif|webp|svg)$/ ) ) {
      return 'image';
    }

    if ( type.includes( 'video' ) || src.match( /\.(mp4|mov|webm|m4v)$/ ) || this.getPopUpVideoPlatform( src ) ) {
      return 'video';
    }

    return 'file';
  }

  isPdfDocument ( doc: Document | null | undefined ): boolean {
    if ( !doc ) return false;

    const type = String( doc.type || '' ).toLowerCase();
    const src = String( doc.src || '' ).toLowerCase();
    const mimeType = String( doc.mimeType || '' ).toLowerCase();

    return type.includes( 'pdf' ) || mimeType.includes( 'pdf' ) || src.endsWith( '.pdf' );
  }

  getDeskDocumentSurface ( doc: Document | null | undefined ): 'image' | 'pdf' | 'video' | 'file' {
    if ( this.getDocumentPreviewKind( doc ) === 'image' ) return 'image';
    if ( this.isPdfDocument( doc ) ) return 'pdf';
    if ( this.getDocumentPreviewKind( doc ) === 'video' ) return 'video';
    return 'file';
  }

  canOpenInDeskLightbox ( doc: Document | null | undefined ): boolean {
    const surface = this.getDeskDocumentSurface( doc );
    return surface === 'image' || surface === 'pdf';
  }

  getDocumentTypeLabel ( doc: Document | null | undefined ): string {
    if ( !doc ) return 'File';

    const type = String( doc?.type || '' ).trim();
    if ( type ) {
      return type.charAt( 0 ).toUpperCase() + type.slice( 1 );
    }

    const src = String( doc?.src || '' ).toLowerCase();
    if ( src.endsWith( '.pdf' ) ) return 'PDF';
    if ( src.match( /\.(doc|docx)$/ ) ) return 'DOC';
    if ( src.match( /\.(xls|xlsx)$/ ) ) return 'Sheet';
    if ( src.match( /\.(ppt|pptx)$/ ) ) return 'Slides';
    if ( src.match( /\.(mp3|wav|m4a)$/ ) ) return 'Audio';
    if ( src.match( /\.(mp4|mov|webm|m4v)$/ ) ) return 'Video';
    if ( src.match( /\.(png|jpg|jpeg|gif|webp|svg)$/ ) ) return 'Image';

    return 'Document';
  }

  async loadDocuments ( resetRequired?: boolean ): Promise<void> {
    this.isLoading = true;
    this.documents = [];

    this.logger.info( 'CALLING DOCUMENT SERVICE WITH TENANT ID', this.tenantId );

    this.documentService.getDocuments( this.tenantId ).subscribe( {
      next: ( docs ) => {
        const documentArray = Array.isArray( docs )
          ? docs
          : ( ( docs && ( docs as any ).documents ) ? ( docs as any ).documents : [] );
        this.documents = documentArray as Document[];
        this.activeIndex = 0;
        if ( this.focusedDocumentId ) {
          this.setActiveDocumentById( this.focusedDocumentId );
        }
        this.ensureDeskLayoutsForFilteredDocuments( resetRequired === true );
        this.isLoading = false;
        this.logger.info( 'DOCUMENTS RAW', docs );
        this.logger.info( 'DOCUMENTS ASSIGNED LENGTH', documentArray?.length );
        this.logger.info( 'SEARCH TERM AT ASSIGN', this.searchTerm );
      },
      error: ( error ) => {
        this.isLoading = false;
        this.logger.error( 'Error loading documents:', error );
      }
    } );
  }

  onDelete ( document: Document ): void {
    if ( !this.tenantId ) {
      this.notificationService.show( 'Sign In Required', 'Sign in to delete documents from your vault.', 'warning' );
      return;
    }

    const confirmed = window.confirm( 'Are you sure you want to delete this document?' );

    if ( !confirmed || !document?.id ) {
      return;
    }

    this.documentService.removeDocument( document.id, this.tenantId ).subscribe( {
      next: () => {
        this.removeDeskLayoutForDocument( document );
        this.loadDocuments( true );
      },
      error: ( error ) => {
        this.logger.error( 'Error deleting document:', error );
      }
    } );
  }

  onView ( document: Document ): void {
    if ( !document || !document.src ) return;
    window.open( document.src, '_blank' );
  }

  postedStatusLabel ( document: Document | null ): string {
    if ( !document?.lastPostedAt ) return '';
    const platforms = document.lastPostedPlatforms || [];
    const platformLabel = platforms.length > 1 ? `${platforms.length} platforms` : ( platforms[0] || 'social' );
    const postedDate = new Date( document.lastPostedAt );
    const dateLabel = isNaN( postedDate.getTime() ) ? '' : postedDate.toLocaleDateString( undefined, { month: 'short', day: 'numeric' } );
    return dateLabel ? `Posted to ${platformLabel} · ${dateLabel}` : `Posted to ${platformLabel}`;
  }

  private static readonly PLATFORM_ICONS: Record<string, string> = {
    google: 'fa-brands fa-google',
    youtube: 'fa-brands fa-youtube',
    google_business_profile: 'fa-brands fa-google',
    facebook: 'fa-brands fa-facebook',
    instagram: 'fa-brands fa-instagram',
    reddit: 'fa-brands fa-reddit-alien',
    bluesky: 'fa-brands fa-bluesky',
    threads: 'fa-brands fa-threads',
    linkedin: 'fa-brands fa-linkedin'
  };

  postedPlatformIcon ( document: Document | null ): string {
    const platforms = document?.lastPostedPlatforms || [];
    if ( platforms.length !== 1 ) return 'fa-solid fa-share-nodes';
    return DocumentListComponent.PLATFORM_ICONS[platforms[0]] || 'fa-solid fa-share-nodes';
  }

  editingDocumentId: string | null = null;
  editForm: { title: string; topic: string; description: string; eligibleForSocial: boolean } = {
    title: '',
    topic: '',
    description: '',
    eligibleForSocial: false
  };
  savingEdit = false;

  isEditingDocument ( document: Document | null | undefined ): boolean {
    return !!document?.id && this.editingDocumentId === document.id;
  }

  isImageOrVideoDocument ( document: Document | null | undefined ): boolean {
    return document?.type === 'image' || document?.type === 'video';
  }

  startEditDocument ( document: Document | null ): void {
    if ( !document?.id ) return;
    this.editingDocumentId = document.id;
    this.editForm = {
      title: document.title || '',
      topic: document.topic || '',
      description: document.description || '',
      eligibleForSocial: document.eligibleForSocial === true
    };
  }

  cancelEditDocument (): void {
    this.editingDocumentId = null;
  }

  saveEditDocument ( document: Document | null ): void {
    if ( !document?.id || !this.tenantId ) return;

    this.savingEdit = true;
    const payload: Partial<Document> = {
      title: this.editForm.title,
      topic: this.editForm.topic,
      description: this.editForm.description,
      eligibleForSocial: this.editForm.eligibleForSocial
    };

    this.documentService.updateDocument( document.id, payload, this.tenantId ).subscribe( {
      next: ( updated ) => {
        this.savingEdit = false;
        this.editingDocumentId = null;
        Object.assign( document, updated || payload );
        this.notificationService.show( 'Document Updated', 'Your changes were saved.', 'success' );
      },
      error: ( error ) => {
        this.savingEdit = false;
        this.logger.error( 'Error updating document:', error );
        this.notificationService.show( 'Update Failed', 'TODD could not save your changes. Please try again.', 'warning' );
      }
    } );
  }

  toggleSelection (): void {
    this.soundService.playSound( 'toggleOn' );
  }

  selectDocument ( document: Document ): void {
    this.setActiveDocumentById( document?.id );
    if ( document.type === 'draft' ) {
      this.router.navigate( ['/docs/editor', document.id] );
    } else {
      this.selectedDocument = document;
      this.itemSelected.emit( document );
    }
  }

  setViewMode ( mode: DocumentViewMode ): void {
    const nextMode = ( mode === 'desk' || mode === 'pins' ) && !this.canUseDeskView ? 'carousel' : mode;
    if ( this.viewMode === nextMode ) return;

    this.viewMode = nextMode;
    this.persistDeskViewMode();
    if ( this.viewMode === 'desk' ) {
      this.ensureDeskLayoutsForFilteredDocuments();
    }
  }

  resetDeskLayout (): void {
    this.clearDeskLayoutPersistence();
    this.dragOffsets = {};
    this.activeDeskDocumentId = null;
    this.interactingDeskDocumentId = null;
    this.maxDeskZIndex = 10;
    this.ensureDeskLayoutsForFilteredDocuments( true );
  }

  onDeskCardPointerDown ( doc: Document ): void {
    const docId = this.getDeskDocumentId( doc );
    this.interactingDeskDocumentId = docId;
    this.activeDeskDocumentId = docId;
    this.bringDeskDocumentToFront( doc );
  }

  onDeskCardPointerUp (): void {
    if ( !this.draggingDocumentId ) {
      this.interactingDeskDocumentId = null;
    }
  }

  onDeskCardDragStarted ( doc: Document ): void {
    const docId = this.getDeskDocumentId( doc );
    this.draggingDocumentId = docId;
    this.deskFocusEligible = this.canOpenInDeskLightbox( doc );
    this.deskFocusHover = false;
    this.interactingDeskDocumentId = docId;
    this.activeDeskDocumentId = docId;
    this.bringDeskDocumentToFront( doc );
  }

  onDeskCardDragMoved ( doc: Document, event: CdkDragMove ): void {
    if ( !this.deskFocusEligible ) {
      this.deskFocusHover = false;
      return;
    }

    this.deskFocusHover = this.isDeskCardOverFocusTarget( event.source.getRootElement() );
  }

  onDeskCardDragEnded ( doc: Document, event: CdkDragEnd ): void {
    const docId = this.getDeskDocumentId( doc );
    const layout = this.getDeskCardLayout( doc );
    const delta = event.source.getFreeDragPosition();
    const metrics = this.getDeskCanvasMetrics();
    const card = this.getDeskCardDimensions( doc );
    const nextX = this.clamp( layout.x + delta.x, 0, Math.max( 0, metrics.width - card.width ) );
    const nextY = this.clamp( layout.y + delta.y, 0, Math.max( 0, metrics.height - card.height ) );

    this.deskLayout[docId] = {
      ...layout,
      x: nextX,
      y: nextY,
      updatedAt: Date.now()
    };
    this.dragOffsets[docId] = { x: 0, y: 0 };

    const droppedOnFocusTarget = this.deskFocusEligible && this.isDeskCardDroppedOnFocusTarget( event );
    this.draggingDocumentId = null;
    this.deskFocusEligible = false;
    this.deskFocusHover = false;
    this.interactingDeskDocumentId = null;
    this.persistDeskLayout();

    if ( droppedOnFocusTarget ) {
      this.openDeskLightbox( doc );
    }
  }

  onDeskCardClick ( doc: Document ): void {
    this.activeDeskDocumentId = this.getDeskDocumentId( doc );
    this.bringDeskDocumentToFront( doc );
    this.persistDeskLayout();
  }

  onPinsItemClick ( doc: Document ): void {
    if ( this.canOpenInEditor( doc ) ) {
      this.router.navigate( ['/docs/editor', doc.id] );
      return;
    }

    if ( this.canOpenInDeskLightbox( doc ) ) {
      this.openDeskLightbox( doc );
      return;
    }

    if ( this.getDeskDocumentSurface( doc ) === 'video' ) {
      this.openVideoLightbox( doc );
      return;
    }

    this.onView( doc );
  }

  private canOpenInEditor ( doc: Document | null | undefined ): boolean {
    const documentId = String( doc?.id || '' ).trim();
    const documentType = String( doc?.type || '' ).trim().toLowerCase();
    return !!documentId && ['draft', 'document', 'proposal'].includes( documentType );
  }

  openDeskLightbox ( doc: Document ): void {
    if ( !this.canOpenInDeskLightbox( doc ) || !doc.src ) return;

    this.deskLightboxDocument = doc;
    this.deskLightboxKind = this.getDeskDocumentSurface( doc ) === 'image' ? 'image' : 'pdf';
    this.deskLightboxUrl = doc.src;
    this.activeDeskDocumentId = this.getDeskDocumentId( doc );
  }

  closeDeskLightbox (): void {
    this.deskLightboxDocument = null;
    this.deskLightboxKind = null;
    this.deskLightboxUrl = null;
  }

  getDeskCardLayout ( doc: Document, index?: number ): DeskLayoutItem {
    const docId = this.getDeskDocumentId( doc, index );
    if ( !this.deskLayout[docId] ) {
      const resolvedIndex = typeof index === 'number'
        ? index
        : this.filteredDocuments.findIndex( item => this.getDeskDocumentId( item ) === docId );
      this.deskLayout[docId] = this.buildDefaultDeskLayout( doc, resolvedIndex >= 0 ? resolvedIndex : 0 );
    }
    return this.deskLayout[docId];
  }

  getDeskCardFreeDragPosition ( doc: Document, index?: number ): { x: number; y: number; } {
    return this.dragOffsets[this.getDeskDocumentId( doc, index )] || { x: 0, y: 0 };
  }

  getDeskCardRotation ( doc: Document, index?: number ): string {
    const rotation = this.getDeskCardLayout( doc, index ).rotation;
    const docId = this.getDeskDocumentId( doc, index );
    if ( this.draggingDocumentId === docId || this.interactingDeskDocumentId === docId ) return '0deg';
    return `${rotation}deg`;
  }

  getDeskCardZIndex ( doc: Document, index?: number ): number {
    return this.getDeskCardLayout( doc, index ).zIndex;
  }

  getDeskCardWidth ( doc: Document, index?: number ): number {
    return this.getDeskCardDimensions( doc, index ).width;
  }

  getDeskCardVariant ( doc: Document, index?: number ): string {
    const seed = this.getDeskDocumentSeed( doc, index );
    return this.getDeskCardVariantFromSeed( seed, this.getDeskDocumentSurface( doc ) );
  }

  getDeskCardDepth ( doc: Document, index?: number ): string {
    const seed = this.getDeskDocumentSeed( doc, index );
    const depths = ['near', 'mid', 'far'];
    return depths[seed % depths.length];
  }

  readonly trackByDocumentId = ( index: number, doc: Document ): string => this.getDeskDocumentId( doc, index );

  readonly getDeskCardId = ( doc: Document, index: number ): string => this.getDeskDocumentId( doc, index );

  @HostListener( 'window:resize' )
  onResize (): void {
    this.isSmallScreen = this.isBrowser ? window.innerWidth < 992 : true;
    this.isMobile = this.isBrowser ? window.innerWidth < 768 : true;
    if ( !this.canUseDeskView && ( this.viewMode === 'desk' || this.viewMode === 'pins' ) ) {
      this.viewMode = 'carousel';
    }
    this.syncDeskLayoutToViewport();
  }

  @HostListener( 'window:pointerup' )
  onWindowPointerUp (): void {
    if ( !this.draggingDocumentId ) {
      this.interactingDeskDocumentId = null;
    }
  }

  onClickRoute ( goto: string ): void {
    const [path, fragment] = goto.split( '#' );
    this.router.navigate( [path], { fragment } );
  }

  private publishPageActions (): void {
    this.pageActionsService.setPageActions( {
      pageId: 'document-list',
      context: {
        pageId: 'document-list',
        feature: 'documents',
        entityType: 'document',
      },
      actions: this.buildPageActions(),
    } );
  }

  private buildPageActions (): PageAction[] {
    return [
      {
        id: 'document-list-add',
        label: 'Add Document',
        icon: 'fa-solid fa-plus',
        kind: 'route',
        route: '/docs/upload',
        order: 10,
        group: 'context',
      },
      {
        id: 'document-list-response-flow',
        label: 'Response Flow',
        icon: 'fa-solid fa-layer-group',
        kind: 'route',
        route: '/knowledge/response-flow',
        order: 20,
        group: 'context',
      },
      {
        id: 'document-list-editor',
        label: 'Editor',
        icon: 'fa-solid fa-file-lines',
        kind: 'route',
        route: '/docs/editor',
        order: 30,
        group: 'context',
      },
      {
        id: 'document-list-proposal-history',
        label: 'Proposal History',
        icon: 'fa-solid fa-clock-rotate-left',
        kind: 'route',
        route: '/docs/proposal-history',
        order: 40,
        group: 'context',
      },
      {
        id: 'document-list-rfp-upload',
        label: 'RFP Upload',
        icon: 'fa-solid fa-upload',
        kind: 'route',
        route: '/docs/rfp-upload',
        order: 50,
        group: 'context',
      },
      {
        id: 'document-list-rfps',
        label: 'RFPs',
        icon: 'fa-solid fa-folder-open',
        kind: 'route',
        route: '/docs/rfp-list',
        order: 60,
        group: 'context',
      },
    ];
  }

  openVideoLightbox ( doc: Document ): void {
    if ( !doc ) return;

    let url = doc?.src;
    if ( !url ) {
      this.logger.warn( 'No valid video URL found in Document.', doc );
    }

    this.logger.info( 'Passed Document', doc );
    const platform = this.getPopUpVideoPlatform( url );
    this.logger.info( 'Extracted platform', platform );

    if ( platform === 'youtube' ) {
      const videoId = this.extractLightBoxVideoId( url, 'youtube' );
      this.logger.info( 'YouTube VideoId generated', videoId, 'Link is', url );
      this.lightboxVideoUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
      this.lightboxVideoMode = 'embed';
    } else if ( platform === 'vimeo' ) {
      const videoId = this.extractLightBoxVideoId( url, 'vimeo' );
      this.lightboxVideoUrl = `https://player.vimeo.com/video/${videoId}?autoplay=1`;
      this.lightboxVideoMode = 'embed';
    } else if ( platform === 'tiktok' ) {
      const videoId = this.extractLightBoxVideoId( url, 'tiktok' );
      this.lightboxVideoUrl = `https://www.tiktok.com/embed/v2/${videoId}`;
      this.lightboxVideoMode = 'embed';
    } else {
      this.lightboxVideoUrl = url;
      this.lightboxVideoMode = 'file';
    }

    if ( this.lightboxVideoUrl ) {
      this.logger.info( 'LightboxVideo', this.lightboxVideoUrl );
      const lightbox = document.getElementById( 'videoLightbox' );
      const bootstrapModal = new bootstrap.Modal( lightbox! );
      bootstrapModal.show();
    } else {
      this.logger.info( 'No video ID could be extracted.', doc );
    }
  }

  getVideoPlatform ( url: string ): string | null {
    if ( url.includes( 'youtube.com' ) ) return 'youtube';
    if ( url.includes( 'vimeo.com' ) ) return 'vimeo';
    if ( url.includes( 'tiktok.com' ) ) return 'tiktok';
    return null;
  }

  extractVideoId ( url: string, platform: string ): string | null {
    if ( platform === 'youtube' ) {
      const match = url.match( /v=([^&]+)/ );
      return match ? match[1] : null;
    }
    if ( platform === 'vimeo' ) {
      const match = url.match( /vimeo\.com\/(\d+)/ );
      return match ? match[1] : null;
    }
    if ( platform === 'tiktok' ) {
      const match = url.match( /\/video\/(\d+)/ );
      return match ? match[1] : null;
    }
    return null;
  }

  extractLightBoxVideoId ( url: string, platform: string ): string | null {
    if ( !url ) return null;

    if ( platform === 'youtube' ) {
      const match = url.match( /(?:v=|\/)([a-zA-Z0-9_-]{11})/ );
      const videoId = match ? match[1] : null;
      this.logger.log( `YouTube Video ID extracted: ${videoId}, from URL: ${url}` );
      return videoId;
    }

    if ( platform === 'vimeo' ) {
      const match = url.match( /vimeo\.com\/(\d+)/ );
      const videoId = match ? match[1] : null;
      this.logger.log( `Vimeo Video ID extracted: ${videoId}, from URL: ${url}` );
      return videoId;
    }

    if ( platform === 'tiktok' ) {
      const match = url.match( /\/video\/(\d+)/ );
      const videoId = match ? match[1] : null;
      this.logger.log( `TikTok Video ID extracted: ${videoId}, from URL: ${url}` );
      return videoId;
    }

    this.logger.log( `No matching platform found for URL: ${url}` );
    return null;
  }

  getPopUpVideoPlatform ( url: string ): string | null {
    if ( !url ) return null;
    if ( url.includes( 'youtube.com' ) || url.includes( 'youtu.be' ) ) return 'youtube';
    if ( url.includes( 'vimeo.com' ) ) return 'vimeo';
    if ( url.includes( 'tiktok.com' ) ) return 'tiktok';
    return null;
  }

  extractUrl ( content: string ): string | null {
    if ( !content ) return null;
    const urlMatch = content.match( /https?:\/\/[^\s]+/ );
    return urlMatch ? urlMatch[0] : null;
  }

  closeLightbox (): void {
    this.lightboxVideoUrl = null;
    this.lightboxVideoMode = null;
  }

  private ensureDeskLayoutsForFilteredDocuments ( reset = false ): void {
    if ( reset ) {
      this.deskLayout = {};
    }

    const nextLayout = { ...this.deskLayout };
    this.filteredDocuments.forEach( ( doc, index ) => {
      const docId = this.getDeskDocumentId( doc, index );
      if ( !nextLayout[docId] ) {
        nextLayout[docId] = this.buildDefaultDeskLayout( doc, index );
      }
      this.maxDeskZIndex = Math.max( this.maxDeskZIndex, nextLayout[docId].zIndex );
    } );

    this.deskLayout = nextLayout;
    this.syncDeskLayoutToViewport();
    this.persistDeskLayout();
  }

  private buildDefaultDeskLayout ( doc: Document, index: number ): DeskLayoutItem {
    const metrics = this.getDeskCanvasMetrics();
    const hash = this.hashString( this.getDeskDocumentId( doc, index ) );
    const card = this.getDeskCardDimensions( doc, index );
    const cols = Math.max( 2, Math.floor( Math.max( metrics.width - ( metrics.paddingX * 2 ), card.width ) / Math.max( card.width * 0.92, 240 ) ) );
    const rows = Math.max( 1, Math.ceil( Math.max( this.filteredDocuments.length, 1 ) / cols ) );
    const zoneWidth = Math.max( card.width + 18, ( metrics.width - ( metrics.paddingX * 2 ) ) / cols );
    const zoneHeight = Math.max( card.height * 0.54, ( metrics.height - ( metrics.paddingY * 2 ) ) / rows );
    const col = index % cols;
    const row = Math.floor( index / cols );
    const maxX = Math.max( 0, metrics.width - card.width );
    const maxY = Math.max( 0, metrics.height - card.height );
    const x = this.clamp(
      metrics.paddingX + ( col * zoneWidth ) + this.seedInRange( hash, -118, 96 ),
      0,
      maxX
    );
    const y = this.clamp(
      metrics.paddingY + ( row * zoneHeight ) + this.seedInRange( hash >> 1, -86, 90 ),
      0,
      maxY
    );

    return {
      x,
      y,
      rotation: this.seedInRange( hash >> 2, -16, 16 ),
      zIndex: index + 1,
      updatedAt: Date.now()
    };
  }

  private syncDeskLayoutToViewport (): void {
    if ( !this.isBrowser ) return;

    const metrics = this.getDeskCanvasMetrics();
    if ( !Object.keys( this.deskLayout ).length ) return;

    const nextLayout: Record<string, DeskLayoutItem> = {};
    Object.entries( this.deskLayout ).forEach( ( [docId, layout] ) => {
      const doc = this.filteredDocuments.find( item => this.getDeskDocumentId( item ) === docId );
      const card = doc
        ? this.getDeskCardDimensions( doc )
        : this.getDeskCardDimensionsFromSeed( this.hashString( docId ) );
      nextLayout[docId] = {
        ...layout,
        x: this.clamp( layout.x, 0, Math.max( 0, metrics.width - card.width ) ),
        y: this.clamp( layout.y, 0, Math.max( 0, metrics.height - card.height ) ),
      };
    } );
    this.deskLayout = nextLayout;
  }

  private getDeskCanvasMetrics (): DeskCanvasMetrics {
    const width = this.deskCanvasRef?.nativeElement?.clientWidth || Math.min( this.defaultCanvasWidth, this.isBrowser ? Math.max( window.innerWidth - 420, 720 ) : this.defaultCanvasWidth );
    const height = this.deskCanvasRef?.nativeElement?.clientHeight || this.defaultCanvasHeight;

    return {
      width,
      height,
      paddingX: 28,
      paddingY: 28,
    };
  }

  private bringDeskDocumentToFront ( doc: Document ): void {
    const docId = this.getDeskDocumentId( doc );
    const layout = this.getDeskCardLayout( doc );
    this.maxDeskZIndex += 1;
    this.deskLayout[docId] = {
      ...layout,
      zIndex: this.maxDeskZIndex,
      updatedAt: Date.now()
    };
  }

  private isDeskCardDroppedOnFocusTarget ( event: CdkDragEnd ): boolean {
    if ( !this.deskFocusTargetRef?.nativeElement ) return false;

    return this.isDeskCardOverFocusTarget( event.source.getRootElement() );
  }

  private isDeskCardOverFocusTarget ( cardElement: Element ): boolean {
    if ( !this.deskFocusTargetRef?.nativeElement ) return false;

    const targetRect = this.deskFocusTargetRef.nativeElement.getBoundingClientRect();
    const cardRect = cardElement.getBoundingClientRect();
    const centerX = cardRect.left + ( cardRect.width / 2 );
    const centerY = cardRect.top + ( cardRect.height / 2 );

    return centerX >= targetRect.left &&
      centerX <= targetRect.right &&
      centerY >= targetRect.top &&
      centerY <= targetRect.bottom;
  }

  private getDeskDocumentId ( doc: Document, index?: number ): string {
    const stableId = doc?.id || doc?.storagePath || doc?.src || doc?.title;
    if ( stableId ) {
      return String( stableId );
    }

    const resolvedIndex = typeof index === 'number'
      ? index
      : this.filteredDocuments.findIndex( item => item === doc );

    return `doc-${resolvedIndex >= 0 ? resolvedIndex : 0}`;
  }

  private getDeskDocumentSeed ( doc: Document, index?: number ): number {
    return this.hashString( this.getDeskDocumentId( doc, index ) );
  }

  private getDeskCardDimensions ( doc: Document, index?: number ): { width: number; height: number; } {
    return this.getDeskCardDimensionsFromSeed( this.getDeskDocumentSeed( doc, index ), this.getDeskDocumentSurface( doc ) );
  }

  private getDeskCardDimensionsFromSeed ( seed: number, surface?: string ): { width: number; height: number; } {
    const variant = this.getDeskCardVariantFromSeed( seed, surface );
    switch ( variant ) {
      case 'portrait-tall':
        return { width: 246, height: 354 };
      case 'square-soft':
        return { width: 230, height: 230 };
      case 'landscape-soft':
        return { width: 286, height: 214 };
      case 'portrait':
      default:
        return { width: 254, height: 322 };
    }
  }

  private getDeskCardVariantFromSeed ( seed: number, surface = 'image' ): string {
    if ( surface === 'image' ) {
      const variants = ['portrait', 'portrait-tall', 'square-soft', 'landscape-soft'];
      return variants[seed % variants.length];
    }

    if ( surface === 'video' ) {
      return 'landscape-soft';
    }

    if ( surface === 'pdf' ) {
      return seed % 2 === 0 ? 'portrait' : 'portrait-tall';
    }

    return seed % 2 === 0 ? 'square-soft' : 'portrait';
  }

  private removeDeskLayoutForDocument ( doc: Document ): void {
    const docId = this.getDeskDocumentId( doc );
    if ( !this.deskLayout[docId] ) return;
    delete this.deskLayout[docId];
    delete this.dragOffsets[docId];
    this.persistDeskLayout();
  }

  private getDeskViewModeStorageKey (): string {
    return `todd:documents:view-mode:${this.tenantId || 'tenant'}:${this.userId || 'user'}`;
  }

  private getDeskLayoutStorageKey (): string {
    return `todd:documents:desk-layout:${this.tenantId || 'tenant'}:${this.userId || 'user'}`;
  }

  private restoreDeskViewMode (): void {
    if ( !this.isBrowser ) return;

    try {
      const raw = localStorage.getItem( this.getDeskViewModeStorageKey() );
      this.viewMode = raw === 'desk' || raw === 'pins' ? raw : 'carousel';
      if ( ( this.viewMode === 'desk' || this.viewMode === 'pins' ) && !this.canUseDeskView ) {
        this.viewMode = 'carousel';
      }
    } catch ( error ) {
      this.logger.warn( 'Desk view mode restore failed', error );
      this.viewMode = 'carousel';
    }
  }

  private persistDeskViewMode (): void {
    if ( !this.isBrowser ) return;

    try {
      localStorage.setItem( this.getDeskViewModeStorageKey(), this.viewMode );
    } catch ( error ) {
      this.logger.warn( 'Desk view mode persist failed', error );
    }
  }

  private restoreDeskLayout (): void {
    if ( !this.isBrowser ) return;

    try {
      const raw = localStorage.getItem( this.getDeskLayoutStorageKey() );
      this.deskLayout = raw ? JSON.parse( raw ) : {};
      const zIndexes = Object.values( this.deskLayout ).map( item => Number( item?.zIndex || 0 ) );
      this.maxDeskZIndex = zIndexes.length ? Math.max( ...zIndexes, 10 ) : 10;
    } catch ( error ) {
      this.logger.warn( 'Desk layout restore failed', error );
      this.deskLayout = {};
      this.maxDeskZIndex = 10;
    }
  }

  private persistDeskLayout (): void {
    if ( !this.isBrowser ) return;

    try {
      localStorage.setItem( this.getDeskLayoutStorageKey(), JSON.stringify( this.deskLayout ) );
    } catch ( error ) {
      this.logger.warn( 'Desk layout persist failed', error );
    }
  }

  private clearDeskLayoutPersistence (): void {
    if ( !this.isBrowser ) return;

    try {
      localStorage.removeItem( this.getDeskLayoutStorageKey() );
    } catch ( error ) {
      this.logger.warn( 'Desk layout clear failed', error );
    }
  }

  private hashString ( value: string ): number {
    let hash = 0;
    for ( let index = 0; index < value.length; index++ ) {
      hash = ( ( hash << 5 ) - hash ) + value.charCodeAt( index );
      hash |= 0;
    }
    return Math.abs( hash );
  }

  private seedInRange ( seed: number, min: number, max: number ): number {
    const normalized = Math.abs( Math.sin( seed || 1 ) );
    return Math.round( min + ( normalized * ( max - min ) ) );
  }

  private clamp ( value: number, min: number, max: number ): number {
    return Math.min( Math.max( value, min ), max );
  }
}
