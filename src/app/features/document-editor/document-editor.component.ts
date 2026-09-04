import { Component, OnInit, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DocRichTextEditorComponent } from '../../shared/doc-rich-text-editor/doc-rich-text-editor.component';
import { Router } from '@angular/router';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { LoggerService } from '../../services/logger.service';
import { Subscription } from 'rxjs';
import { DocsAuthService } from '../../services/docs-auth.service';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Document } from '../../models/document.model';

import { DocsAssistantSignalService } from '../../services/docs-assistant-signal.service';

import { DocService } from '../../services/doc.service';
import { DocsOpenAiService } from '../../services/docs-open-ai.service';
import { take } from 'rxjs/operators';

import { ToddTipComponent } from '../../shared/todd-tip/todd-tip.component';
import { DocsTipService } from '../../services/docs-tip.service';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { SoundService } from '../../services/sound.service';
import { DocsPageActionsService } from '../../services/docs-page-actions.service';
import { PageAction } from '../../models/page-actions.models';
import { ClickSoundDirective } from '../../shared/directives/click-sound.directive';
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';

/**
 * Ported from features/document/document-editor/document-editor.component.ts
 * (route was `document-editor`/`document-editor/:id`, now `/docs/editor`
 * and `/docs/editor/:id`).
 *
 * Two intentional trims from the monorepo original:
 * - `<app-email-editor>` (a 1553-line email composer that also happens to
 *   support a `mode="document"` WYSIWYG-only path) is replaced with
 *   DocRichTextEditorComponent, a purpose-built equivalent that keeps the
 *   exact same [htmlContent]/(htmlContentChange) contract - see that
 *   component's own header comment for why.
 * - DiagnosticComponent's @ViewChild/toggleDiagnosticInChild is dropped:
 *   the monorepo's own template never renders `<app-diagnostic>` in this
 *   component either, so it was already dead code there.
 *
 * This is the second of the direct-to-Firebase-Storage upload components -
 * path `documents/${userId}/${file.name}` preserved exactly.
 * ToddAssistantBusService's signalState$ subscription is dropped, same as
 * every other cockpit page ported from Network.
 */
@Component( {
  selector: 'app-document-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, DocRichTextEditorComponent, ToddTipComponent, PreloaderComponent, BackToTopComponent, ClickSoundDirective, CockpitBrowseModeBannerComponent],
  templateUrl: './document-editor.component.html',
  styleUrls: ['./document-editor.component.css']
} )
export class DocumentEditorComponent implements OnInit, OnDestroy {

  htmlContent = '';
  documentName: string = '';
  docid!: string;

  storage = getStorage();
  uploadProgress: number | null = null;
  downloadURL: string | null = null;
  error: string | null = null;

  docTipText: string = '';

  userId!: any;

  private userSubscription!: Subscription;

  isMobile: boolean = window.innerWidth < 768; // Initialize based on current width
  isSmallScreen: boolean = window.innerWidth < 992;
  isProcessing: boolean = true;

  instructionText: string = '';
  toddPreview: string | null = null;
  isToddWorking: boolean = false;
  currentDocument: Document | null = null;

  get canCrudDocuments (): boolean {
    return !!this.userId;
  }

  get crudDisabledReason (): string {
    return 'Sign in to create, edit, and save documents.';
  }

  constructor ( private router: Router,
    private logger: LoggerService,
    private authService: DocsAuthService,
    private soundService: SoundService,
    private route: ActivatedRoute,
    private openaiService: DocsOpenAiService,
    private tipService: DocsTipService,
    private notificationService: DocsNotificationService,
    private docService: DocService,
    private assistantBus: DocsAssistantSignalService,
    private pageActionsService: DocsPageActionsService ) { }
  private publishPageContext (): void {
    this.assistantBus.setPageContext( {
      feature: 'documents',
      page: 'document-editor',
      route: this.router.url,
      mode: this.docid ? 'edit' : 'create',
      title: this.docid ? 'Edit Document' : 'Create Document',
      description: 'Write, edit, upload, and refine documents with TODD assistance.',
      allowedActions: [
        'save_document',
        'upload_document',
        'export_pdf',
        'export_doc',
        'run_todd_instruction',
        'apply_todd_preview'
      ],
      selectedEntityType: 'document',
      selectedEntityId: this.docid || '',
      summary: {
        isAuthenticated: this.canCrudDocuments,
        interactionMode: this.canCrudDocuments ? 'member' : 'guest',
        hasTitle: !!this.documentName,
        hasHtmlContent: !!this.htmlContent,
        hasDownloadUrl: !!this.downloadURL,
        hasToddPreview: !!this.toddPreview,
        isToddWorking: this.isToddWorking,
        isProcessing: this.isProcessing,
        hasInstructionText: !!this.instructionText,
        isEditing: !!this.docid
      },
      dataPreview: {
        title: this.documentName || '',
        downloadURL: this.downloadURL || '',
        instructionText: this.instructionText || ''
      }
    } );

    this.publishPageActions();
  }

