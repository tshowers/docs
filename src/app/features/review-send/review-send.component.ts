import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { getBlob, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { firstValueFrom } from 'rxjs';

import { APPROVER_STATE, ApprovalComment, ApprovalPayload, ApprovalRequest, Approver, ago, describeEvent, displayName, firstName, initials, longWhen, personTint } from '../../models/approval';
import { Document } from '../../models/document.model';
import { documentExtension, documentKindInfo } from '../../models/document-kind';
import { DocsInbox, Opportunity, ProposalDraft, dueDate, dueLong } from '../../models/opportunity';
import { ApprovalsService } from '../../services/approvals.service';
import { DocService } from '../../services/doc.service';
import { DocsAuthService } from '../../services/docs-auth.service';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { DocumentsStoreService } from '../../services/documents-store.service';
import { OpportunitiesService } from '../../services/opportunities.service';
import { ProfileApiService } from '../../services/profile-api.service';
import { ApproverShareComponent, ShareVia } from '../../shared/approver-share/approver-share.component';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';
import { buildProposalPdf } from '../../shared/proposal-pdf';
import { buildMatrixPdf, matrixRows } from '../../shared/requirements-matrix';
import { WriteActionDirective } from '../../shared/write-access/write-action.directive';
import { ApprovalForm, GetApprovalDialogComponent } from './get-approval-dialog.component';
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
 *
 * Approval (round 4, 4a/4b/4g/4h) is optional: once asked for, Send stays
 * locked until the rule is met for exactly what would go out. Approvers
 * review from a private link the owner sends them.
 */
@Component( {
  selector: 'app-review-send',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DkIconComponent, WriteActionDirective, GetApprovalDialogComponent, ApproverShareComponent],
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
  private readonly approvals = inject( ApprovalsService );
  private readonly destroyRef = inject( DestroyRef );

  readonly opportunityId = signal( '' );
  readonly opportunity = signal<Opportunity | null>( null );
  readonly draft = signal<ProposalDraft | null>( null );
  readonly inboxes = signal<DocsInbox[]>( [] );
  readonly attachments = signal<AttachmentChip[]>( [] );
  readonly phase = signal<'loading' | 'ready' | 'error'>( 'loading' );
  readonly errorMessage = signal( '' );
  readonly busy = signal<'' | 'send' | 'package' | 'portal' | 'approval'>( '' );
  readonly pdfPages = signal( 0 );
  readonly to = signal( '' );
  mailboxId = '';
  readonly subject = signal( '' );
  readonly body = signal( '' );

  // ── Approval ───────────────────────────────────────────────────
  readonly approval = signal<ApprovalRequest | null>( null );
  readonly dialog = signal<'' | 'ask' | 'change' | 'share' | 'bypass'>( '' );
  readonly dialogBusy = signal( false );
  readonly dialogError = signal( '' );
  readonly busyComment = signal( '' );
  bypassReason = '';
  readonly replies: Record<string, string> = {};
  ownerName = '';
  company = '';

  readonly APPROVER_STATE = APPROVER_STATE;
  readonly initials = initials;
  readonly tint = ( a: { name: string; email: string } ) => personTint( a.email || a.name );
  readonly describe = describeEvent;
  readonly ago = ( value: string ) => ago( value );
  readonly longWhen = longWhen;
  readonly displayName = displayName;

  private pdfBytes: Uint8Array | null = null;
  /** The compliance matrix, when the RFP asks for it with the proposal (lifecycle 1e). */
  private matrixBytes: Uint8Array | null = null;
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
    const a = this.approval();
    if ( a && this.approvalActive() ) {
      if ( this.approvalOutdated() ) return 'Changed since you asked.';
      if ( this.approvalMet() ) return 'Approved. Ready to send.';
      if ( a.status === 'changes' ) return `${ firstName( this.changesBy()[0] || {} ) } requested changes.`;
      return a.rule === 'any' ? 'Waiting on approval.' : `${ this.approvedCount() } of ${ a.approvers.length } approved.`;
    }
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
  /** Asked for and still deciding: Send waits on it. */
  readonly approvalActive = computed( () => {
    const a = this.approval();
    return !!a && a.status !== 'sent' && a.status !== 'bypassed';
  } );
  /** What would go out now differs from what approvers were asked about. */
  readonly approvalOutdated = computed( () => {
    const a = this.approval();
    if ( !a || !this.approvalActive() ) return false;
    if ( a.proposalChanged ) return true;
    if ( this.portalOnly() ) return false;
    const sameIds = ( x: string[], y: string[] ) => x.length === y.length && x.every( ( id, i ) => id === y[i] );
    const attached = this.attachments().filter( ( c ) => c.doc?.id ).map( ( c ) => String( c.doc!.id ) ).sort();
    return this.to().trim().toLowerCase() !== ( a.email.to || '' ).toLowerCase()
      || this.subject().trim() !== ( a.email.subject || '' ).trim()
      || this.body().trim() !== ( a.email.body || '' ).trim()
      || !sameIds( attached, a.attachments.map( ( x ) => x.documentId ).filter( Boolean ).sort() );
  } );
  readonly approvalMet = computed( () => this.approval()?.status === 'approved' && !this.approvalOutdated() );
  readonly sendLocked = computed( () => this.approvalActive() && !this.approvalMet() );
  readonly approvedCount = computed( () => ( this.approval()?.approvers || [] ).filter( ( a ) => a.state === 'approved' ).length );
  readonly changesBy = computed( () => ( this.approval()?.approvers || [] ).filter( ( a ) => a.state === 'changes' ) );
  readonly openComments = computed( () => ( this.approval()?.comments || [] ).filter( ( c ) => c.status === 'open' ) );
  readonly activity = computed( () => ( this.approval()?.events || [] ).slice( -8 ).map( ( e ) => ( { ...describeEvent( e ), at: e.at } ) ) );
  readonly approvalSub = computed( () => {
    const a = this.approval();
    const o = this.opportunity();
    if ( !a || !o ) return '';
    const rfp = dueLong( o ) ? ` The RFP is due ${ dueLong( o ) }.` : '';
    if ( this.approvalMet() ) return `Approved version ${ a.version }.${ rfp }`;
    const pending = a.approvers.filter( ( x ) => x.state !== 'approved' );
    const who = pending.length === 1 ? `${ firstName( pending[0] ) }'s approval` : 'Approval';
    const by = a.dueAt ? `${ who } is due ${ longWhen( a.dueAt ) }.` : '';
    const late = a.dueAt && new Date( a.dueAt ).getTime() < Date.now() ? ' That time has passed.' : '';
    return `${ by }${ late }${ rfp }`.trim();
  } );
  readonly editNote = computed( () => {
    const approved = ( this.approval()?.approvers || [] ).filter( ( a ) => a.state === 'approved' );
    if ( !approved.length ) return 'If you change the proposal, the email or the attachments now, ask again so they review the version that goes out. They see only what changed.';
    const names = approved.map( ( a ) => firstName( a ) );
    const who = names.length === 1 ? names[0] : `${ names.slice( 0, -1 ).join( ', ' ) } and ${ names[names.length - 1] }`;
    return `${ who } approved version ${ this.approval()!.version }. If you change the proposal, the email or the attachments, ask again and they'll see only what changed.`;
  } );

  readonly canSend = computed( () => this.ready() && !!this.to().trim() && !this.toProblem() && !!this.pdfBytes && this.pdfPages() > 0 && !this.sendLocked() );
  readonly rfpDue = computed( () => {
    const o = this.opportunity();
    return o ? dueDate( o ) : null;
  } );

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
      const [opportunity, draft, inboxes, profile, tenantId, documents, approval, requirements] = await Promise.all( [
        firstValueFrom( this.service.get( id ) ),
        firstValueFrom( this.service.getProposal( id ) ).catch( () => null ),
        firstValueFrom( this.service.listInboxes() ).catch( () => [] as DocsInbox[] ),
        this.profileApi.load().catch( () => null ),
        firstValueFrom( this.auth.getTenantId() ),
        firstValueFrom( this.docsStore.load() ),
        firstValueFrom( this.approvals.get( id ) ).catch( () => null ),
        firstValueFrom( this.service.getRequirements( id ) ).catch( () => null ),
      ] );
      this.approval.set( approval );
      this.opportunity.set( opportunity );
      this.draft.set( draft );
      this.inboxes.set( inboxes );
      this.tenantId = String( tenantId || '' );
      if ( !opportunity.proposalDocumentId ) throw new Error( 'Draft the proposal first.' );

      const proposal: Document = await firstValueFrom( this.docService.getDocument( opportunity.proposalDocumentId ) );
      this.proposalTitle = String( proposal?.title || `Proposal · ${ opportunity.title }` );
      const company = profile?.companyName || '';
      this.author = company;
      this.company = company;
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
      if ( requirements?.matrixRequired && requirements.items.length ) {
        const sectionTitle = ( key: string ) => draft?.sections.find( ( s ) => s.key === key )?.title || '';
        const matrix = await buildMatrixPdf( matrixRows( requirements.items, sectionTitle ), { title: `Compliance matrix · ${ opportunity.title }`, author: company } );
        this.matrixBytes = matrix.bytes;
        chips.splice( 1, 0, { key: 'matrix', name: `${ fileSafe( `Compliance matrix - ${ opportunity.title }` ) }.pdf`, detail: `The RFP asks for it · ${ matrix.pages } pp`, tint: 'violet', extension: 'PDF', doc: null, removable: true } );
      }
      this.attachments.set( chips );

      const name = [profile?.firstName, profile?.lastName].filter( Boolean ).join( ' ' );
      this.ownerName = name || String( this.auth.getCurrentUserEmailSync() || '' );
      // While approval is open, the email is the one approvers saw.
      const asked = approval && approval.status !== 'sent' && approval.status !== 'bypassed' ? approval.email : null;
      this.to.set( asked?.to || opportunity.submission.email || '' );
      this.mailboxId = ( asked?.mailboxId && inboxes.some( ( i ) => i.id === asked.mailboxId ) ? asked.mailboxId : '' ) || defaultSender( inboxes )?.id || '';
      this.subject.set( asked?.subject || defaultSubject( opportunity, company ) );
      this.body.set( asked?.body || defaultBody( opportunity, { name, company }, chips.map( ( c ) => c.name ) ) );
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
    return this.saveFile( bytes, this.attachments()[0].name, this.proposalTitle, 'proposal' );
  }

  /**
   * The compliance matrix goes to Documents with the proposal, once, and its
   * chip then carries the document like any other attachment.
   */
  private async saveMatrix (): Promise<void> {
    const chip = this.attachments().find( ( c ) => c.key === 'matrix' );
    if ( !chip || chip.doc || !this.matrixBytes ) return;
    const id = await this.saveFile( this.matrixBytes, chip.name, chip.name.replace( /\.pdf$/, '' ), 'attachment' );
    const doc: Document = await firstValueFrom( this.docService.getDocument( id ) );
    this.attachments.update( ( list ) => list.map( ( c ) => c.key === 'matrix' ? { ...c, doc } : c ) );
  }

  private async saveFile ( bytes: Uint8Array, name: string, title: string, type: string ): Promise<string> {
    const path = `${ this.tenantId }/documents/${ name }`;
    const storageRef = ref( getStorage(), path );
    await uploadBytes( storageRef, bytes, { contentType: 'application/pdf' } );
    const src = await getDownloadURL( storageRef );
    const now = new Date().toISOString();
    const created = await firstValueFrom( this.docService.createDocument( {
      name,
      title,
      type,
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
      // The approved package already has its PDF; otherwise save one now.
      const snapshotPdf = this.approvalMet() ? this.approval()?.proposalPdfId : '';
      const pdfId = snapshotPdf || await this.savePdf();
      await this.saveMatrix();
      const others = this.attachments().filter( ( a ) => a.doc?.id ).map( ( a ) => String( a.doc!.id ) );
      const updated = await firstValueFrom( this.service.sendProposal( o.id, {
        mailboxId: this.mailboxId,
        to: this.to().trim(),
        subject: this.subject(),
        body: this.body(),
        documentIds: [pdfId, ...others],
      } ) );
      this.opportunity.set( updated );
      if ( this.approval() ) this.approval.set( await firstValueFrom( this.approvals.get( o.id ) ).catch( () => this.approval() ) );
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
        if ( chip.key === 'matrix' && this.matrixBytes ) {
          zip.file( chip.name, this.matrixBytes );
          continue;
        }
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
      link.download = `${ fileSafe( this.subject() || this.proposalTitle ) }.zip`;
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

  // ── Approval ───────────────────────────────────────────────────
  openApproval ( mode: 'ask' | 'change' ): void {
    this.dialogError.set( '' );
    this.dialog.set( mode );
  }

  closeDialog (): void {
    if ( this.dialogBusy() ) return;
    this.dialog.set( '' );
    this.dialogError.set( '' );
  }

  private payload ( form: Pick<ApprovalPayload, 'approvers' | 'rule' | 'dueAt' | 'note' | 'onApproved' | 'allowSuggestions'>, proposalPdfId = '' ): ApprovalPayload {
    const checklist = this.checklist();
    return {
      ...form,
      email: { to: this.to().trim(), subject: this.subject(), body: this.body(), mailboxId: this.mailboxId },
      attachments: this.attachments().filter( ( c ) => c.doc?.id ).map( ( c ) => ( { documentId: String( c.doc!.id ), name: c.name, detail: c.detail } ) ),
      proposalPdfId,
      ownerName: this.ownerName,
      company: this.company,
      checklist: { ok: checklist.filter( ( c ) => c.ok ).length, total: checklist.length },
    };
  }

  /** 4a: ask, or change approvers. Auto-send needs the PDF saved now, since TODD sends it later. */
  async submitApproval ( form: ApprovalForm ): Promise<void> {
    const o = this.opportunity();
    if ( !o || this.dialogBusy() ) return;
    this.dialogBusy.set( true );
    this.dialogError.set( '' );
    try {
      const pdfId = form.onApproved === 'autoSend' ? await this.savePdf() : '';
      if ( form.onApproved === 'autoSend' ) await this.saveMatrix();
      const saved = await firstValueFrom( this.approvals.save( o.id, this.payload( form, pdfId ) ) );
      this.approval.set( saved );
      this.dialog.set( 'share' );
    } catch ( error: any ) {
      this.dialogError.set( error?.error?.message || error?.message || 'TODD couldn\'t save that. Try again.' );
    } finally {
      this.dialogBusy.set( false );
    }
  }

  /** 4g: after edits, a new version for anyone whose approval no longer counts. */
  async askAgain (): Promise<void> {
    const a = this.approval();
    const o = this.opportunity();
    if ( !a || !o || this.busy() ) return;
    this.busy.set( 'approval' );
    try {
      const pdfId = a.onApproved === 'autoSend' ? await this.savePdf() : '';
      if ( a.onApproved === 'autoSend' ) await this.saveMatrix();
      const saved = await firstValueFrom( this.approvals.save( o.id, this.payload( {
        approvers: a.approvers.map( ( x ) => ( { id: x.id, name: x.name, email: x.email } ) ),
        rule: a.rule,
        dueAt: a.dueAt && new Date( a.dueAt ).getTime() > Date.now() ? a.dueAt : '',
        note: a.note,
        onApproved: a.onApproved,
        allowSuggestions: a.allowSuggestions,
      }, pdfId ) ) );
      this.approval.set( saved );
      this.dialog.set( 'share' );
    } catch ( error: any ) {
      this.notifications.show( 'Couldn\'t ask again', error?.error?.message || error?.message || 'Please try again.', 'warning' );
    } finally {
      this.busy.set( '' );
    }
  }

  onShared ( event: { approverId: string; via: ShareVia } ): void {
    const o = this.opportunity();
    if ( !o ) return;
    const at = new Date().toISOString();
    this.approval.update( ( a ) => a ? { ...a, approvers: a.approvers.map( ( x ) => x.id === event.approverId ? { ...x, sharedAt: at } : x ) } : a );
    this.approvals.recordShared( o.id, event.approverId, event.via ).subscribe( { error: () => null } );
  }

  async bypass (): Promise<void> {
    const o = this.opportunity();
    const reason = this.bypassReason.trim();
    if ( !o || !reason || this.dialogBusy() ) return;
    this.dialogBusy.set( true );
    try {
      this.approval.set( await firstValueFrom( this.approvals.bypass( o.id, reason ) ) );
      this.dialog.set( '' );
      this.bypassReason = '';
      this.notifications.show( 'Send is unlocked', 'Your reason is in Activity.', 'success' );
    } catch ( error: any ) {
      this.dialogError.set( error?.error?.message || 'TODD couldn\'t save that. Try again.' );
    } finally {
      this.dialogBusy.set( false );
    }
  }

  async resolve ( comment: ApprovalComment, action: 'accept' | 'reject' | 'reply' ): Promise<void> {
    const o = this.opportunity();
    const reply = ( this.replies[comment.id] || '' ).trim();
    if ( !o || this.busyComment() || ( action === 'reply' && !reply ) ) return;
    this.busyComment.set( comment.id );
    try {
      const updated = await firstValueFrom( this.approvals.resolveComment( o.id, comment.id, action, reply ) );
      this.replies[comment.id] = '';
      if ( action === 'accept' ) {
        // The proposal changed: rebuild the PDF and the page from it.
        this.notifications.show( 'Edit accepted', 'The proposal is updated. Ask for approval again when you\'re ready.', 'success' );
        await this.load();
      } else {
        this.approval.set( updated );
      }
    } catch ( error: any ) {
      this.notifications.show( 'Couldn\'t update it', error?.error?.message || 'Please try again.', 'warning' );
    } finally {
      this.busyComment.set( '' );
    }
  }

  approverSub ( a: Approver ): string {
    const parts: string[] = [];
    if ( a.name && a.email ) parts.push( a.email );
    const comments = ( this.approval()?.comments || [] ).filter( ( c ) => c.approverId === a.id ).length;
    const commentText = comments ? `${ comments } ${ comments === 1 ? 'comment' : 'comments' }` : '';
    switch ( a.state ) {
      case 'approved': parts.push( `approved version ${ a.approvedVersion } ${ ago( a.decidedAt ) }` ); break;
      case 'recheck': parts.push( `approved version ${ a.approvedVersion }; this is version ${ this.approval()!.version }` ); break;
      case 'changes': parts.push( `requested changes ${ ago( a.decidedAt ) }` ); break;
      case 'reviewing': parts.push( `opened ${ ago( a.openedAt ) }` ); break;
      default: parts.push( a.sharedAt ? `link sent ${ ago( a.sharedAt ) }` : 'link not sent yet' );
    }
    if ( commentText ) parts.push( commentText );
    return parts.join( ' · ' );
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
