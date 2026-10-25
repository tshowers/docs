import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { BuyerUpdate, DocsInbox, FIT_THRESHOLD, KeyDateKind, NoBidReason, Opportunity, OpportunityStatus, ProposalDraft, Requirements, isOpen } from '../models/opportunity';
import { ScoreCheck } from '../models/score-check';
import { DocService } from './doc.service';
import { ToddWorkService } from '../shared/working/todd-work.service';

interface Envelope<T> { success: boolean; data: T; message?: string; }

/**
 * Opportunities and the inboxes Docs watches for RFP alerts
 * (/api/docs/opportunities, /api/docs/inboxes in todd-backend). Keeps the
 * list in a signal so the header badge and the pages share one fetch.
 */
@Injectable( { providedIn: 'root' } )
export class OpportunitiesService {
  private readonly http = inject( HttpClient );
  private readonly docs = inject( DocService );
  private readonly work = inject( ToddWorkService );
  private readonly base = `${ environment.backendURL }/docs`;

  readonly opportunities = signal<Opportunity[]>( [] );
  readonly loaded = signal( false );

  /** Open RFPs that fit and still need a decision: the header badge. */
  fitCount (): number {
    return this.opportunities().filter( ( o ) => o.status === 'new' && o.fit.score >= FIT_THRESHOLD && isOpen( o ) ).length;
  }

  load ( force = false ): Observable<Opportunity[]> {
    if ( this.loaded() && !force ) return of( this.opportunities() );
    return this.http.get<Envelope<Opportunity[]>>( `${ this.base }/opportunities` ).pipe(
      map( ( response ) => response?.data || [] ),
      catchError( () => of( [] as Opportunity[] ) ),
      tap( ( items ) => {
        this.opportunities.set( items );
        this.loaded.set( true );
      } ),
    );
  }

  get ( id: string ): Observable<Opportunity> {
    return this.http.get<Envelope<Opportunity>>( `${ this.base }/opportunities/${ encodeURIComponent( id ) }` ).pipe( map( ( r ) => r.data ) );
  }

  update ( id: string, changes: { status?: OpportunityStatus; rfpDocumentId?: string; proposalDocumentId?: string } ): Observable<Opportunity> {
    return this.http.patch<Envelope<Opportunity>>( `${ this.base }/opportunities/${ encodeURIComponent( id ) }`, changes ).pipe(
      map( ( r ) => r.data ),
      tap( ( updated ) => this.replace( updated ) ),
    );
  }

  // ── Bid / No-Bid gate ──────────────────────────────────────────
  /** TODD reads the RFP for its must-haves (about a minute); returns at once when already checked. */
  checkMustHaves ( id: string, force = false ): Observable<Opportunity> {
    return this.http.post<Envelope<Opportunity>>( `${ this.base }/opportunities/${ encodeURIComponent( id ) }/musthaves/check`, { force } ).pipe(
      this.work.track( 'Checking the RFP\'s must-haves', { etaSeconds: 30 } ),
      map( ( r ) => r.data ),
      tap( ( updated ) => this.replace( updated ) ),
    );
  }

  answerMustHave ( id: string, itemId: string, answer: 'yes' | 'no' | 'unsure' ): Observable<{ opportunity: Opportunity; knowledge: { saved: boolean; id?: string; reason?: string } }> {
    return this.http.post<Envelope<{ opportunity: Opportunity; knowledge: { saved: boolean; id?: string; reason?: string } }>>( `${ this.base }/opportunities/${ encodeURIComponent( id ) }/musthaves/${ encodeURIComponent( itemId ) }/answer`, { answer } ).pipe(
      map( ( r ) => r.data ),
      tap( ( result ) => this.replace( result.opportunity ) ),
    );
  }

  /** Draft anyway (with why), or No bid (with one of NO_BID_REASONS). Both stay in the history. */
  decide ( id: string, body: { action: 'draft' | 'draft_anyway'; reason?: string } | { action: 'no_bid'; reason: NoBidReason; detail?: string } ): Observable<Opportunity> {
    return this.http.post<Envelope<Opportunity>>( `${ this.base }/opportunities/${ encodeURIComponent( id ) }/decision`, body ).pipe(
      map( ( r ) => r.data ),
      tap( ( updated ) => this.replace( updated ) ),
    );
  }

