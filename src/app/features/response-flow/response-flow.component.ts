import { Component, ElementRef, ViewChild, OnInit, OnDestroy, AfterViewInit, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Document } from '../../models/document.model';
import { DocsAssistantSignalService } from '../../services/docs-assistant-signal.service';

import { ActivatedRoute, Router } from '@angular/router';
import { DocService } from '../../services/doc.service';
import { DocsAuthService } from '../../services/docs-auth.service';
import { LoggerService } from '../../services/logger.service';
import { SoundService } from '../../services/sound.service';

import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { TruncatePipe } from '../../pipes/truncate.pipe';
import { ResourceWhyPipe } from '../../pipes/resource-why.pipe';
import { DomainPipe } from '../../pipes/domain.pipe';
import { FaviconPipe } from '../../pipes/favicon.pipe';
import { ToddTipComponent } from '../../shared/todd-tip/todd-tip.component';
import { DocsTipService } from '../../services/docs-tip.service';
import { Subscription, combineLatest } from 'rxjs';
import { DocsInputTypeAheadComponent } from '../../shared/docs-input-type-ahead/docs-input-type-ahead.component';
import { Dropdown } from '../../models/dropdown.model';
import { DocsDropdownEditButtonComponent } from '../../shared/docs-dropdown-edit-button/docs-dropdown-edit-button.component';
import { DocsNotificationService } from '../../services/docs-notification.service';

import { ResponseFlowService } from '../../services/response-flow.service';
import { DocsPageActionsService } from '../../services/docs-page-actions.service';
import { buildDocumentPageActions } from '../../shared/utils/page-action-presets';
import { ClickSoundDirective } from '../../shared/directives/click-sound.directive';
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';

export interface Recommendation {
  text: string;
  link: string;
  type: string;
  document?: Document;
}

export interface Resource {
  link: string;
  document?: Document;
}

export interface Answer {
  answer: string;
  source: string;
  document?: any;
}

export interface ResponseFlow {
  id?: string;
  question: string;
  category: string;
  answers: Answer[];
  recommendations: any[];
  resources: any[];
  keywords: string[]; // NEW
  mayaReference: boolean;
}

/**
 * Ported from features/knowledge/response-flow/response-flow.component.ts -
 * the multi-step Knowledge Base entry wizard (question -> response ->
 * recommendation -> resource -> keywords), preview pane, and citation
 * copy. This is the third and last direct-to-Firebase-Storage upload
 * component - path `documents/${userId}/${file.name}` preserved exactly.
 *
 * Drops TopDogComponent inheritance in favor of the plain auth-context-
 * watching pattern used throughout this app's other ported components
 * (combineLatest over tenantId/userId/isLoggedIn), and
 * ToddAssistantBusService's signalState$/emitAssistantActivity calls
 * (this app doesn't carry TODD's assistant bus).
 *
 * Two data-path adaptations, same reasoning as the Docs pages ported
 * earlier: `DataService.getCollectionData('DOCUMENTS', ...)` ->
 * `DocService.getDocuments(...)`, and `DataService.getDocument
 * ('RESPONSE_FLOW', id, ownerId)` -> `ResponseFlowService.getResponseFlow(id)`
 * (already ported, same `${backendURL}/response-flows` REST endpoint the
 * monorepo's own ResponseFlowService hits).
 *
 * `turnIntoPost()` navigated to `/outreach/social` in the monorepo - a
 * different product this app doesn't host - so it now opens that route on
 * the shared TODD app instead of a dead internal link.
 */
