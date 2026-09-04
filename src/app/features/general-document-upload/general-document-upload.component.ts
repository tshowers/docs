import { Component, OnInit, OnDestroy, Input, EventEmitter, Output, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, combineLatest } from 'rxjs';

import { LoggerService } from '../../services/logger.service';
import { DocService, DocumentLimits } from '../../services/doc.service';
import { DocsAssistantSignalService } from '../../services/docs-assistant-signal.service';
import { DocsAuthService } from '../../services/docs-auth.service';
import { Document } from '../../models/document.model';
import { SoundService } from '../../services/sound.service';
import { DocsTipService } from '../../services/docs-tip.service';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { ToddTipComponent } from '../../shared/todd-tip/todd-tip.component';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { DocsPageActionsService } from '../../services/docs-page-actions.service';
import { PageAction } from '../../models/page-actions.models';
import { ClickSoundDirective } from '../../shared/directives/click-sound.directive';
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';

interface FileUploadItem {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  errorMsg?: string;
  eligibleForSocial: boolean;
}

/**
 * Ported from features/document/general-document-upload/general-document-upload.component.ts.
 *
 * The monorepo original extends TopDogComponent (readiness gating built
 * around RoutePerfService, SettingsService, DiagnosticComponent, and
 * SayIt-context switching - none of which exist in this app, and none of
 * which this component's own template actually renders). Per the port
 * plan, this replicates the auth-context-watching approach
 * web-products/network's ContactHomeComponent uses instead: a plain
 * combineLatest over tenantId/userId/isLoggedIn, no base-class readiness
 * machinery. ToddAssistantBusService's signalState$ subscription is
 * dropped, same as every other cockpit page ported from Network.
 *
 * This is one of the components that uploads straight to Firebase Storage
 * from the browser (`getStorage`/`ref`/`uploadBytesResumable`/
 * `getDownloadURL`) - storage path `${tenantId}/documents/${file.name}`
 * preserved exactly, since it must match whatever Storage security rules
 * already exist server-side for this bucket.
 */
@Component( {
  selector: 'app-general-document-upload',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterModule,
    BackToTopComponent,
    PreloaderComponent,
    ToddTipComponent, ClickSoundDirective, CockpitBrowseModeBannerComponent],
  templateUrl: './general-document-upload.component.html',
  styleUrl: './general-document-upload.component.css'
} )
export class GeneralDocumentUploadComponent implements OnInit, OnDestroy, OnChanges {
  @Input() item!: Document;
  isSmallScreen: boolean = window.innerWidth < 992;
  isLoading = false;

  docTipText: string = '';

  document: Document = {
    src: '',
    name: '',
    type: 'document', // Default type, can be changed as needed
    author: '',
    uploadDate: '',
    contactId: '',
    title: '',
    topic: '',
    description: ''
  };

  @Output() backToList = new EventEmitter<void>();

  storage = getStorage();
  @ViewChild( 'fileInput' ) fileInput!: ElementRef<HTMLInputElement>;
  selectedFiles: FileUploadItem[] = [];
  downloadURL: string | null = null;
  error: string | null = null;
  backendErrorCode: string | null = null;
  processing: boolean = false;
  showDocumentListOnMobile = false;
  docLimits: DocumentLimits | null = null;

  userId: string | null = null;
  tenantId: string = '';
  isLoggedIn = false;
  private authContextSubscription?: Subscription;

  get canUploadDocuments (): boolean {
    return this.isLoggedIn && !!this.userId;
  }

  get uploadDisabledReason (): string {
    return 'Sign in to upload and save documents. Free accounts can save up to 10 documents.';
  }

  get docLimitMessage (): string {
    const limits = this.docLimits;
    if ( !limits || limits.isPaidUser ) return '';
    if ( limits.currentCount <= 0 ) return `${limits.freeDocumentLimit} free documents available`;
    if ( limits.remainingFreeDocuments <= 0 ) return 'You have used all 10 free documents. Upgrade to keep uploading.';
    return `${limits.remainingFreeDocuments} of ${limits.freeDocumentLimit} free documents left`;
  }

  constructor (
    private authService: DocsAuthService,
    private soundService: SoundService,
    private logger: LoggerService,
    private router: Router,
    private tipService: DocsTipService,
    private docService: DocService,
    private notificationService: DocsNotificationService,
    private assistantBus: DocsAssistantSignalService,
    private pageActionsService: DocsPageActionsService ) { }

