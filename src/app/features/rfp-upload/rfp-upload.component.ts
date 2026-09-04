import { Component, ViewChild, ElementRef, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { LoggerService } from '../../services/logger.service';
import { Subscription } from 'rxjs';
import { DocsAuthService } from '../../services/docs-auth.service';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Document } from '../../models/document.model';

import { DocService } from '../../services/doc.service';
import { ToddTipComponent } from '../../shared/todd-tip/todd-tip.component';
import { DocsTipService } from '../../services/docs-tip.service';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { DocsPageActionsService } from '../../services/docs-page-actions.service';
import { PageAction } from '../../models/page-actions.models';
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';

/**
 * Ported from features/document/rfp-upload-component/rfp-upload-component.component.ts.
 * Third and last of the direct-to-Firebase-Storage upload components -
 * path `rfps/${userId}/${file.name}` preserved exactly.
 *
 * `DataService.addDocument('DOCUMENTS', ...)` replaced with
 * `DocService.createDocument(...)`, same reasoning as
 * ProposalHistoryComponent/RfpListComponent. Post-submit redirect target
 * fixed from the bare `['rfp-list']` (a relative navigation that wouldn't
 * resolve to a real route from here) to the actual `/docs/rfp-list` route.
 */
@Component( {
  selector: 'app-rfp-upload',
  templateUrl: './rfp-upload.component.html',
  styleUrls: ['./rfp-upload.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, ToddTipComponent, ReactiveFormsModule, PreloaderComponent, BackToTopComponent, CockpitBrowseModeBannerComponent]
} )
export class RfpUploadComponent implements OnInit, OnDestroy {
  rfpForm: FormGroup;
  selectedFile: File | null = null;

  @ViewChild( 'fileInput' ) fileInput!: ElementRef<HTMLInputElement>;

  isMobile: boolean = window.innerWidth < 768; // Initialize based on current width
  isSmallScreen: boolean = window.innerWidth < 992;
  isProcessing: boolean = true;

  storage = getStorage();
  uploadProgress: number | null = null;
  downloadURL: string | null = null;
  error: string | null = null;
  docTipText: string = '';

  userId: string | null = null;

  private userSubscription!: Subscription;

  get canUploadRfps (): boolean {
    return !!this.userId;
  }

  constructor (
    private fb: FormBuilder,
    private notificationService: DocsNotificationService,
    private router: Router,
    private tipService: DocsTipService,
    private logger: LoggerService,
    private authService: DocsAuthService,
    private docService: DocService,
    private pageActionsService: DocsPageActionsService
  ) {
    this.rfpForm = this.fb.group( {
      author: ['', Validators.required],
      title: ['', Validators.required],
      dueDate: ['', Validators.required],
      topic: ['']
    } );
  }

  ngOnInit (): void {
    this.setUpUserID();
    this.docTipText = this.tipService.getRandomTipText( 'documents' );
    this.publishPageActions();

  }

  ngOnDestroy (): void {
    if ( this.userSubscription )
      this.userSubscription.unsubscribe();
    this.pageActionsService.clearPageActions( 'rfp-upload' );
  }

  setUpUserID (): void {
    this.userSubscription = this.authService.getUserId().subscribe( userId => {
      this.userId = userId || null;
      this.isProcessing = false;

    } );
  }



  onFileChange ( event: Event ) {
    const input = event.target as HTMLInputElement;
    if ( input.files && input.files.length > 0 ) {
      this.selectedFile = input.files[0];
    }
  }

  submitRfp () {
    if ( !this.canUploadRfps ) {
      this.notificationService.show( 'Sign In Required', 'Sign in to upload and save RFPs.', 'warning' );
      return;
    }

    this.isProcessing = true;
    if ( this.rfpForm.valid && this.downloadURL ) {
      this.logger.info( "Upload Submit" );
      const document: Document = {
        src: this.downloadURL,
        name: this.selectedFile?.name || 'Untitled RFP',
        type: 'rfp',
        uploadDate: new Date().toISOString(),
        author: this.rfpForm.get( 'author' )?.value,
        title: this.rfpForm.get( 'title' )?.value,
        dueDate: this.rfpForm.get( 'dueDate' )?.value,
        topic: this.rfpForm.get( 'topic' )?.value,
      };

      this.docService.createDocument( document, this.userId || undefined ).subscribe( {
        next: ( created: any ) => {
          this.isProcessing = false;
          this.logger.info( "Upload Saved" );
          this.notificationService.show( "RFP Submitted", 'Document saved with ID: ' + ( created?.id || '' ), 'success' );
          this.rfpForm.reset();
          this.selectedFile = null;
          this.downloadURL = null;
          this.uploadProgress = null;
          if ( this.fileInput ) {
            this.fileInput.nativeElement.value = '';
          }
          setTimeout( () => {
            this.router.navigate( ['/docs/rfp-list'] );
          }, 6000 );
        },
        error: ( err ) => {
          this.isProcessing = false;
          this.logger.error( 'Failed to submit RFP:', err );
          this.notificationService.show( "Submission Error", 'Failed to submit RFP: ' + err, 'error' );
        }
      } );
    } else {
      this.isProcessing = false;
      this.logger.warn( 'Form is invalid or upload URL is missing' );
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
    const input = event.target as HTMLInputElement;
    if ( input.files && input.files.length > 0 ) {
      this.uploadFile( input.files[0] );
    }
  }

  onDrop ( event: DragEvent ) {
    event.preventDefault();
    event.stopPropagation();
    this.removeDragData( event );
    if ( event.dataTransfer && event.dataTransfer.files.length > 0 ) {
      this.uploadFile( event.dataTransfer.files[0] );
    }
  }

  onDragOver ( event: DragEvent ) {
    event.preventDefault();
    event.stopPropagation();
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

  uploadFile ( file: File ) {
    if ( !this.canUploadRfps ) {
      this.notificationService.show( 'Sign In Required', 'Sign in to upload RFPs.', 'warning' );
      return;
    }

    const folder = this.userId ? `rfps/${this.userId}` : `rfps`;
    const storageRef = ref( this.storage, `${folder}/${file.name}` );
    const uploadTask = uploadBytesResumable( storageRef, file );
    this.isProcessing = true;

    uploadTask.on( 'state_changed',
      ( snapshot ) => {
        this.uploadProgress = ( snapshot.bytesTransferred / snapshot.totalBytes ) * 100;
      },
      ( error ) => {
        this.error = error.message;
        this.isProcessing = false;
        this.logger.error( 'Upload error:', error );
      },
      () => {
        getDownloadURL( uploadTask.snapshot.ref ).then( ( downloadURL ) => {
          this.downloadURL = downloadURL;
          this.isProcessing = false;

          const uploadDate = new Date().toISOString();
          const document: Document = {
            src: downloadURL,
            name: file.name,
            type: 'document',
            uploadDate: uploadDate,
          };

          this.notificationService.show( "Upload Complete", 'Document located at ' + downloadURL, 'success' );
          this.logger.info( "Doucment Download", document );
        } );
      }
    );
  }

  private publishPageActions (): void {
    this.pageActionsService.setPageActions( {
      pageId: 'rfp-upload',
      context: {
        pageId: 'rfp-upload',
        feature: 'documents',
        entityType: 'rfp',
      },
      actions: this.buildPageActions(),
    } );
  }

  private buildPageActions (): PageAction[] {
    return [
      {
        id: 'rfp-upload-submit',
        label: 'Upload RFP',
        icon: 'fa-solid fa-cloud-arrow-up',
        kind: 'callback',
        handler: () => this.submitRfp(),
        disabled: () => this.rfpForm.invalid || !this.downloadURL || this.isProcessing,
        order: 10,
        group: 'context',
      },
      {
        id: 'rfp-upload-editor',
        label: 'Editor',
        icon: 'fa-solid fa-file-lines',
        kind: 'route',
        route: '/docs/editor',
        order: 20,
        group: 'context',
      },
      {
        id: 'rfp-upload-history',
        label: 'History',
        icon: 'fa-solid fa-clock-rotate-left',
        kind: 'route',
        route: '/docs/proposal-history',
        order: 30,
        group: 'context',
      },
      {
        id: 'rfp-upload-rfps',
        label: 'RFPs',
        icon: 'fa-solid fa-folder-open',
        kind: 'route',
        route: '/docs/rfp-list',
        order: 40,
        group: 'context',
      },
    ];
  }
}