  /**
   * Prefill title/body when navigated from chat (inline Apply for document/strategy).
   * Prefers navigation state for large bodies; falls back to query params.
   */
  private prefillFromNavigation (): void {
    try {
      const nav = this.router.getCurrentNavigation();
      const state = ( nav?.extras?.state ?? {} ) as any;

      this.route.queryParamMap.pipe( take( 1 ) ).subscribe( qp => {
        const title = ( state?.title ?? state?.name ?? qp.get( 'title' ) ?? qp.get( 'name' ) ) || '';
        const body = ( state?.body ?? state?.html ?? qp.get( 'body' ) ?? qp.get( 'html' ) ) || '';

        if ( title ) {
          this.documentName = title;
        }

        if ( body ) {
          // If body looks like HTML, keep as-is; otherwise convert plain text to basic HTML
          const looksHtml = /<\w+[^>]*>/i.test( body );
          const html = looksHtml
            ? body
            : `<p>${body
              .replace( /&/g, '&amp;' )
              .replace( /</g, '&lt;' )
              .replace( />/g, '&gt;' )
              .replace( /\n\n/g, '</p><p>' )
              .replace( /\n/g, '<br>' )
            }</p>`;
          this.htmlContent = html;
          this.isProcessing = false;
        }
      } );
    } catch ( e ) {
      this.logger.warn( 'prefillFromNavigation (doc editor) failed (non-fatal)', e );
    }
  }

  ngOnInit (): void {
    this.setUpUserID();
    this.docTipText = this.tipService.getRandomTipText( 'documents' );
    this.publishPageContext();
  }

  ngOnDestroy (): void {
    if ( this.userSubscription ) this.userSubscription.unsubscribe();
    this.pageActionsService.clearPageActions( 'document-editor' );
  }
  saveClick () {
    this.soundService.playSound( "finished" );
  }

  toggleSelection () {
    this.soundService.playSound( "toggleOn" );
  }
  private getLocalStorageKey (): string {
    const id = this.docid || 'new';
    const uid = this.userId || 'anon';
    return `todd.doc.${uid}.${id}`;
  }

  private persistLocalDraft (): void {
    try {
      const payload = { html: this.htmlContent, title: this.documentName, ts: Date.now() };
      localStorage.setItem( this.getLocalStorageKey(), JSON.stringify( payload ) );
      this.logger.info( 'Local draft persisted', { key: this.getLocalStorageKey(), len: ( this.htmlContent || '' ).length } );
    } catch ( e ) {
      this.logger.warn( 'localStorage persist failed', e );
    }
  }

  private restoreLocalDraft (): void {
    try {
      const raw = localStorage.getItem( this.getLocalStorageKey() );
      if ( !raw ) return;
      const obj = JSON.parse( raw );
      if ( obj && typeof obj.html === 'string' && obj.html.length ) {
        this.htmlContent = obj.html;
        if ( obj.title && !this.documentName ) this.documentName = obj.title;
        this.logger.info( 'Restored local draft', { key: this.getLocalStorageKey() } );
      }
    } catch ( e ) {
      this.logger.warn( 'localStorage restore failed', e );
    }
  }

  private clearLocalDraft (): void {
    try {
      localStorage.removeItem( this.getLocalStorageKey() );
      this.logger.info( 'Cleared local draft', { key: this.getLocalStorageKey() } );
    } catch ( e ) {
      this.logger.warn( 'localStorage clear failed', e );
    }
  }

