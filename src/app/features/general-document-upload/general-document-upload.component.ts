import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { getDownloadURL, getStorage, ref, uploadBytesResumable } from 'firebase/storage';
import { Subscription, combineLatest } from 'rxjs';

import { Document } from '../../models/document.model';
import { documentExtension, documentKindInfo } from '../../models/document-kind';
import { fitTint } from '../../models/opportunity';
import { DocService, DocumentLimits } from '../../services/doc.service';
import { DocsAssistantSignalService } from '../../services/docs-assistant-signal.service';
import { DocsAuthService } from '../../services/docs-auth.service';
import { DocsPageActionsService } from '../../services/docs-page-actions.service';
import { DocumentsStoreService } from '../../services/documents-store.service';
import { LoggerService } from '../../services/logger.service';
import { OpportunitiesService } from '../../services/opportunities.service';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';

type RowState = 'uploading' | 'saved' | 'reading' | 'opportunity' | 'not-rfp' | 'error';

interface UploadRow {
  key: string;
  file: File;
  progress: number;
  state: RowState;
  title: string;
  /** TODD's line under the title. */
  note: string;
  folder: string;
  tint: string;
  extension: string;
  documentId: string;
  opportunityId: string;
  score: number | null;
  eligibleForSocial: boolean;
  isMedia: boolean;
}

/** "final_FINAL_v3.docx" -> "Final FINAL v3": a readable title until someone renames it. */
export function titleFromFileName ( name: string ): string {
  const base = String( name || '' ).replace( /\.[a-z0-9]{1,5}$/i, '' ).replace( /[_]+/g, ' ' ).replace( /\s+/g, ' ' ).trim();
  return base ? base.charAt( 0 ).toUpperCase() + base.slice( 1 ) : 'Untitled file';
}

/** Whether a file's name says it's a solicitation. */
export function looksLikeRfp ( name: string ): boolean {
  return /\b(rfp|rfq|rfi|itb|ifb|solicitation|bid)\b/i.test( String( name || '' ).replace( /[_\-.]+/g, ' ' ) );
}

/**
 * Add files (design_handoff_todd_docs 1i): drop or browse, and each file
 * uploads straight away with a readable title and a folder. An RFP (opened
 * from "Add an RFP", or named like one) is read by TODD and added to
 * Opportunities with its fit score; any other row can be marked as an RFP.
 * Storage path `${tenantId}/documents/${file.name}` is unchanged - it must
 * match the bucket's security rules.
 */