  // ── Key dates, questions for the buyer, addenda ──────────────────
  /** TODD reads the RFP for its dates and questions worth asking (once; returns at once after that). */
  checkKeyDates ( id: string, force = false ): Observable<Opportunity> {
    return this.http.post<Envelope<Opportunity>>( `${ this.opportunityBase( id ) }/dates/check`, { force } ).pipe( this.work.track( 'Reading the key dates', { etaSeconds: 20 } ), map( ( r ) => r.data ), tap( ( o ) => this.replace( o ) ) );
  }

  addKeyDate ( id: string, body: { kind: KeyDateKind; label?: string; date: string; where?: string } ): Observable<Opportunity> {
    return this.http.post<Envelope<Opportunity>>( `${ this.opportunityBase( id ) }/dates`, body ).pipe( map( ( r ) => r.data ), tap( ( o ) => this.replace( o ) ) );
  }

  /** Edits and picks; an item without an id is a question of the owner's own. */
  saveBuyerQuestions ( id: string, items: { id?: string; text?: string; picked?: boolean }[] ): Observable<Opportunity> {
    return this.http.patch<Envelope<Opportunity>>( `${ this.opportunityBase( id ) }/questions`, { items } ).pipe( map( ( r ) => r.data ), tap( ( o ) => this.replace( o ) ) );
  }

  /** Sends the picked questions from the person's own inbox. */
  sendBuyerQuestions ( id: string, body: { mailboxId: string; to?: string; signer?: string } ): Observable<Opportunity> {
    return this.http.post<Envelope<Opportunity>>( `${ this.opportunityBase( id ) }/questions/send`, body ).pipe( this.work.track( 'Sending your questions to the buyer', { etaSeconds: 15 } ), map( ( r ) => r.data ), tap( ( o ) => this.replace( o ) ) );
  }

  questionsCopied ( id: string ): Observable<Opportunity> {
    return this.http.post<Envelope<Opportunity>>( `${ this.opportunityBase( id ) }/questions/copied`, {} ).pipe( map( ( r ) => r.data ), tap( ( o ) => this.replace( o ) ) );
  }

  /** Addenda and the buyer's answers, newest first. */
  listUpdates ( id: string ): Observable<BuyerUpdate[]> {
    return this.http.get<Envelope<BuyerUpdate[]>>( `${ this.opportunityBase( id ) }/updates` ).pipe( map( ( r ) => r.data || [] ) );
  }

  markUpdateRead ( id: string, updateId: string ): Observable<BuyerUpdate[]> {
    return this.http.post<Envelope<BuyerUpdate[]>>( `${ this.opportunityBase( id ) }/updates/${ encodeURIComponent( updateId ) }/read`, {} ).pipe(
      map( ( r ) => r.data || [] ),
      tap( ( list ) => {
        const o = this.opportunities().find( ( x ) => x.id === id );
        if ( o ) this.replace( { ...o, unreadUpdates: list.filter( ( u ) => !u.read ).length } );
      } ),
    );
  }

  // ── After submittal ────────────────────────────────────────────
  logClarification ( id: string, question: string ): Observable<Opportunity> {
    return this.post( `${ this.opportunityBase( id ) }/clarifications`, { question } );
  }

  redraftClarification ( id: string, clarificationId: string ): Observable<Opportunity> {
    return this.post( `${ this.opportunityBase( id ) }/clarifications/${ encodeURIComponent( clarificationId ) }/draft`, {} ).pipe( this.work.track( 'Redrafting that answer', { etaSeconds: 20, confirm: 'Redrafted the answer' } ) );
  }

  /** Sends the answer to the buyer from the person's own inbox. */
  sendClarification ( id: string, clarificationId: string, body: { mailboxId: string; to?: string; answer: string; signer?: string } ): Observable<Opportunity> {
    return this.post( `${ this.opportunityBase( id ) }/clarifications/${ encodeURIComponent( clarificationId ) }/send`, body ).pipe( this.work.track( 'Sending your clarification', { etaSeconds: 15 } ) );
  }

  scheduleOrals ( id: string, body: { date: string; attendees: string[]; place: string; minutes: number } ): Observable<Opportunity> {
    return this.post( `${ this.opportunityBase( id ) }/orals`, body );
  }

  prepOrals ( id: string ): Observable<Opportunity> {
    return this.post( `${ this.opportunityBase( id ) }/orals/prep`, {} ).pipe( this.work.track( 'Writing your oral presentation prep sheet', { etaSeconds: 45, confirm: 'Your prep sheet is ready' } ) );
  }