@Component( {
  selector: 'app-response-flow',
  imports: [CommonModule, FormsModule,
    BackToTopComponent,
    PreloaderComponent,
    TruncatePipe,
    ResourceWhyPipe,
    DomainPipe,
    FaviconPipe,
    ToddTipComponent,
    DocsInputTypeAheadComponent,
    DocsDropdownEditButtonComponent,
    ClickSoundDirective,
    CockpitBrowseModeBannerComponent
  ],
  templateUrl: './response-flow.component.html',
  styleUrl: './response-flow.component.css'
} )
export class ResponseFlowComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly pageActionsService = inject( DocsPageActionsService );

  uploadProgress: number | null = null;
  downloadURL: string | null = null;
  error: string | null = null;
  selectedFile: File | null = null;
  storage = getStorage();

  private authContextSubscription!: Subscription;
  documents: Document[] = [];
  @ViewChild( 'fileInput' ) fileInput!: ElementRef<HTMLInputElement>;

  isSmallScreen: boolean = window.innerWidth < 992;
  entryMode: 'create' | 'edit' | 'assistantSaved' = 'create';
  cameFromAssistant = false;
  selectedDocument: Document | null = null;

  responseFlow: ResponseFlow = {
    question: '',
    category: '',
    answers: [],
    recommendations: [],
    resources: [],
    keywords: [],
    mayaReference: false
  };

  currentStep = 0;
  steps = ['Question', 'Response', 'Resource', 'Keywords'];

  question!: string;
  answers: Answer[] = [];
  sourceLink = '';
  kbcategory = '';
  recommendations: Recommendation[] = [];
  resources: Resource[] = [];

  newAnswer = '';
  recommendationText = '';
  recommendationLink = '';
  recommendationType = '';
  resourceLink = '';

  // Keywords capture
  keywords: string[] = [];
  keywordInput = '';

  // When checked, Maya treats this entry as internal reference material -
  // used in her own planning/conversation reasoning, not just shown to
  // customers as a public FAQ answer.
  mayaReference = false;

  uploadedDocument!: Document;

  today = new Date();

  docTipText: string = '';

  userId: string | null = null;
  tenantId: string = '';
  isLoggedIn = false;
  isLoading = false;

  get isAssistantSavedMode (): boolean {
    return this.entryMode === 'assistantSaved';
  }

  get isEditMode (): boolean {
    return this.entryMode === 'edit';
  }

  get isCreateMode (): boolean {
    return this.entryMode === 'create';
  }

  get currentStepLabel (): string {
    return this.steps[this.currentStep] || 'Question';
  }

  get mobileWizardTitle (): string {
    return this.isAssistantSavedMode ? 'Knowledge Wizard' : 'Knowledge Management';
  }

  get mobileWizardSubtitle (): string {
    if ( this.isAssistantSavedMode ) {
      return 'Saved to the Knowledge Base. Add details to help TODD find and reuse it later.';
    }

    if ( this.isEditMode ) {
      return 'Update this Knowledge Base answer and improve how TODD reuses it later.';
    }

    return 'Turn common questions into reusable responses for your Knowledge Base.';
  }

  get shouldShowCompactMobileHeader (): boolean {
    return this.isSmallScreen;
  }

  get shouldShowDesktopIntro (): boolean {
    return !this.isSmallScreen;
  }

  @HostListener( 'window:resize' )
  onWindowResize (): void {
    this.isSmallScreen = window.innerWidth < 992;
  }

  goBackOrPreviousStep (): void {
    if ( this.currentStep > 0 ) {
      this.prevStep();
      return;
    }

    this.router.navigate( ['/knowledge'] );
  }

  turnIntoPost (): void {
    if ( !this.responseFlow.id ) {
      this.notificationService.show( 'Save First', 'Save this knowledge item before turning it into a social post.', 'warning' );
      return;
    }

    const params = new URLSearchParams( {
      sourceType: 'response-flow',
      sourceId: this.responseFlow.id,
      title: this.question || this.responseFlow.question || ''
    } );
    window.location.href = `https://todd.taliferro.tech/outreach/social?${params.toString()}`;
  }


  constructor (
    private authService: DocsAuthService,
    private soundService: SoundService,
    private logger: LoggerService,
    private router: Router,
    private tipService: DocsTipService,
    private responseFlowService: ResponseFlowService,
    private route: ActivatedRoute,
    private docService: DocService,
    private assistantBus: DocsAssistantSignalService,
    private notificationService: DocsNotificationService ) { }

  ngOnInit (): void {
    this.docTipText = this.tipService.getRandomTipText( 'documents', 'response-flow' );

    this.authContextSubscription = combineLatest( [
      this.authService.getTenantId(),
      this.authService.getUserId(),
      this.authService.isLoggedIn(),
    ] ).subscribe( ( [tenantId, userId, isLoggedIn] ) => {
      this.tenantId = tenantId || '';
      this.userId = userId || null;
      this.isLoggedIn = isLoggedIn;
      this.setupPage();
    } );
  }

  ngAfterViewInit (): void {
    window.scrollTo( 0, 0 );

  }

  ngOnDestroy (): void {
    this.authContextSubscription?.unsubscribe();
    this.pageActionsService.clearPageActions( 'response-flow' );

  }

  toggleSelection () {
    this.soundService.playSound( "toggleOn" );
  }

  saveClick () {
    this.soundService.playSound( "finished" );
  }


  setupPage () {
    this.publishPageActions();
    if ( !this.userId ) {
      this.documents = [];
      this.publishPageContext();
      return;
    }

    this.docService.getDocuments( this.userId ).subscribe( ( data: any[] ) => {
      const sorted = ( data || [] ).slice().sort( ( a: any, b: any ) => {
        const aVal = typeof a === 'string' ? a : ( a?.name ?? '' );
        const bVal = typeof b === 'string' ? b : ( b?.name ?? '' );
        return aVal.localeCompare( bVal, undefined, { sensitivity: 'base' } );
      } );
      this.documents = sorted;
      this.publishPageContext();
    } );

    this.route.queryParams.subscribe( params => {
      const id = params['id'];
      const from = params['from'];
      const mode = params['mode'];

      this.cameFromAssistant = from === 'assistant';

      if ( id ) {
        this.entryMode = mode === 'assistantSaved' || this.cameFromAssistant ? 'assistantSaved' : 'edit';
        this.logger.info( 'ResponseFlow: opening existing knowledge item', {
          id,
          mode: this.entryMode === 'assistantSaved' ? 'edit' : this.entryMode,
          from
        } );
        this.loadExistingResponseFlow( id );
      } else {
        this.entryMode = 'create';
        this.publishPageContext();
      }
    } );
  }

  private publishPageContext (): void {
    this.assistantBus.setPageContext( {
      feature: 'documents',
      page: 'response-flow',
      route: this.router.url,
      mode: this.entryMode === 'assistantSaved' ? 'edit' : this.entryMode,
      title: this.isAssistantSavedMode
        ? 'Question Wizard'
        : ( this.responseFlow.id ? 'Edit Response Flow' : 'Create Response Flow' ),
      description: this.isAssistantSavedMode
        ? 'This answer is already saved. Add category, resources, and keywords to help TODD reuse it later.'
        : 'Create or edit a reusable response flow with answers, resources, recommendations, and keywords.',
      allowedActions: [
        'save_response_flow',
        'add_answer',
        'add_recommendation',
        'add_resource',
        'add_keyword',
        'upload_document'
      ],
      selectedEntityType: 'response-flow',
      selectedEntityId: this.responseFlow.id || '',
      summary: {
        isAuthenticated: this.isLoggedIn,
        interactionMode: this.isLoggedIn ? 'member' : 'guest',
        currentStep: this.currentStep,
        stepLabel: this.currentStepLabel,
        hasQuestion: !!this.question,
        hasCategory: !!this.kbcategory,
        answerCount: this.answers.length,
        recommendationCount: this.recommendations.length,
        resourceCount: this.resources.length,
        keywordCount: this.keywords.length,
        documentCount: this.documents.length,
        hasSelectedDocument: !!this.selectedDocument,
        hasSelectedFile: !!this.selectedFile
      },
      dataPreview: {
        question: this.question || '',
        category: this.kbcategory || '',
        selectedDocumentName: this.selectedDocument?.name || '',
        selectedFileName: this.selectedFile?.name || ''
      }
    } );
  }

  nextStep () {
    if ( this.currentStep < this.steps.length - 1 ) {
      this.currentStep++;
      this.publishPageContext();
      window.scrollTo( 0, 0 );
    }
  }

  prevStep () {
    if ( this.currentStep > 0 ) {
      this.currentStep--;
      this.publishPageContext();
      window.scrollTo( 0, 0 );
    }
  }

  hasPreviewData (): boolean {
    return !!(
      ( this.answers && this.answers.length > 0 ) ||
      this.question ||
      ( this.recommendations && this.recommendations.length > 0 ) ||
      ( this.resources && this.resources.length > 0 ) ||
      ( this.keywords && this.keywords.length > 0 ) // NEW
    );
  }

  handleCategoryChange ( selected: Dropdown ): void {
    this.kbcategory = selected.name;
    this.publishPageContext();
  }

  private loadExistingResponseFlow ( id: string ) {

    try {
      this.isLoading = true;

      this.responseFlowService.getResponseFlow( id ).subscribe( ( doc: any ) => {
        if ( !doc ) {
          this.logger.warn( 'ResponseFlow: no document found for id', id );
          this.isLoading = false;
          this.publishPageContext();
          return;
        }

        // Normalize into our ResponseFlow model
        this.responseFlow = {
          id,
          question: doc.question || '',
          category: doc.category || '',
          answers: doc.answers || [],
          recommendations: doc.recommendations || [],
          resources: doc.resources || [],
          keywords: doc.keywords || [],
          mayaReference: doc.mayaReference === true
        };

        // Populate bound fields so the UI shows current values
        this.question = this.responseFlow.question;
        this.answers = ( this.responseFlow.answers || [] ).slice();
        this.recommendations = ( this.responseFlow.recommendations || [] ).slice();
        this.resources = ( this.responseFlow.resources || [] ).slice();
        this.keywords = ( this.responseFlow.keywords || [] ).slice();
        this.kbcategory = this.responseFlow.category;
        this.mayaReference = this.responseFlow.mayaReference;

        if ( this.entryMode !== 'assistantSaved' ) {
          this.entryMode = 'edit';
        }

        this.logger.info( 'ResponseFlow: loaded existing item for edit', this.responseFlow );
        this.isLoading = false;
        this.publishPageContext();
      } );
    } catch ( error ) {
      this.logger.error( 'ResponseFlow: failed to load existing item', error );
      this.isLoading = false;
      this.notificationService.show( 'Error', 'Could not load knowledge item for editing.', 'error' );
      this.publishPageContext();
    }
  }


  submitFlow () {
    this.publishPageContext();

    if ( !this.userId ) {
      this.notificationService.show(
        'Save Notice',
        'You can explore Response Flows freely. Log in to save a knowledge entry.',
        'warning'
      );
      return;
    }

    this.responseFlow.question = this.question;
    this.responseFlow.answers = this.answers;
    this.responseFlow.recommendations = this.recommendations;
    this.responseFlow.resources = this.resources;
    this.responseFlow.keywords = this.keywords;
    this.responseFlow.category = this.kbcategory;
    this.responseFlow.mayaReference = this.mayaReference;
    this.processData();
  }

  processData () {
    if ( !this.userId ) {
      this.notificationService.show(
        'Save Notice',
        'You can explore Response Flows freely. Log in to save a knowledge entry.',
        'warning'
      );
      return;
    }
    if ( this.responseFlow.id ) {
      // If record exists, update via backend API
      this.responseFlowService.updateResponseFlow( this.responseFlow.id, this.responseFlow )
        .subscribe( {
          next: () => {
            this.isLoading = false;
            this.notificationService.show( "Updated!", this.isAssistantSavedMode ? 'Knowledge Base answer updated.' : 'Response Flow ' + this.responseFlow.id + ' updated.', 'success' );
            this.resetForm();
          },
          error: () => {
            this.isLoading = false;
            this.notificationService.show( "Error!", 'Response Flow record: ' + this.responseFlow.id + ' failed to update.', 'error' );
          }
        } );
    } else {
      // If record does not exist, create via backend API
      this.responseFlowService.createResponseFlow( this.responseFlow )
        .subscribe( {
          next: ( res: any ) => {
            this.isLoading = false;
            this.notificationService.show( "Added!", 'Knowledge Base answer saved.', 'success' );
            this.resetForm();
          },
          error: ( error ) => {
            this.logger.error( 'Error adding Response Flow:', error );
            this.isLoading = false;
            this.notificationService.show( "Error!", 'Failed adding record.', 'error' );
          }
        } );
    }
  }

  async addRecommendation ( text: string, link: string, type: string ) {
    const trimmedText = text?.trim() || '';
    const trimmedType = type?.trim() || '';
    const trimmedLink = link?.trim() || '';
    if ( !trimmedText || !trimmedType ) {
      this.notificationService.show( 'Missing info', 'Provide both recommendation text and a type.', 'warning' );
      return;
    }

    let attachedDoc: Document | undefined;

    if ( this.selectedFile ) {
      try {
        attachedDoc = await this.uploadFile( this.selectedFile );
        this.clearSelectedFile();
      } catch ( err ) {
        this.logger.error( 'Upload failed in addAnswer:', err );
        this.notificationService.show( 'Error!', 'File upload failed. Try again.', 'error' );
        return;
      }
    }
    if ( !attachedDoc && this.selectedDocument ) {
      attachedDoc = this.selectedDocument;
    }

    const recommendation: Recommendation = {
      text: trimmedText,
      link: trimmedLink,
      type: trimmedType,
      document: attachedDoc
    };

    this.recommendations.push( recommendation );
    this.selectedDocument = null;
    this.publishPageContext();
  }


  async addResource ( link: string ) {
    const trimmedLink = link?.trim() || '';
    if ( !trimmedLink ) {
      this.notificationService.show( 'Missing info', 'Provide resource link.', 'warning' );
      return;
    }

    let attachedDoc: Document | undefined;

    if ( this.selectedFile ) {
      try {
        attachedDoc = await this.uploadFile( this.selectedFile );
        this.clearSelectedFile();
      } catch ( err ) {
        this.logger.error( 'Upload failed in addAnswer:', err );
        this.notificationService.show( 'Error!', 'File upload failed. Try again.', 'error' );
        return;
      }
    }
    if ( !attachedDoc && this.selectedDocument ) {
      attachedDoc = this.selectedDocument;
    }

    const resource: Resource = {
      link: trimmedLink,
      document: attachedDoc
    };

    this.resources.push( resource );
    this.selectedDocument = null;
    this.publishPageContext();
  }

  removeAnswer ( index: number ): void {
    if ( index > -1 && index < this.answers.length ) {
      this.answers.splice( index, 1 );
      this.soundService?.playSound( 'click' );
    }
  }

  removeRecommendation ( index: number ): void {
    if ( index > -1 && index < this.recommendations.length ) {
      this.recommendations.splice( index, 1 );
      this.publishPageContext();
      this.soundService?.playSound( 'click' );
    }
  }

  removeResource ( index: number ): void {
    if ( index > -1 && index < this.resources.length ) {
      this.resources.splice( index, 1 );
      this.publishPageContext();
      this.soundService?.playSound( 'click' );
    }
  }

  async addAnswer ( text: string, source: string ) {
    const trimmedText = text?.trim() || '';
    const trimmedSource = source?.trim() || '';

    if ( !trimmedText || !trimmedSource ) {
      this.notificationService.show( 'Missing info', 'Provide both answer text and a source.', 'warning' );
      return;
    }

    let attachedDoc: Document | undefined;

    if ( this.selectedFile ) {
      try {
        attachedDoc = await this.uploadFile( this.selectedFile );
        this.clearSelectedFile();
      } catch ( err ) {
        this.logger.error( 'Upload failed in addAnswer:', err );
        this.notificationService.show( 'Error!', 'File upload failed. Try again.', 'error' );
        return;
      }
    }
    if ( !attachedDoc && this.selectedDocument ) {
      attachedDoc = this.selectedDocument;
    }

    const answer: Answer = {
      answer: trimmedText,
      source: trimmedSource,
      document: attachedDoc
    };

    this.answers.push( answer );
    this.selectedDocument = null;

    // reset form fields bound in the template if applicable
    this.newAnswer = '';
    this.sourceLink = '';
    this.soundService?.playSound( 'click' );
    this.publishPageContext();
  }

  addKeywordFromInput (): void {
    const value = ( this.keywordInput || '' ).trim();
    if ( !value ) return;
    const parts = value.split( ',' ).map( p => p.trim() ).filter( Boolean );
    parts.forEach( p => this.addKeyword( p ) );
    this.keywordInput = '';
  }

  addKeyword ( raw: string ): void {
    const k = raw.trim().toLowerCase();
    if ( !k ) return;
    if ( !this.keywords.includes( k ) ) {
      this.keywords.push( k );
      this.soundService?.playSound( 'click' );
      this.publishPageContext();
    }
  }

  removeKeyword ( index: number ): void {
    if ( index > -1 && index < this.keywords.length ) {
      this.keywords.splice( index, 1 );
      this.publishPageContext();
      this.soundService?.playSound( 'click' );
    }
  }

  clearSelectedFile (): void {
    this.selectedFile = null;

    try {
      if ( this.fileInput && this.fileInput.nativeElement ) {
        this.fileInput.nativeElement.value = '';
      }
    } catch ( error ) {
      this.logger.error( error );
    }

  }



  onFileSelect ( event: Event ): void {
    const input = event.target as HTMLInputElement;
    if ( input.files && input.files.length > 0 ) {
      this.selectedFile = input.files[0];

      this.error = null; // Clear any previous error message
      this.soundService.playSound( "click" );
      this.publishPageContext();
    }
  }

  onDrop ( event: DragEvent ): void {
    event.preventDefault();
    event.stopPropagation();
    this.removeDragData( event );
    if ( event.dataTransfer && event.dataTransfer.files.length > 0 ) {
      this.selectedFile = event.dataTransfer.files[0];
      this.error = null; // Clear any previous error message
      this.publishPageContext();
    }
  }

  onDragOver ( event: DragEvent ): void {
    event.preventDefault();
    event.stopPropagation();
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

  uploadFile ( file: File ): Promise<Document> {
    return new Promise( ( resolve, reject ) => {
      const folder = this.userId ? `documents/${this.userId}` : `documents`;
      const storageRef = ref( this.storage, `${folder}/${file.name}` );
      const uploadTask = uploadBytesResumable( storageRef, file );
      this.isLoading = true;
      this.error = null; // Clear any previous error message

      uploadTask.on( 'state_changed',
        ( snapshot ) => {
          this.uploadProgress = ( snapshot.bytesTransferred / snapshot.totalBytes ) * 100;
        },
        ( error ) => {
          this.error = 'Upload failed: ' + error.message;
          this.isLoading = false;
          this.logger.error( 'Upload error:', error );
          reject( error );
        },
        () => {
          getDownloadURL( uploadTask.snapshot.ref ).then( ( downloadURL ) => {
            this.downloadURL = downloadURL;
            this.isLoading = false;

            const uploadDate = new Date().toISOString();
            const documentType = this.determineFileType( file );
            const document: Document = {
              src: downloadURL,
              name: file.name,
              type: documentType,
              uploadDate: uploadDate,
              author: this.userId || undefined,
            };
            this.uploadedDocument = document;
            resolve( document );
          } ).catch( ( error ) => {
            this.error = 'Failed to get download URL: ' + error.message;
            this.isLoading = false;
            this.logger.error( 'Error getting download URL:', error );
            reject( error );
          } );
        }
      );
    } );
  }

  private determineFileType ( file: File ): 'document' | 'image' | 'video' {
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
        return 'image';
      case 'mp4':
      case 'mov':
      case 'avi':
      case 'mkv':
      case 'flv':
      case 'wmv':
        return 'video';
      default:
        return 'document';
    }
  }

  private domainFrom ( url?: string ): string {
    if ( !url ) return '';
    try { return new URL( url ).hostname.replace( 'www.', '' ); } catch { return url || ''; }
  }

  formatCitation ( a: Answer ): string {
    const src = a?.source || '';
    const domain = this.domainFrom( src );
    const accessed = new Date().toISOString().slice( 0, 10 );
    return `${a.answer} Source: ${domain}. ${src} (accessed ${accessed}).`;
  }

  async copyCitation ( a: Answer ) {
    this.publishPageContext();
    const text = this.formatCitation( a );
    try {
      await navigator.clipboard.writeText( text );
      this.notificationService.show( 'Copied', 'Citation copied to clipboard.', 'success' );
    } catch {
      this.notificationService.show( 'Copy failed', 'Could not copy citation.', 'warning' );
    }
  }

  resetForm () {
    try {
      this.question = '';
      this.answers = [];
      this.sourceLink = '';
      this.recommendations = [];
      this.resources = [];

      this.newAnswer = '';
      this.recommendationText = '';
      this.recommendationLink = '';
      this.recommendationType = '';
      this.resourceLink = '';

      this.currentStep = 0;
      this.entryMode = 'create';
      this.cameFromAssistant = false;

      this.keywords = [];
      this.keywordInput = '';
      this.mayaReference = false;
      this.clearSelectedFile();
    } catch ( error ) {
      this.logger.error( error );
    }
  }

  private publishPageActions (): void {
    this.pageActionsService.setPageActions( {
      pageId: 'response-flow',
      context: {
        pageId: 'response-flow',
        feature: 'knowledge-base',
        mode: this.entryMode,
      },
      actions: buildDocumentPageActions( {
        includeMenuEditor: true,
      } ),
    } );
  }

}
