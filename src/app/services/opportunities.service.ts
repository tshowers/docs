import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { DocsInbox, FIT_THRESHOLD, Opportunity, OpportunityStatus, ProposalDraft, isOpen } from '../models/opportunity';
import { DocService } from './doc.service';

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

  /** Profile: re-score open opportunities against the saved profile. */
  rescore (): Observable<Opportunity[]> {
    return this.http.post<Envelope<Opportunity[]>>( `${ this.base }/opportunities/rescore`, {} ).pipe(
      map( ( r ) => r.data || [] ),
      tap( ( updated ) => updated.forEach( ( item ) => this.replace( item ) ) ),
    );
  }

  /** "Add an RFP": reads an RFP document already in Docs (PDF directly, other files as text). */
  createFromDocument ( documentId: string, text = '' ): Observable<Opportunity[]> {
    return this.http.post<Envelope<Opportunity[]>>( `${ this.base }/opportunities`, { documentId, text: text || undefined } ).pipe(
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
    return this.http.post<Envelope<ProposalDraft>>( `${ this.base }/opportunities/${ encodeURIComponent( opportunityId ) }/proposal/plan`, { force } ).pipe( map( ( r ) => r.data ) );
  }

  draftSection ( opportunityId: string, sectionKey: string ): Observable<ProposalDraft> {
    return this.http.post<Envelope<ProposalDraft>>( `${ this.base }/opportunities/${ encodeURIComponent( opportunityId ) }/proposal/sections/${ encodeURIComponent( sectionKey ) }/draft`, {} ).pipe( map( ( r ) => r.data ) );
  }

  answerQuestion ( opportunityId: string, questionId: string, body: { answer?: string; saveToKnowledge?: boolean; skip?: boolean } ): Observable<{ draft: ProposalDraft; knowledge: { saved: boolean; id?: string; reason?: string } }> {
    return this.http.post<Envelope<{ draft: ProposalDraft; knowledge: { saved: boolean; id?: string; reason?: string } }>>( `${ this.base }/opportunities/${ encodeURIComponent( opportunityId ) }/proposal/questions/${ encodeURIComponent( questionId ) }`, body ).pipe( map( ( r ) => r.data ) );
  }

  // ── Review & send ──────────────────────────────────────────────
  /** Sends from the person's own inbox; the opportunity comes back submitted. */
  sendProposal ( opportunityId: string, body: { mailboxId: string; to: string; subject: string; body: string; documentIds: string[] } ): Observable<Opportunity> {
    return this.http.post<Envelope<Opportunity>>( `${ this.base }/opportunities/${ encodeURIComponent( opportunityId ) }/proposal/send`, body ).pipe(
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
      map( ( r ) => r.data ),
      tap( () => this.loaded.set( false ) ),
    );
  }
}