  recordOutcome ( id: string, body: { result: 'won' | 'lost' | 'cancelled'; reason?: string } ): Observable<Opportunity> {
    return this.post( `${ this.opportunityBase( id ) }/outcome`, body );
  }

  sendDebrief ( id: string, body: { mailboxId: string; to: string; subject: string; body: string; remind: boolean; signer?: string } ): Observable<Opportunity> {
    return this.post( `${ this.opportunityBase( id ) }/debrief/send`, body ).pipe( this.work.track( 'Sending the debrief request', { etaSeconds: 15 } ) );
  }

  debriefReplied ( id: string ): Observable<Opportunity> {
    return this.post( `${ this.opportunityBase( id ) }/debrief/replied`, {} );
  }

  saveWinningSections ( id: string, sectionKeys: string[] ): Observable<{ opportunity: Opportunity; saved: number; reason: string }> {
    return this.http.post<Envelope<{ opportunity: Opportunity; saved: number; reason: string }>>( `${ this.opportunityBase( id ) }/outcome/knowledge`, { sectionKeys } ).pipe(
      this.work.track( 'Saving the winning sections to Knowledge', { etaSeconds: 30, confirm: 'Saved to Knowledge' } ),
      map( ( r ) => r.data ),
      tap( ( result ) => this.replace( result.opportunity ) ),
    );
  }

  private post ( url: string, body: object ): Observable<Opportunity> {
    return this.http.post<Envelope<Opportunity>>( url, body ).pipe( map( ( r ) => r.data ), tap( ( o ) => this.replace( o ) ) );
  }

  private opportunityBase ( id: string ): string {
    return `${ this.base }/opportunities/${ encodeURIComponent( id ) }`;
  }

  /** Profile: re-score open opportunities against the saved profile. */
  rescore (): Observable<Opportunity[]> {
    return this.http.post<Envelope<Opportunity[]>>( `${ this.base }/opportunities/rescore`, {} ).pipe(
      this.work.track( 'Re-scoring your open opportunities', { etaSeconds: 45, confirm: 'Re-scored your opportunities' } ),
      map( ( r ) => r.data || [] ),
      tap( ( updated ) => updated.forEach( ( item ) => this.replace( item ) ) ),
    );
  }

  /** "Add an RFP": reads an RFP document already in Docs (PDF directly, other files as text). */
  createFromDocument ( documentId: string, text = '' ): Observable<Opportunity[]> {
    return this.http.post<Envelope<Opportunity[]>>( `${ this.base }/opportunities`, { documentId, text: text || undefined } ).pipe(
      this.work.track( 'Reading the RFP', { etaSeconds: 60, confirm: 'Added it to Opportunities' } ),
      map( ( r ) => r.data || [] ),
      tap( ( created ) => created.forEach( ( item ) => this.replace( item ) ) ),
    );
  }

  /**
   * Draft proposal: a draft proposal document linked to the RFP, and the
   * opportunity moves to drafting. Reopens the existing draft if there is one.
   * Returns the proposal document id.
   */
  startProposal ( opportunity: Opportunity ): Observable<string> {
    if ( opportunity.proposalDocumentId ) return of( opportunity.proposalDocumentId );
    const title = `Proposal · ${ opportunity.title }`;
    return this.docs.createDocument( {
      name: title,
      title,
      type: 'proposal',
      recordKind: 'draft',
      htmlContent: '',
      status: 'draft',
      topic: opportunity.agency,
      rfpId: opportunity.rfpDocumentId || undefined,
      dueDate: opportunity.dueDate || undefined,
      summary: `For ${ opportunity.agency || 'this RFP' }${ opportunity.solicitationNumber ? ` (${ opportunity.solicitationNumber })` : '' }.`,
    } ).pipe(
      map( ( created: any ) => String( created?.id || '' ) ),
      switchMap( ( proposalId ) => this.update( opportunity.id, { status: 'drafting', proposalDocumentId: proposalId } ).pipe( map( () => proposalId ) ) ),
    );
  }

  private replace ( item: Opportunity ): void {
    const list = this.opportunities();
    const index = list.findIndex( ( o ) => o.id === item.id );
    this.opportunities.set( index >= 0 ? list.map( ( o ) => o.id === item.id ? item : o ) : [item, ...list] );
  }

  // ── Proposal editor ────────────────────────────────────────────
  /** The draft, or null before TODD has planned it. */
  getProposal ( opportunityId: string ): Observable<ProposalDraft | null> {
    return this.http.get<Envelope<ProposalDraft | null>>( `${ this.base }/opportunities/${ encodeURIComponent( opportunityId ) }/proposal` ).pipe( map( ( r ) => r.data || null ) );
  }