  setUpUserID (): void {
    this.userSubscription = this.authService.getUserId().subscribe( userId => {
      this.userId = userId;
      this.isProcessing = false;
      this.publishPageContext();
      this.route.paramMap.subscribe( params => {
        const id = params.get( 'id' );
        const rfpId = this.route.snapshot.queryParamMap.get( 'rfpId' );
        this.logger.info( "Route Param retrieved", id );
        if ( id && this.userId ) {
          this.loadExistingDocument( id );
        } else if ( rfpId ) {
          this.loadDraftFromOpenAI( rfpId );
        } else {
          // No id/rfpId: likely coming from chat Apply → prefill
          this.prefillFromNavigation();
        }
        // After initial load/prefill, attempt to restore any unsaved local draft
        this.publishPageContext();
        setTimeout( () => this.restoreLocalDraft(), 0 );
      } );
    } );
  }

  loadExistingDocument ( id: string ) {
    if ( !this.canCrudDocuments ) {
      this.isProcessing = false;
      this.publishPageContext();
      return;
    }

    this.docService.getDocument( id, this.userId ).subscribe( {
      next: ( doc: Document ) => {
        if ( doc ) {
          this.currentDocument = doc;
          this.docid = doc.id;
          this.documentName = doc.title || doc.name || 'Untitled';
          this.htmlContent = doc.htmlContent || '';
          this.downloadURL = doc.src || null;
          this.logger.info( 'HTML CONTENT', this.htmlContent );
        }
        this.isProcessing = false;
        this.publishPageContext();
      },
      error: ( error ) => {
        this.logger.error( 'Error loading document:', error );
        this.isProcessing = false;
        this.publishPageContext();
      }
    } );
  }

  loadDraftFromOpenAI ( rfpId: string ) {
    if ( !this.canCrudDocuments ) {
      this.isProcessing = false;
      this.publishPageContext();
      return;
    }

    this.docService.getDocument( rfpId, this.userId ).subscribe( {
      next: ( doc: Document ) => {
        if ( !doc ) {
          this.logger.warn( 'No RFP found with ID', rfpId );
          this.isProcessing = false;
          this.publishPageContext();
          return;
        }

        this.docService.getDocuments( this.userId ).subscribe( {
          next: ( data: Document[] ) => {
            const pastProposals = ( data || [] )
              .filter( ( item: Document ) => item.type === 'proposal' )
              .map( item => item as Document );

            this.openaiService.proposalAssistant( '', doc, pastProposals, this.userId )
              .subscribe( {
                next: ( response: any ) => {
                  if ( response?.content ) {
                    this.htmlContent = response.content;
                  } else {
                    this.logger.warn( 'OpenAI returned empty content' );
                  }
                  this.isProcessing = false;
                  this.publishPageContext();
                },
                error: ( error ) => {
                  this.logger.error( 'OpenAI error', error );
                  this.isProcessing = false;
                  this.publishPageContext();
                }
              } );
          },
          error: ( error ) => {
            this.logger.error( 'Error loading proposal history:', error );
            this.isProcessing = false;
            this.publishPageContext();
          }
        } );
      },
      error: ( error ) => {
        this.logger.error( 'Error loading RFP:', error );
        this.isProcessing = false;
        this.publishPageContext();
      }
    } );
  }

  onHtmlContentChange ( newContent: string ) {
    this.htmlContent = newContent;
    this.persistLocalDraft();
    this.publishPageContext();
  }

