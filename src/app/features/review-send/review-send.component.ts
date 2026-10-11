import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { getBlob, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { firstValueFrom } from 'rxjs';

import { Document } from '../../models/document.model';
import { documentExtension, documentKindInfo } from '../../models/document-kind';
import { DocsInbox, Opportunity, ProposalDraft } from '../../models/opportunity';
import { DocService } from '../../services/doc.service';
import { DocsAuthService } from '../../services/docs-auth.service';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { DocumentsStoreService } from '../../services/documents-store.service';
import { OpportunitiesService } from '../../services/opportunities.service';
import { ProfileApiService } from '../../services/profile-api.service';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';
import { buildProposalPdf } from '../../shared/proposal-pdf';
import { WriteActionDirective } from '../../shared/write-access/write-action.directive';
import { defaultBody, defaultSender, defaultSubject, isEmail, isNoReply, whyThisAddress } from './review-send.helpers';

interface AttachmentChip {
  key: string;
  name: string;
  detail: string;
  tint: string;
  extension: string;
  /** Set for files already in Documents; the proposal PDF gets one when it's saved. */
  doc: Document | null;
  removable: boolean;
}

function fileSafe ( value: string ): string {
  return String( value || 'Proposal' ).replace( /[\\/:*?"<>|]+/g, '' ).replace( /\s+/g, ' ' ).trim().slice( 0, 120 ) || 'Proposal';
}

/**
 * Review & send (design_handoff_todd_docs 1f). The proposal goes from the
 * person's own inbox to the address the RFP gives, with the proposal PDF
 * (11pt, 1" margins) and the attachments the checklist found in Documents.
 * Send waits for a complete checklist. Portal-only RFPs get Download
 * package and a link to the portal instead, then "I've submitted it".
 */
@Component( {
  selector: 'app-review-send',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DkIconComponent, WriteActionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './review-send.component.html',
  styleUrl: './review-send.component.css',
} )
export class ReviewSendComponent implements OnInit {
  private readonly route = inject( ActivatedRoute );
  private readonly service = inject( OpportunitiesService );
  private readonly docService = inject( DocService );
  private readonly docsStore = inject( DocumentsStoreService );
  private readonly auth = inject( DocsAuthService );
  private readonly profileApi = inject( ProfileApiService );
  private readonly notifications = inject( DocsNotificationService );
  private readonly destroyRef = inject( DestroyRef );

  readonly opportunityId = signal( '' );
  readonly opportunity = signal<Opportunity | null>( null );
  readonly draft = signal<ProposalDraft | null>( null );
  readonly inboxes = signal<DocsInbox[]>( [] );
  readonly attachments = signal<AttachmentChip[]>( [] );
  readonly phase = signal<'loading' | 'ready' | 'error'>( 'loading' );
  readonly errorMessage = signal( '' );
  readonly busy = signal<'' | 'send' | 'package' | 'portal'>( '' );
  readonly pdfPages = signal( 0 );
  readonly to = signal( '' );
  mailboxId = '';
  subject = '';
  body = '';

  private pdfBytes: Uint8Array | null = null;
  private proposalTitle = '';
  private tenantId = '';
  private author = '';

  readonly portalOnly = computed( () => {
    const o = this.opportunity();
    return !!o && ( o.submission.method === 'portal' || ( !o.submission.email && !!o.portalUrl ) );
  } );
  readonly checklist = computed( () => this.draft()?.checklist || [] );
  readonly failing = computed( () => this.checklist().filter( ( c ) => !c.ok ) );
  readonly ready = computed( () => this.failing().length === 0 );
  readonly headline = computed( () => {
    if ( this.opportunity()?.submissionRecord ) return 'Sent.';
    if ( !this.checklist().length ) return 'Ready to review.';
    return this.ready() ? 'Everything the RFP asks for is in.' : `${ this.failing().length } ${ this.failing().length === 1 ? 'thing' : 'things' } to finish first.`;
  } );
  readonly checklistSummary = computed( () => this.checklist().filter( ( c ) => c.ok ).map( ( c ) => c.status || c.label ).join( ', ' ) );
  readonly toProblem = computed( () => {
    const to = this.to().trim();
    if ( !to ) return '';
    if ( !isEmail( to ) ) return 'That isn\'t an email address.';
    if ( isNoReply( to ) ) return 'That\'s a no-reply address, which can\'t receive mail.';
    return '';
  } );
  readonly why = computed( () => {
    const o = this.opportunity();
    return o ? whyThisAddress( o, this.to().trim() ) : '';
  } );
  readonly canSend = computed( () => this.ready() && !!this.to().trim() && !this.toProblem() && !!this.pdfBytes && this.pdfPages() > 0 );

  ngOnInit (): void {
    this.route.paramMap.pipe( takeUntilDestroyed( this.destroyRef ) ).subscribe( ( params ) => {
      this.opportunityId.set( String( params.get( 'id' ) || '' ) );
      void this.load();
    } );
  }

  private async load (): Promise<void> {
    const id = this.opportunityId();
    this.phase.set( 'loading' );
    try {
      const [opportunity, draft, inboxes, profile, tenantId, documents] = await Promise.all( [
        firstValueFrom( this.service.get( id ) ),
        firstValueFrom( this.service.getProposal( id ) ).catch( () => null ),
        firstValueFrom( this.service.listInboxes() ).catch( () => [] as DocsInbox[] ),
        this.profileApi.load().catch( () => null ),
        firstValueFrom( this.auth.getTenantId() ),
        firstValueFrom( this.docsStore.load() ),
      ] );
      this.opportunity.set( opportunity );
      this.draft.set( draft );
      this.inboxes.set( inboxes );
      this.tenantId = String( tenantId || '' );
      if ( !opportunity.proposalDocumentId ) throw new Error( 'Draft the proposal first.' );

      const proposal: Document = await firstValueFrom( this.docService.getDocument( opportunity.proposalDocumentId ) );
      this.proposalTitle = String( proposal?.title || `Proposal · ${ opportunity.title }` );
      const company = profile?.companyName || '';
      this.author = company;
      const pdf = await buildProposalPdf( String( proposal?.htmlContent || '' ), { title: this.proposalTitle, author: company } );
      this.pdfBytes = pdf.bytes;
      this.pdfPages.set( pdf.pages );

      // The proposal, then each required attachment the checklist found in Documents.
      const required = ( draft?.checklist || [] ).filter( ( c ) => c.kind === 'attachment' && c.documentId );
      const chips: AttachmentChip[] = [
        { key: 'proposal', name: `${ fileSafe( this.proposalTitle.replace( /^Proposal · /, 'Proposal - ' ) ) }.pdf`, detail: `${ pdf.pages } pp`, tint: 'blue', extension: 'PDF', doc: null, removable: false },
        ...required.map( ( c ) => {
          const doc = documents.find( ( d ) => String( d.id ) === c.documentId ) || null;
          return { key: c.documentId!, name: String( doc?.name || doc?.title || c.label ), detail: c.label, tint: documentKindInfo( doc ).tint, extension: documentExtension( doc ), doc, removable: true };
        } ),
      ];
      this.attachments.set( chips );

      this.to.set( opportunity.submission.email || '' );
      this.mailboxId = defaultSender( inboxes )?.id || '';
      this.subject = defaultSubject( opportunity, company );
      const name = [profile?.firstName, profile?.lastName].filter( Boolean ).join( ' ' );
      this.body = defaultBody( opportunity, { name, company }, chips.map( ( c ) => c.name ) );
      this.phase.set( 'ready' );
    } catch ( error: any ) {
      this.errorMessage.set( error?.error?.message || error?.message || 'TODD couldn\'t get the proposal ready to send.' );
      this.phase.set( 'error' );
    }
  }

  removeAttachment ( key: string ): void {
    this.attachments.update( ( list ) => list.filter( ( a ) => a.key !== key || !a.removable ) );
  }

  /** Saves the proposal PDF to Documents (so it can be attached and kept). */
  private async savePdf (): Promise<string> {
    const bytes = this.pdfBytes;
    if ( !bytes ) throw new Error( 'The proposal PDF isn\'t ready.' );
    const chip = this.attachments()[0];
    const path = `${ this.tenantId }/documents/${ chip.name }`;
    const storageRef = ref( getStorage(), path );
    await uploadBytes( storageRef, bytes, { contentType: 'application/pdf' } );
    const src = await getDownloadURL( storageRef );
    const now = new Date().toISOString();
    const created = await firstValueFrom( this.docService.createDocument( {
      name: chip.name,
      title: this.proposalTitle,
      type: 'proposal',
      recordKind: 'upload',
      src,
      storagePath: path,
      mimeType: 'application/pdf',
      sizeBytes: bytes.length,
      status: 'final',
      rfpId: this.opportunity()?.rfpDocumentId || undefined,
      author: this.author,
      uploadDate: now,
      createdAt: now,
      updatedAt: now,
    } ) );
    this.docsStore.loaded.set( false );
    return String( created?.id || '' );
  }

  async send (): Promise<void> {
    const o = this.opportunity();
    if ( !o || !this.canSend() || this.busy() ) return;
    if ( !this.mailboxId ) {
      this.notifications.show( 'No inbox to send from', 'Connect your email on the RFP inbox page first.', 'warning' );
      return;
    }
    this.busy.set( 'send' );
    try {
      const pdfId = await this.savePdf();
      const others = this.attachments().filter( ( a ) => a.doc?.id ).map( ( a ) => String( a.doc!.id ) );
      const updated = await firstValueFrom( this.service.sendProposal( o.id, {
        mailboxId: this.mailboxId,
        to: this.to().trim(),
        subject: this.subject,
        body: this.body,
        documentIds: [pdfId, ...others],
      } ) );
      this.opportunity.set( updated );
      this.notifications.show( 'Proposal sent', `Sent to ${ this.to().trim() }.`, 'success' );
    } catch ( error: any ) {
      this.notifications.show( 'Not sent', error?.error?.message || error?.message || 'TODD couldn\'t send it. Nothing was sent; try again.', 'warning' );
    } finally {
      this.busy.set( '' );
    }
  }

  /** A zip of the proposal PDF and its attachments, for portals or sending another way. */
  async downloadPackage (): Promise<void> {
    if ( !this.pdfBytes || this.busy() ) return;
    this.busy.set( 'package' );
    try {
      const { default: JSZip } = await import( 'jszip' );
      const zip = new JSZip();
      const [proposal, ...rest] = this.attachments();
      zip.file( proposal.name, this.pdfBytes );
      const missing: string[] = [];
      for ( const chip of rest ) {
        const doc = chip.doc;
        try {
          const blob = doc?.storagePath ? await getBlob( ref( getStorage(), doc.storagePath ) ) : await ( await fetch( String( doc?.src ) ) ).blob();
          zip.file( chip.name, blob );
        } catch {
          missing.push( `${ chip.name }: ${ doc?.src || 'open it from Documents' }` );
        }
      }
      if ( missing.length ) zip.file( 'Attachments to add.txt', `These couldn't be packaged. Download them from Docs:\n\n${ missing.join( '\n' ) }\n` );
      const blob = await zip.generateAsync( { type: 'blob' } );
      const url = URL.createObjectURL( blob );
      const link = document.createElement( 'a' );
      link.href = url;
      link.download = `${ fileSafe( this.subject || this.proposalTitle ) }.zip`;
      document.body.appendChild( link );
      link.click();
      link.remove();
      setTimeout( () => URL.revokeObjectURL( url ), 1000 );
    } catch {
      this.notifications.show( 'Couldn\'t build the package', 'Try again, or download the files from Documents.', 'warning' );
    } finally {
      this.busy.set( '' );
    }
  }

  async markSubmitted (): Promise<void> {
    const o = this.opportunity();
    if ( !o || this.busy() ) return;
    if ( !window.confirm( 'Mark this proposal as submitted on the portal?' ) ) return;
    this.busy.set( 'portal' );
    try {
      this.opportunity.set( await firstValueFrom( this.service.markSubmitted( o.id, 'Uploaded to the portal' ) ) );
    } catch {
      this.notifications.show( 'Couldn\'t update it', 'Please try again.', 'warning' );
    } finally {
      this.busy.set( '' );
    }
  }
}