  planProposal ( opportunityId: string, force = false ): Observable<ProposalDraft> {
    return this.http.post<Envelope<ProposalDraft>>( `${ this.base }/opportunities/${ encodeURIComponent( opportunityId ) }/proposal/plan`, { force } ).pipe( this.work.track( 'Planning the proposal', { etaSeconds: 60, confirm: 'The proposal plan is ready' } ), map( ( r ) => r.data ) );
  }

  draftSection ( opportunityId: string, sectionKey: string ): Observable<ProposalDraft> {
    return this.http.post<Envelope<ProposalDraft>>( `${ this.base }/opportunities/${ encodeURIComponent( opportunityId ) }/proposal/sections/${ encodeURIComponent( sectionKey ) }/draft`, {} ).pipe( map( ( r ) => r.data ) );
  }

  answerQuestion ( opportunityId: string, questionId: string, body: { answer?: string; saveToKnowledge?: boolean; skip?: boolean } ): Observable<{ draft: ProposalDraft; knowledge: { saved: boolean; id?: string; reason?: string } }> {
    return this.http.post<Envelope<{ draft: ProposalDraft; knowledge: { saved: boolean; id?: string; reason?: string } }>>( `${ this.base }/opportunities/${ encodeURIComponent( opportunityId ) }/proposal/questions/${ encodeURIComponent( questionId ) }`, body ).pipe( this.work.track( 'Adding your answer to the draft', { etaSeconds: 30 } ), map( ( r ) => r.data ) );
  }

  // ── Compliance matrix ──────────────────────────────────────────
  getRequirements ( opportunityId: string ): Observable<Requirements> {
    return this.http.get<Envelope<Requirements>>( `${ this.proposalBase( opportunityId ) }/requirements` ).pipe( map( ( r ) => r.data ) );
  }

  /** Reads the RFP for requirements the first time (about a minute), then matches them to the draft. */
  checkRequirements ( opportunityId: string, force = false ): Observable<Requirements> {
    return this.http.post<Envelope<Requirements>>( `${ this.proposalBase( opportunityId ) }/requirements/check`, { force } ).pipe( this.work.track( 'Listing every requirement in the RFP', { etaSeconds: 60, confirm: 'The requirements list is ready' } ), map( ( r ) => r.data ) );
  }

  writeRequirement ( opportunityId: string, requirementId: string ): Observable<Requirements> {
    return this.http.post<Envelope<Requirements>>( `${ this.proposalBase( opportunityId ) }/requirements/${ encodeURIComponent( requirementId ) }/write`, {} ).pipe( this.work.track( 'Writing that requirement', { etaSeconds: 30, confirm: 'TODD wrote it. Review it before you accept.' } ), map( ( r ) => r.data ) );
  }

  /** Accept (with the text as edited) or discard TODD's paragraph. */
  resolveRequirement ( opportunityId: string, requirementId: string, action: 'accept' | 'discard', text = '' ): Observable<{ requirements: Requirements; draft: ProposalDraft | null; copyToEditor: boolean }> {
    return this.http.post<Envelope<{ requirements: Requirements; draft: ProposalDraft | null; copyToEditor: boolean }>>( `${ this.proposalBase( opportunityId ) }/requirements/${ encodeURIComponent( requirementId ) }/suggestion`, { action, text: text || undefined } ).pipe( map( ( r ) => r.data ) );
  }

  markRequirement ( opportunityId: string, requirementId: string, answered: boolean ): Observable<Requirements> {
    return this.http.post<Envelope<Requirements>>( `${ this.proposalBase( opportunityId ) }/requirements/${ encodeURIComponent( requirementId ) }/mark`, { answered } ).pipe( map( ( r ) => r.data ) );
  }

  // ── Score-check ────────────────────────────────────────────────
  getScoreCheck ( opportunityId: string ): Observable<ScoreCheck> {
    return this.http.get<Envelope<ScoreCheck>>( `${ this.proposalBase( opportunityId ) }/scorecheck` ).pipe( map( ( r ) => r.data ) );
  }

  /** TODD scores the draft against the RFP's points (one model call). */
  runScoreCheck ( opportunityId: string ): Observable<ScoreCheck> {
    return this.http.post<Envelope<ScoreCheck>>( `${ this.proposalBase( opportunityId ) }/scorecheck`, {} ).pipe( this.work.track( 'Scoring it the way an evaluator would', { etaSeconds: 60, confirm: 'The score check is ready' } ), map( ( r ) => r.data ) );
  }