  ngOnInit (): void {
    this.docTipText = this.tipService.getRandomTipText( 'documents' );

    this.authContextSubscription = combineLatest( [
      this.authService.getTenantId(),
      this.authService.getUserId(),
      this.authService.isLoggedIn(),
    ] ).subscribe( ( [tenantId, userId, isLoggedIn] ) => {
      this.tenantId = tenantId || '';
      this.userId = userId || null;
      this.isLoggedIn = isLoggedIn;
      this.loadDocLimits();
      this.publishPageContext();
    } );

    this.publishPageContext();
  }

  ngOnDestroy (): void {
    this.authContextSubscription?.unsubscribe();
    this.pageActionsService.clearPageActions( 'general-document-upload' );
  }

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( changes['item'] && changes['item'].currentValue ) {
      this.setDocument();
      this.publishPageContext();
    }
  }

  toggleSelection () {
    this.soundService.playSound( "toggleOn" );
  }
  private publishPageContext (): void {
    this.assistantBus.setPageContext( {
      feature: 'documents',
      page: 'general-document-upload',
      route: this.router.url,
      mode: this.document?.id ? 'edit' : 'create',
      title: this.document?.id ? 'Edit Upload' : 'Upload Document',
      description: 'Upload a document, image, or video and save its metadata.',
      allowedActions: [
        'select_file',
        'drop_file',
        'upload_document',
        'clear_selected_file'
      ],
      selectedEntityType: 'document',
      selectedEntityId: this.document?.id || '',
      summary: {
        isAuthenticated: this.canUploadDocuments,
        interactionMode: this.canUploadDocuments ? 'member' : 'guest',
        hasAuthor: !!this.document?.author,
        hasTitle: !!this.document?.title,
        hasTopic: !!this.document?.topic,
        hasDescription: !!this.document?.description,
        hasSelectedFile: this.selectedFiles.length > 0,
        hasDownloadUrl: !!this.downloadURL,
        isProcessing: this.processing,
        uploadProgress: this.selectedFiles.length > 0
          ? this.selectedFiles.reduce( ( sum, f ) => sum + f.progress, 0 ) / this.selectedFiles.length
          : 0
      },
      dataPreview: {
        title: this.document?.title || '',
        topic: this.document?.topic || '',
        description: this.document?.description || '',
        selectedFileName: this.selectedFiles.length === 1
          ? this.selectedFiles[0].file.name
          : this.selectedFiles.length > 1 ? `${this.selectedFiles.length} files selected` : '',
        downloadURL: this.downloadURL || ''
      }
    } );

    this.publishPageActions();
  }

  openFilePicker (): void {
    this.soundService.playSound('click');

    if ( !this.canUploadDocuments || this.processing ) {
      this.notificationService.show(
        'Upload Notice',
        'You can explore Documents freely. Log in to upload and save a document.',
        'warning'
      );
      this.error = this.uploadDisabledReason;
      this.publishPageContext();
      return;
    }

    this.fileInput?.nativeElement?.click();
  }

  setDocument (): void {

    this.document = this.item;
    this.logger.debug( "Setting this.document to ", this.document );
    this.publishPageContext();
  }

  private publishPageActions (): void {
    this.pageActionsService.setPageActions( {
      pageId: 'general-document-upload',
      context: {
        pageId: 'general-document-upload',
        feature: 'documents',
        entityType: 'document',
        entityId: this.document?.id || ''
      },
      actions: this.buildPageActions()
    } );
  }

  private buildPageActions (): PageAction[] {
    return [
      {
        id: 'general-document-upload-submit',
        label: this.document?.id ? 'Update Upload' : 'Upload to TODD',
        icon: 'fa-solid fa-cloud-arrow-up',
        kind: 'callback',
        handler: () => {
          const submitEvent = new Event( 'submit', { cancelable: true } );
          this.onSubmit( submitEvent );
        },
        disabled: () => this.processing || !this.canUploadDocuments,
        order: 10,
        group: 'context'
      },
      {
        id: 'general-document-upload-response-flow',
        label: 'Response Flow',
        icon: 'fa-solid fa-layer-group',
        kind: 'route',
        route: '/knowledge/response-flow',
        order: 20,
        group: 'context'
      },
      {
        id: 'general-document-upload-editor',
        label: 'Editor',
        icon: 'fa-solid fa-file-lines',
        kind: 'route',
        route: '/docs/editor',
        order: 30,
        group: 'context'
      },
      {
        id: 'general-document-upload-proposal-history',
        label: 'Proposal History',
        icon: 'fa-solid fa-clock-rotate-left',
        kind: 'route',
        route: '/docs/proposal-history',
        order: 40,
        group: 'context'
      },
      {
        id: 'general-document-upload-rfp-upload',
        label: 'RFP Upload',
        icon: 'fa-solid fa-upload',
        kind: 'route',
        route: '/docs/rfp-upload',
        order: 50,
        group: 'context'
      },
      {
        id: 'general-document-upload-rfps',
        label: 'RFPs',
        icon: 'fa-solid fa-folder-open',
        kind: 'route',
        route: '/docs/rfp-list',
        order: 60,
        group: 'context'
      },
    ];
  }

  private loadDocLimits (): void {
    if ( !this.canUploadDocuments ) {
      this.docLimits = null;
      this.publishPageContext();
      return;
    }

    this.docService.getLimits().subscribe( {
      next: ( limits ) => {
        this.docLimits = limits;
        this.publishPageContext();
      },
      error: ( error ) => {
        this.logger.warn( 'Unable to load document limits', error );
        this.docLimits = null;
        this.publishPageContext();
      }
    } );
  }

  onFileSelect ( event: Event ): void {
    if ( !this.canUploadDocuments ) {
      this.notificationService.show( 'Upload Notice', 'You can explore Documents freely. Log in to upload and save a document.', 'warning' );
      this.error = this.uploadDisabledReason;
      this.publishPageContext();
      return;
    }

    const input = event.target as HTMLInputElement;
    if ( input.files && input.files.length > 0 ) {
      const newFiles = Array.from( input.files );
      this.selectedFiles.push( ...newFiles.map( f => ( { file: f, progress: 0, status: 'pending' as const, eligibleForSocial: false } ) ) );
      this.error = null;
      this.backendErrorCode = null;
      this.soundService.playSound( "click" );
      this.publishPageContext();
    }
  }

  onDrop ( event: DragEvent ): void {
    event.preventDefault();
    if ( !this.canUploadDocuments ) {
      this.notificationService.show( 'Upload Notice', 'You can explore Documents freely. Log in to upload and save a document.', 'warning' );
      this.error = this.uploadDisabledReason;
      this.publishPageContext();
      return;
    }
    event.stopPropagation();
    this.removeDragData( event );
    if ( event.dataTransfer && event.dataTransfer.files.length > 0 ) {
      const newFiles = Array.from( event.dataTransfer.files );
      this.selectedFiles.push( ...newFiles.map( f => ( { file: f, progress: 0, status: 'pending' as const, eligibleForSocial: false } ) ) );
      this.error = null;
      this.backendErrorCode = null;
      this.publishPageContext();
    }
  }

  onDragOver ( event: DragEvent ): void {
    event.preventDefault();
    event.stopPropagation();
    if ( !this.canUploadDocuments ) {
      return;
    }
    event.dataTransfer!.dropEffect = 'copy';
  }

  onDragLeave ( event: DragEvent ): void {
    event.preventDefault();
    event.stopPropagation();
  }

  removeDragData ( event: DragEvent ): void {
    if ( event.dataTransfer ) {
      event.dataTransfer.clearData();
    }
  }

  onSubmit ( event: Event ): void {
    event.preventDefault();
    if ( !this.canUploadDocuments ) {
      this.notificationService.show( 'Upload Notice', 'You can explore Documents freely. Log in to upload and save a document.', 'warning' );
      this.error = this.uploadDisabledReason;
      this.publishPageContext();
      return;
    }
    if ( this.docLimits && !this.docLimits.isPaidUser && !this.docLimits.canCreateDocument ) {
      this.error = 'You have used all 10 free documents. Upgrade to keep uploading.';
      this.backendErrorCode = 'DOCUMENT_QUOTA_EXCEEDED';
      this.publishPageContext();
      return;
    }
    if ( this.selectedFiles.length === 0 ) {
      this.error = 'Please select at least one file to upload';
      this.publishPageContext();
      return;
    }
    if ( !this.document || !this.document.author || !this.document.title || !this.document.topic ) {
      this.error = 'Please fill in all required fields';
      this.publishPageContext();
      return;
    }
    this.uploadAll();
  }

  async uploadAll (): Promise<void> {
    this.processing = true;
    this.error = null;
    this.backendErrorCode = null;
    this.publishPageContext();

    for ( const item of this.selectedFiles ) {
      if ( item.status !== 'pending' ) continue;
      item.status = 'uploading';
      this.publishPageContext();
      try {
        await this.uploadSingleFile( item );
        item.status = 'done';
      } catch ( err ) {
        item.status = 'error';
        item.errorMsg = this.buildUploadFailureMessage( err );
        this.backendErrorCode = this.extractBackendErrorCode( err );
        this.logger.error( 'Upload error for', item.file.name, err );
      }
      this.publishPageContext();
    }

    this.processing = false;
    const anySuccess = this.selectedFiles.some( i => i.status === 'done' );
    this.soundService.playSound( anySuccess && this.selectedFiles.every( i => i.status === 'done' ) ? 'finished' : 'error' );
    if ( anySuccess ) {
      this.loadDocLimits();
      this.refreshDocumentList();
    }
    this.publishPageContext();
  }

  private uploadSingleFile ( item: FileUploadItem ): Promise<void> {
    return new Promise<void>( ( resolve, reject ) => {
      const file = item.file;
      const storageRef = ref( this.storage, this.tenantId + '/documents/' + file.name );
      const uploadTask = uploadBytesResumable( storageRef, file );

      uploadTask.on( 'state_changed',
        ( snapshot ) => {
          item.progress = ( snapshot.bytesTransferred / snapshot.totalBytes ) * 100;
          this.publishPageContext();
        },
        reject,
        () => {
          getDownloadURL( uploadTask.snapshot.ref ).then( ( downloadURL ) => {
            this.downloadURL = downloadURL;
            const uploadDate = new Date().toISOString();
            const payload: Document = {
              src: downloadURL,
              name: file.name,
              type: this.determineFileType( file ),
              mimeType: file.type,
              uploadDate,
              author: this.document.author,
              title: this.document.title,
              topic: this.document.topic,
              description: this.document.description,
              ownerId: this.userId || undefined,
              tenantId: this.tenantId,
              createdAt: uploadDate,
              updatedAt: uploadDate,
              recordKind: 'upload',
              eligibleForSocial: item.eligibleForSocial
            };
            this.docService.createDocument( payload ).subscribe( {
              next: ( created ) => {
                if ( created?.id && !this.document.id ) {
                  this.document.id = created.id;
                }
                resolve();
              },
              error: reject
            } );
          } ).catch( reject );
        }
      );
    } );
  }

  clearForm (): void {
    this.document.author = '';
    this.document.title = '';
    this.document.topic = '';
    this.document.description = '';
    this.selectedFiles = [];
    this.downloadURL = null;
    this.error = null;
    this.backendErrorCode = null;
    this.fileInput.nativeElement.value = '';
    this.publishPageContext();
  }

  refreshDocumentList (): void {
    if ( this.showDocumentListOnMobile ) {
      this.backToList.emit();
      return;
    }

    this.router.navigate( ['/docs/documents'] );
  }

  removeFile ( index: number ): void {
    this.selectedFiles.splice( index, 1 );
    if ( this.selectedFiles.length === 0 ) {
      this.fileInput.nativeElement.value = '';
    }
    this.publishPageContext();
  }

  private extractBackendErrorCode ( error: unknown ): string | null {
    if ( error instanceof HttpErrorResponse ) {
      return error.error?.code || null;
    }
    return null;
  }

  private buildUploadFailureMessage ( error: unknown ): string {
    if ( error instanceof HttpErrorResponse ) {
      const backendMessage = error.error?.message;
      if ( typeof backendMessage === 'string' && backendMessage.trim() ) {
        return backendMessage.trim();
      }

      if ( error.status === 403 ) {
        return 'You do not have access to create this document right now.';
      }

      if ( error.status === 400 ) {
        return 'The document details were invalid. Please review the form and try again.';
      }

      if ( error.status === 0 ) {
        return 'We could not reach the server. Please try again in a moment.';
      }
    }

    return 'We uploaded the file, but could not save the document record. Your form values and selected file are still here so you can try again.';
  }

  isImageOrVideo ( file: File ): boolean {
    const fileType = this.determineFileType( file );
    return fileType === 'image' || fileType === 'video';
  }

  determineFileType ( file: File ): 'document' | 'image' | 'video' {
    // Trust the browser-supplied MIME type first - it correctly covers
    // formats an extension allowlist tends to miss (webp, heic, webm, m4v...).
    // Extension sniffing is only a fallback for the rare case file.type is
    // empty (some browsers omit it for certain drag-and-drop sources).
    const mimeType = ( file.type || '' ).toLowerCase();
    if ( mimeType.startsWith( 'image/' ) ) return 'image';
    if ( mimeType.startsWith( 'video/' ) ) return 'video';

    const fileExtension = file.name.split( '.' ).pop()?.toLowerCase();
    if ( !fileExtension ) {
      return 'document';
    }
    switch ( fileExtension ) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'svg':
      case 'webp':
      case 'heic':
      case 'heif':
      case 'avif':
        return 'image';
      case 'mp4':
      case 'mov':
      case 'avi':
      case 'mkv':
      case 'flv':
      case 'wmv':
      case 'webm':
      case 'm4v':
        return 'video';
      default:
        return 'document';
    }
  }

}