  exportTo ( format: 'pdf' | 'doc' ) {
    const title = this.documentName?.trim() || 'document';
    const sanitizedTitle = title.replace( /[^a-zA-Z0-9-_ ]/g, '' ).replace( /\s+/g, '_' );
    const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${this.htmlContent}</body></html>`;
    const mimeType = format === 'doc' ? 'application/msword' : 'application/pdf';
    const extension = format === 'doc' ? 'doc' : 'pdf';
    const blob = new Blob( [htmlDoc], { type: mimeType } );
    const url = URL.createObjectURL( blob );

    const link = document.createElement( 'a' );
    link.href = url;
    link.download = `${sanitizedTitle}.${extension}`;
    document.body.appendChild( link );
    link.click();
    document.body.removeChild( link );
    URL.revokeObjectURL( url );
  }

  copyText (): void {
    try {
      const div = document.createElement( 'div' );
      div.innerHTML = this.htmlContent || '';
      const text = div.innerText || div.textContent || '';
      navigator.clipboard.writeText( text ).then( () => {
        this.notificationService.show( 'Copied', 'Document text copied to clipboard.', 'success' );
      }, ( error ) => {
        this.logger.error( 'Copy text failed:', error );
        this.notificationService.show( 'Copy Failed', 'Unable to copy text to clipboard.', 'error' );
      } );
    } catch ( error ) {
      this.logger.error( 'Copy text failed:', error );
      this.notificationService.show( 'Copy Failed', 'Unable to copy text to clipboard.', 'error' );
    }
  }

  @HostListener( 'window:resize', ['$event'] )
  onResize ( event: any ) {
    this.isSmallScreen = window.innerWidth < 992;
    this.isMobile = window.innerWidth < 768;
  }

  onClickRoute ( goto: string ) {
    const [path, fragment] = goto.split( '#' );
    this.router.navigate( [path], { fragment } );
  }

  onFileSelect ( event: Event ) {
    if ( !this.canCrudDocuments ) {
      this.notificationService.show( 'Upload Notice', 'You can explore Documents freely. Log in to upload a document.', 'warning' );
      this.error = this.crudDisabledReason;
      return;
    }

    const input = event.target as HTMLInputElement;
    if ( input.files && input.files.length > 0 ) {
      this.uploadFile( input.files[0] );
    }
  }

  onDrop ( event: DragEvent ) {
    event.preventDefault();
    if ( !this.canCrudDocuments ) {
      this.notificationService.show( 'Upload Notice', 'You can explore Documents freely. Log in to upload a document.', 'warning' );
      this.error = this.crudDisabledReason;
      return;
    }
    event.stopPropagation();
    this.removeDragData( event );
    if ( event.dataTransfer && event.dataTransfer.files.length > 0 ) {
      this.uploadFile( event.dataTransfer.files[0] );
    }
  }

  onDragOver ( event: DragEvent ) {
    event.preventDefault();
    event.stopPropagation();
    if ( !this.canCrudDocuments ) {
      return;
    }
    event.dataTransfer!.dropEffect = 'copy';
  }

  onDragLeave ( event: DragEvent ) {
    event.preventDefault();
    event.stopPropagation();
  }

  removeDragData ( event: DragEvent ) {
    if ( event.dataTransfer ) {
      event.dataTransfer.clearData();
    }
  }

  // Handles the file exactly the same way regardless of where the download
  // URL came from — a real Storage upload.
  private handleUploadedFile ( file: File, downloadURL: string ): void {
    this.downloadURL = downloadURL;
    this.isProcessing = false;

    const now = new Date().toISOString();
    const document: Document = {
      ...( this.currentDocument || {} ),
      id: this.docid || this.currentDocument?.id,
      src: downloadURL,
      name: file.name,
      title: this.documentName || file.name,
      type: 'document',
      recordKind: 'upload',
      uploadDate: now,
      createdAt: this.currentDocument?.createdAt || now,
      updatedAt: now,
      author: this.userId,
      ownerId: this.userId,
      mimeType: file.type || this.currentDocument?.mimeType,
      sizeBytes: file.size,
      htmlContent: this.htmlContent || this.currentDocument?.htmlContent || ''
    };
    this.logger.info( 'Document', document );

    const saveUploadedDocument = () => {
      const request$ = this.docid
        ? this.docService.updateDocument( this.docid, document, this.userId )
        : this.docService.createDocument( document, this.userId );

      request$.subscribe( {
        next: ( saved: Document ) => {
          const resolved = saved || document;
          this.currentDocument = { ...document, ...resolved };
          this.docid = this.currentDocument?.id || this.docid;
          this.documentName = this.currentDocument?.title || this.currentDocument?.name || this.documentName;
          this.downloadURL = this.currentDocument?.src || downloadURL;
          this.notificationService.show( 'Saved', 'Document uploaded.', 'success' );
          this.publishPageContext();
        },
        error: ( saveError ) => {
          this.logger.error( 'Error saving uploaded document metadata:', saveError );
          this.notificationService.show( 'Unable to Save', 'Document metadata could not be saved.', 'error' );
          this.publishPageContext();
        }
      } );
    };

    if ( file.name.endsWith( '.docx' ) ) {
      const reader = new FileReader();
      reader.onload = async () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const mammoth = await import( 'mammoth' );
        const result = await mammoth.convertToHtml( { arrayBuffer } );
        this.htmlContent = result.value;
        document.htmlContent = result.value;
        saveUploadedDocument();
      };
      reader.readAsArrayBuffer( file );
    } else {
      saveUploadedDocument();
    }
  }

  uploadFile ( file: File ) {
    if ( !this.canCrudDocuments ) {
      this.notificationService.show( 'Upload Notice', 'You can explore Documents freely. Log in to upload a document.', 'warning' );
      this.error = this.crudDisabledReason;
      return;
    }

    const folder = this.userId ? `documents/${this.userId}` : `documents`;

    try {
      const storageRef = ref( this.storage, `${folder}/${file.name}` );
      const uploadTask = uploadBytesResumable( storageRef, file );
      this.isProcessing = true;

      uploadTask.on( 'state_changed',
        ( snapshot ) => {
          this.uploadProgress = ( snapshot.bytesTransferred / snapshot.totalBytes ) * 100;
          this.publishPageContext();
        },
        ( error ) => {
          this.error = error.message;
          this.isProcessing = false;
          this.logger.error( 'Upload error:', error );
          this.publishPageContext();
        },
        () => {
          getDownloadURL( uploadTask.snapshot.ref ).then( ( downloadURL ) => {
            this.handleUploadedFile( file, downloadURL );
          } );
        }
      );
    } catch ( error ) {
      this.logger.error( "Error uploading file", error );
      this.publishPageContext();
    }
  }

  saveDraft () {
    if ( this.docid )
      this.updateDraft();
    else
      this.doSave();

  }

  doSave () {
    try {
      if ( !this.canCrudDocuments ) {
        this.notificationService.show( 'Save Notice', 'You can explore Documents freely. Log in to save your draft.', 'warning' );
        this.publishPageContext();
        return;
      }

      const now = new Date().toISOString();
      const document: Document = {
        ...( this.currentDocument || {} ),
        htmlContent: this.htmlContent,
        title: this.documentName || this.currentDocument?.title || 'Untitled Draft',
        name: this.documentName || this.currentDocument?.name || 'Untitled Draft',
        src: this.currentDocument?.src || '',
        type: this.currentDocument?.type || 'draft',
        createdAt: this.currentDocument?.createdAt || now,
        updatedAt: now,
        uploadDate: this.currentDocument?.uploadDate,
        author: this.userId,
        ownerId: this.userId,
        recordKind: this.currentDocument?.recordKind || 'draft',
        mimeType: this.currentDocument?.mimeType,
        sizeBytes: this.currentDocument?.sizeBytes
      };

      this.docService.createDocument( document, this.userId ).subscribe( {
        next: ( created: Document ) => {
          this.currentDocument = { ...document, ...( created || {} ) };
          this.docid = this.currentDocument?.id;
          this.downloadURL = this.currentDocument?.src || this.downloadURL;
          this.clearLocalDraft();
          this.notificationService.show( 'Saved', 'Draft saved.', 'success' );
          this.publishPageContext();
        },
        error: ( err ) => {
          this.logger.error( 'Failed to save draft:', err );
          this.notificationService.show( 'Unable to Save', 'Failed to save draft.', 'error' );
          this.publishPageContext();
        }
      } );
    } catch ( error ) {
      this.logger.error( 'Error Saving draft', error );
      this.publishPageContext();
    }
  }

  updateDraft () {
    try {
      if ( !this.canCrudDocuments || !this.docid ) {
        this.notificationService.show( 'Save Notice', 'You can explore Documents freely. Log in to update your draft.', 'warning' );
        this.publishPageContext();
        return;
      }

      const document: Document = {
        ...( this.currentDocument || {} ),
        id: this.docid,
        htmlContent: this.htmlContent,
        title: this.documentName || this.currentDocument?.title || 'Untitled Draft',
        name: this.documentName || this.currentDocument?.name || 'Untitled Draft',
        src: this.currentDocument?.src || '',
        type: this.currentDocument?.type || 'draft',
        author: this.userId,
        ownerId: this.userId,
        createdAt: this.currentDocument?.createdAt,
        updatedAt: new Date().toISOString(),
        uploadDate: this.currentDocument?.uploadDate,
        recordKind: this.currentDocument?.recordKind || 'draft',
        mimeType: this.currentDocument?.mimeType,
        sizeBytes: this.currentDocument?.sizeBytes
      };

      this.docService.updateDocument( this.docid, document, this.userId ).subscribe( {
        next: () => {
          this.currentDocument = { ...document };
          this.downloadURL = this.currentDocument?.src || this.downloadURL;
          this.clearLocalDraft();
          this.notificationService.show( 'Updated', 'Draft updated.', 'success' );
          this.publishPageContext();
        },
        error: ( err ) => {
          this.logger.error( 'Failed to update draft:', err );
          this.notificationService.show( 'Unable to Update', 'Failed to update draft.', 'error' );
          this.publishPageContext();
        }
      } );
    } catch ( error ) {
      this.logger.error( 'Error updating draft', error );
      this.publishPageContext();
    }
  }

  setInstruction ( text: string ) {
    this.instructionText = text;
    this.publishPageContext();
  }

  runToddInstruction () {
    this.publishPageContext();
    if ( !this.instructionText.trim() ) return;
    this.isToddWorking = true;
    const html = this.htmlContent || '';

    // Call OpenAI service to transform the current doc
    this.openaiService
      .documentEditorAssistant( this.instructionText, html, this.userId )
      .pipe( take( 1 ) )
      .subscribe( {
        next: ( res: any ) => {
          // New backend returns { response: { html, notes, mode } }.
          // Also support legacy shapes (raw string / {content}/{result}).
          const payload = ( res && res.response ) ? res.response : res;
          const outHtml = payload?.html ?? payload?.content ?? payload?.result ?? ( typeof payload === 'string' ? payload : '' );

          this.toddPreview = typeof outHtml === 'string' ? outHtml : '';
          this.isToddWorking = false;

          // Optional helper note from backend
          if ( payload?.notes ) {
            this.notificationService.show( 'TODD', payload.notes, 'success' );
          }

          if ( !this.toddPreview ) {
            this.notificationService.show( 'No Changes', 'TODD did not return content.', 'warning' );
          }
          this.publishPageContext();
        },
        error: ( err ) => {
          this.isToddWorking = false;
          this.logger.error( 'TODD document transform failed', err );
          this.notificationService.show( 'Unable to Transform', 'There was a problem applying your instruction.', 'error' );
          this.publishPageContext();
        }
      } );
  }

  applyToddPreview () {
    if ( !this.toddPreview ) return;
    this.htmlContent = this.toddPreview;
    this.toddPreview = null;
    this.instructionText = '';
    // Persist locally so a reload won’t lose changes
    this.persistLocalDraft();
    this.publishPageContext();

  }

  discardToddPreview () {
    this.toddPreview = null;
    this.publishPageContext();
  }

  @HostListener( 'window:beforeunload' )
  onBeforeUnload () {
    this.persistLocalDraft();
  }

  private publishPageActions (): void {
    this.pageActionsService.setPageActions( {
      pageId: 'document-editor',
      context: {
        pageId: 'document-editor',
        feature: 'documents',
        entityType: 'document',
        entityId: this.docid || this.currentDocument?.id || ''
      },
      actions: this.buildPageActions()
    } );
  }

  private buildPageActions (): PageAction[] {
    return [
      {
        id: 'document-editor-save',
        label: this.docid ? 'Update Document' : 'Save Document',
        icon: 'fa-solid fa-floppy-disk',
        kind: 'callback',
        handler: () => this.docid ? this.updateDraft() : this.saveDraft(),
        disabled: () => !this.canCrudDocuments || this.isProcessing,
        order: 10,
        group: 'context'
      },
      {
        id: 'document-editor-response-flow',
        label: 'Response Flow',
        icon: 'fa-solid fa-layer-group',
        kind: 'route',
        route: '/knowledge/response-flow',
        order: 20,
        group: 'context'
      },
      {
        id: 'document-editor-proposal-history',
        label: 'Proposal History',
        icon: 'fa-solid fa-clock-rotate-left',
        kind: 'route',
        route: '/docs/proposal-history',
        order: 30,
        group: 'context'
      },
      {
        id: 'document-editor-rfp-upload',
        label: 'RFP Upload',
        icon: 'fa-solid fa-upload',
        kind: 'route',
        route: '/docs/rfp-upload',
        order: 40,
        group: 'context'
      },
      {
        id: 'document-editor-rfps',
        label: 'RFPs',
        icon: 'fa-solid fa-folder-open',
        kind: 'route',
        route: '/docs/rfp-list',
        order: 50,
        group: 'context'
      },
    ];
  }

}