  /** Fix this: TODD writes the revision for one criterion, or "opening". */
  writeScoreFix ( opportunityId: string, fixId: string ): Observable<ScoreCheck> {
    return this.http.post<Envelope<ScoreCheck>>( `${ this.proposalBase( opportunityId ) }/scorecheck/${ encodeURIComponent( fixId ) }/fix`, {} ).pipe( this.work.track( 'Writing that fix', { etaSeconds: 30, confirm: 'TODD wrote the fix. Review it before you accept.' } ), map( ( r ) => r.data ) );
  }

  resolveScoreFix ( opportunityId: string, fixId: string, action: 'accept' | 'discard', text = '' ): Observable<{ scoreCheck: ScoreCheck; draft: ProposalDraft | null; copyToEditor: boolean }> {
    return this.http.post<Envelope<{ scoreCheck: ScoreCheck; draft: ProposalDraft | null; copyToEditor: boolean }>>( `${ this.proposalBase( opportunityId ) }/scorecheck/${ encodeURIComponent( fixId ) }/revision`, { action, text: text || undefined } ).pipe( map( ( r ) => r.data ) );
  }

  private proposalBase ( opportunityId: string ): string {
    return `${ this.base }/opportunities/${ encodeURIComponent( opportunityId ) }/proposal`;
  }

  // ── Review & send ──────────────────────────────────────────────
  /** Sends from the person's own inbox; the opportunity comes back submitted. */
  sendProposal ( opportunityId: string, body: { mailboxId: string; to: string; subject: string; body: string; documentIds: string[] } ): Observable<Opportunity> {
    return this.http.post<Envelope<Opportunity>>( `${ this.base }/opportunities/${ encodeURIComponent( opportunityId ) }/proposal/send`, body ).pipe(
      this.work.track( 'Sending the proposal', { etaSeconds: 20 } ),
      map( ( r ) => r.data ),
      tap( ( updated ) => this.replace( updated ) ),
    );
  }

  /** Portal-only RFPs: recorded by hand after uploading on the portal. */
  markSubmitted ( opportunityId: string, note = '' ): Observable<Opportunity> {
    return this.http.post<Envelope<Opportunity>>( `${ this.base }/opportunities/${ encodeURIComponent( opportunityId ) }/proposal/submitted`, { note } ).pipe(
      map( ( r ) => r.data ),
      tap( ( updated ) => this.replace( updated ) ),
    );
  }

  // ── Inboxes ────────────────────────────────────────────────────
  listInboxes (): Observable<DocsInbox[]> {
    return this.http.get<Envelope<DocsInbox[]>>( `${ this.base }/inboxes` ).pipe( map( ( r ) => r.data || [] ) );
  }

  testInbox ( payload: object ): Observable<{ success: boolean; message: string; checks?: { smtpVerified: boolean; imapVerified: boolean } }> {
    return this.http.post<Envelope<any>>( `${ this.base }/inboxes/test`, payload ).pipe( map( ( r ) => r.data ) );
  }

  connectInbox ( payload: object ): Observable<DocsInbox> {
    return this.http.post<Envelope<DocsInbox>>( `${ this.base }/inboxes`, payload ).pipe( map( ( r ) => r.data ) );
  }

  startGoogle (): Observable<{ url: string }> {
    return this.http.post<Envelope<{ url: string }>>( `${ this.base }/inboxes/oauth/google/start`, {} ).pipe( map( ( r ) => r.data ) );
  }

  updateInbox ( id: string, changes: { watchForRfps?: boolean; rfpSenders?: string[] } ): Observable<DocsInbox & { disconnected?: boolean }> {
    return this.http.patch<Envelope<any>>( `${ this.base }/inboxes/${ encodeURIComponent( id ) }`, changes ).pipe( map( ( r ) => r.data ) );
  }

  checkInbox ( id: string ): Observable<{ checkedCount: number; newOpportunityCount: number }> {
    return this.http.post<Envelope<any>>( `${ this.base }/inboxes/${ encodeURIComponent( id ) }/check`, {} ).pipe(
      this.work.track( 'Checking your inbox for RFPs', { etaSeconds: 40 } ),
      map( ( r ) => r.data ),
      tap( () => this.loaded.set( false ) ),
    );
  }
}