@Component( {
  selector: 'app-general-document-upload',
  standalone: true,
  imports: [CommonModule, RouterModule, DkIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './general-document-upload.component.html',
  styleUrl: './general-document-upload.component.css'
} )
export class GeneralDocumentUploadComponent implements OnInit, OnDestroy {
  private readonly auth = inject( DocsAuthService );
  private readonly docService = inject( DocService );
  private readonly docsStore = inject( DocumentsStoreService );
  private readonly opportunities = inject( OpportunitiesService );
  private readonly assistantBus = inject( DocsAssistantSignalService );
  private readonly pageActions = inject( DocsPageActionsService );
  private readonly logger = inject( LoggerService );
  private readonly router = inject( Router );
  private readonly route = inject( ActivatedRoute );
  private readonly cdr = inject( ChangeDetectorRef );
  private readonly storage = getStorage();

  @ViewChild( 'fileInput' ) fileInput?: ElementRef<HTMLInputElement>;

  readonly rows = signal<UploadRow[]>( [] );
  readonly dragging = signal( false );
  readonly limits = signal<DocumentLimits | null>( null );
  readonly signedIn = signal<boolean | null>( null );
  /** Opened from "Add an RFP": every file is read as an RFP. */
  readonly rfpMode = this.route.snapshot.queryParamMap.get( 'rfp' ) === '1';
  /** "Attach the RFP" from the proposal editor: the file is that opportunity's RFP. */
  readonly attachTo = this.route.snapshot.queryParamMap.get( 'opportunity' ) || '';
  /** A portal link pasted on Home: TODD can't sign in to portals, so it asks for the file. */
  readonly link = this.route.snapshot.queryParamMap.get( 'link' ) || '';

  private tenantId = '';
  private userId = '';
  private author = '';
  private authSub?: Subscription;

  readonly headline = computed( () => {
    const rows = this.rows();
    if ( !rows.length ) return this.rfpMode ? 'Add an RFP' : 'Add files';
    const busy = rows.filter( ( r ) => r.state === 'uploading' || r.state === 'reading' ).length;
    if ( busy ) return `Adding ${ rows.length } ${ rows.length === 1 ? 'file' : 'files' }…`;
    const failed = rows.filter( ( r ) => r.state === 'error' ).length;
    const done = rows.length - failed;
    return failed ? `${ done } added. ${ failed } didn't make it.` : `${ done } ${ done === 1 ? 'file' : 'files' } added.`;
  } );

  readonly limitMessage = computed( () => {
    const l = this.limits();
    if ( !l || l.isPaidUser ) return '';
    if ( l.remainingFreeDocuments <= 0 ) return `You've used all ${ l.freeDocumentLimit } free documents. Upgrade to keep adding files.`;
    return `${ l.remainingFreeDocuments } of ${ l.freeDocumentLimit } free documents left`;
  } );

  readonly fitTint = fitTint;

  ngOnInit (): void {
    this.authSub = combineLatest( [this.auth.getTenantId(), this.auth.getUserId(), this.auth.isLoggedIn(), this.auth.getUser()] )
        .subscribe( ( [tenantId, userId, isLoggedIn, user] ) => {
          this.tenantId = String( tenantId || '' );
          this.userId = String( userId || '' );
          this.author = String( ( user as { displayName?: string } | null )?.displayName || '' );
          this.signedIn.set( !!isLoggedIn && !!userId );
          if ( this.signedIn() ) this.docService.getLimits().subscribe( { next: ( l ) => this.limits.set( l ), error: () => this.limits.set( null ) } );
          this.publishContext();
        } );
    this.pageActions.setPageActions( {
      pageId: 'general-document-upload',
      context: { pageId: 'general-document-upload', feature: 'documents', entityType: 'document' },
      actions: [
        { id: 'upload-browse', label: 'Choose files', icon: 'fa-solid fa-upload', kind: 'callback', handler: () => this.browse(), order: 10, group: 'context' },
        { id: 'upload-documents', label: 'Documents', icon: 'fa-solid fa-folder', kind: 'route', route: '/documents', order: 20, group: 'context' },
        { id: 'upload-opportunities', label: 'Opportunities', icon: 'fa-solid fa-inbox', kind: 'route', route: '/opportunities', order: 30, group: 'context' },
      ],
    } );
  }

  ngOnDestroy (): void {
    this.authSub?.unsubscribe();
    this.pageActions.clearPageActions( 'general-document-upload' );
  }

  browse (): void {
    if ( !this.signedIn() ) return;
    this.fileInput?.nativeElement.click();
  }

  onFileSelect ( event: Event ): void {
    const input = event.target as HTMLInputElement;
    this.add( Array.from( input.files || [] ) );
    input.value = '';
  }

  onDrop ( event: DragEvent ): void {
    event.preventDefault();
    this.dragging.set( false );
    this.add( Array.from( event.dataTransfer?.files || [] ) );
  }

  onDragOver ( event: DragEvent ): void {
    event.preventDefault();
    if ( event.dataTransfer ) event.dataTransfer.dropEffect = this.signedIn() ? 'copy' : 'none';
    this.dragging.set( true );
  }

  private add ( files: File[] ): void {
    if ( !files.length || !this.signedIn() ) return;
    const limits = this.limits();
    let room = limits && !limits.isPaidUser ? Math.max( 0, limits.remainingFreeDocuments ) : Infinity;
    for ( const file of files ) {
      const preview = { name: file.name, mimeType: file.type, type: this.typeFor( file ), src: '' } as Document;
      const info = documentKindInfo( preview );
      const row: UploadRow = {
        key: `${ file.name }:${ file.size }:${ Date.now() }:${ Math.random() }`,
        file,
        progress: 0,
        state: 'uploading',
        title: titleFromFileName( file.name ),
        note: 'Uploading…',
        folder: info.plural,
        tint: info.tint,
        extension: documentExtension( preview ),
        documentId: '',
        opportunityId: '',
        score: null,
        eligibleForSocial: false,
        isMedia: preview.type === 'image' || preview.type === 'video',
      };
      if ( room <= 0 ) {
        this.rows.update( ( rows ) => [...rows, { ...row, state: 'error', note: 'Your free documents are used up. Upgrade to keep adding files.' }] );
        continue;
      }
      room -= 1;
      this.rows.update( ( rows ) => [...rows, row] );
      void this.upload( row.key );
    }
  }

  private patch ( key: string, changes: Partial<UploadRow> ): void {
    this.rows.update( ( rows ) => rows.map( ( r ) => r.key === key ? { ...r, ...changes } : r ) );
    this.cdr.markForCheck();
  }

  private row ( key: string ): UploadRow | undefined {
    return this.rows().find( ( r ) => r.key === key );
  }

  private async upload ( key: string ): Promise<void> {
    const row = this.row( key );
    if ( !row ) return;
    try {
      const url = await new Promise<string>( ( resolve, reject ) => {
        const task = uploadBytesResumable( ref( this.storage, `${ this.tenantId }/documents/${ row.file.name }` ), row.file );
        task.on( 'state_changed', ( s ) => this.patch( key, { progress: Math.round( ( s.bytesTransferred / s.totalBytes ) * 100 ) } ), reject, () => {
          getDownloadURL( task.snapshot.ref ).then( resolve ).catch( reject );
        } );
      } );
      const now = new Date().toISOString();
      const payload: Document = {
        src: url,
        name: row.file.name,
        type: this.typeFor( row.file ),
        mimeType: row.file.type,
        storagePath: `${ this.tenantId }/documents/${ row.file.name }`,
        sizeBytes: row.file.size,
        uploadDate: now,
        createdAt: now,
        updatedAt: now,
        author: this.author,
        title: row.title,
        topic: row.folder,
        ownerId: this.userId || undefined,
        tenantId: this.tenantId,
        recordKind: 'upload',
        eligibleForSocial: false,
      };
      const created = await new Promise<Document>( ( resolve, reject ) => this.docService.createDocument( payload ).subscribe( { next: resolve, error: reject } ) );
      this.patch( key, { state: 'saved', documentId: String( created?.id || '' ), note: `Filed under ${ row.folder }.` } );
      this.docsStore.loaded.set( false );
      if ( this.attachTo ) await this.attachToOpportunity( key );
      else if ( this.rfpMode || looksLikeRfp( row.file.name ) ) await this.readAsRfp( key );
    } catch ( error ) {
      this.logger.error( 'Upload failed', row.file.name, error );
      this.patch( key, { state: 'error', note: this.failureMessage( error ) } );
    }
    this.publishContext();
  }

  /** Sends an uploaded file to TODD to read as an RFP; it lands on Opportunities, scored. */
  async readAsRfp ( key: string ): Promise<void> {
    const row = this.row( key );
    if ( !row?.documentId ) return;
    this.patch( key, { state: 'reading', note: 'Reading it as an RFP and scoring it against your profile…' } );
    try {
      const text = await this.textFor( row.file );
      const created = await new Promise<{ id: string; fit: { score: number } }[]>( ( resolve, reject ) =>
        this.opportunities.createFromDocument( row.documentId, text ).subscribe( { next: resolve, error: reject } ) );
      const best = [...created].sort( ( a, b ) => b.fit.score - a.fit.score )[0];
      this.patch( key, {
        state: 'opportunity',
        folder: 'Opportunities',
        tint: 'violet',
        opportunityId: best?.id || '',
        score: best ? best.fit.score : null,
        note: created.length > 1 ? `This is an RFP with ${ created.length } opportunities. I added them to Opportunities and scored them.` : `This is an RFP. I added it to Opportunities and scored it ${ best?.fit.score ?? '' }.`,
      } );
    } catch ( error ) {
      const code = error instanceof HttpErrorResponse ? error.error?.error : '';
      this.patch( key, {
        state: code === 'not_an_rfp' ? 'not-rfp' : 'saved',
        note: code === 'not_an_rfp' ? `TODD didn't find an RFP in this file. It's filed under ${ row.folder }.` : `It's filed under ${ row.folder }, but TODD couldn't read it as an RFP. ${ error instanceof HttpErrorResponse && error.error?.message ? error.error.message : 'Try again in a moment.' }`,
      } );
    }
  }

  /** Links the uploaded file as the opportunity's RFP, so TODD can draft from the real document. */
  private async attachToOpportunity ( key: string ): Promise<void> {
    const row = this.row( key );
    if ( !row?.documentId ) return;
    try {
      await new Promise( ( resolve, reject ) => this.opportunities.update( this.attachTo, { rfpDocumentId: row.documentId } ).subscribe( { next: resolve, error: reject } ) );
      this.patch( key, { state: 'opportunity', opportunityId: this.attachTo, folder: 'Opportunities', tint: 'violet', note: 'Attached as the RFP. TODD can redraft the proposal from it.' } );
    } catch {
      this.patch( key, { note: `It's filed under ${ row.folder }, but TODD couldn't attach it to the proposal. Try again.` } );
    }
  }

  toggleSocial ( key: string ): void {
    const row = this.row( key );
    if ( !row?.documentId ) return;
    const next = !row.eligibleForSocial;
    this.patch( key, { eligibleForSocial: next } );
    this.docService.updateDocument( row.documentId, { eligibleForSocial: next }, this.tenantId ).subscribe( {
      error: () => this.patch( key, { eligibleForSocial: !next } ),
    } );
  }

  open ( row: UploadRow ): void {
    if ( row.opportunityId && this.attachTo ) void this.router.navigate( ['/opportunities', row.opportunityId, 'proposal'] );
    else if ( row.opportunityId ) void this.router.navigate( ['/opportunities', row.opportunityId] );
    else if ( row.documentId ) void this.router.navigate( ['/documents', row.documentId] );
  }

  /** PDFs go to TODD as files; Word and text files as their text. */
  private async textFor ( file: File ): Promise<string> {
    const name = file.name.toLowerCase();
    if ( name.endsWith( '.pdf' ) || file.type.includes( 'pdf' ) ) return '';
    if ( name.endsWith( '.docx' ) ) {
      const mammoth = await import( 'mammoth' );
      const result = await mammoth.extractRawText( { arrayBuffer: await file.arrayBuffer() } );
      return result.value || '';
    }
    if ( file.type.startsWith( 'text/' ) || /\.(txt|md|eml|html?)$/.test( name ) ) return file.text();
    return '';
  }

  private typeFor ( file: File ): Document['type'] {
    const mime = ( file.type || '' ).toLowerCase();
    if ( mime.startsWith( 'image/' ) || /\.(jpe?g|png|gif|bmp|svg|webp|heic|heif|avif)$/i.test( file.name ) ) return 'image';
    if ( mime.startsWith( 'video/' ) || /\.(mp4|mov|avi|mkv|flv|wmv|webm|m4v)$/i.test( file.name ) ) return 'video';
    return 'document';
  }

  private failureMessage ( error: unknown ): string {
    if ( error instanceof HttpErrorResponse ) {
      if ( typeof error.error?.message === 'string' && error.error.message.trim() ) return error.error.message.trim();
      if ( error.status === 0 ) return 'TODD couldn\'t reach the server. Try again in a moment.';
      if ( error.status === 403 ) return 'You don\'t have access to add documents right now.';
    }
    return 'The upload didn\'t finish. Try again.';
  }

  private publishContext (): void {
    const rows = this.rows();
    this.assistantBus.setPageContext( {
      feature: 'documents',
      page: 'general-document-upload',
      route: this.router.url,
      mode: 'create',
      title: this.rfpMode ? 'Add an RFP' : 'Add files',
      description: 'Upload files; TODD names and files each one, and reads RFPs into Opportunities.',
      allowedActions: ['select_file', 'drop_file'],
      selectedEntityType: 'document',
      selectedEntityId: '',
      summary: { isAuthenticated: !!this.signedIn(), fileCount: rows.length, uploading: rows.filter( ( r ) => r.state === 'uploading' ).length },
      dataPreview: { files: rows.map( ( r ) => r.file.name ).join( ', ' ) },
    } );
  }

  trackRow ( _index: number, row: UploadRow ): string {
    return row.key;
  }
}
