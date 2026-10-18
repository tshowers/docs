import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { ApprovalComment, ApprovalPayload, ApprovalRequest, GuestApproval } from '../models/approval';

interface Envelope<T> { success: boolean; data: T; message?: string; }

/**
 * Approval before sending. The owner's side is under
 * /api/docs/opportunities/:id/approval (signed in); approvers use
 * /api/public/approvals/:token, where the link is the only access needed.
 */
@Injectable( { providedIn: 'root' } )
export class ApprovalsService {
  private readonly http = inject( HttpClient );
  private readonly base = `${ environment.backendURL }/docs/opportunities`;
  private readonly guestBase = `${ environment.backendURL }/public/approvals`;

  private url ( opportunityId: string, path = '' ): string {
    return `${ this.base }/${ encodeURIComponent( opportunityId ) }/approval${ path }`;
  }

  /** The request, or null when approval wasn't asked for. */
  get ( opportunityId: string ): Observable<ApprovalRequest | null> {
    return this.http.get<Envelope<ApprovalRequest | null>>( this.url( opportunityId ) ).pipe( map( ( r ) => r.data || null ) );
  }

  /** Ask, change approvers, or ask again after an edit. */
  save ( opportunityId: string, payload: ApprovalPayload ): Observable<ApprovalRequest> {
    return this.http.post<Envelope<ApprovalRequest>>( this.url( opportunityId ), payload ).pipe( map( ( r ) => r.data ) );
  }

  recordShared ( opportunityId: string, approverId: string, via: 'copy' | 'email' | 'message' | 'share' ): Observable<unknown> {
    return this.http.post<Envelope<unknown>>( this.url( opportunityId, `/approvers/${ encodeURIComponent( approverId ) }/shared` ), { via } );
  }

  bypass ( opportunityId: string, reason: string ): Observable<ApprovalRequest> {
    return this.http.post<Envelope<ApprovalRequest>>( this.url( opportunityId, '/bypass' ), { reason } ).pipe( map( ( r ) => r.data ) );
  }

  resolveComment ( opportunityId: string, commentId: string, action: 'accept' | 'reject' | 'reply', reply = '' ): Observable<ApprovalRequest> {
    return this.http.post<Envelope<ApprovalRequest>>( this.url( opportunityId, `/comments/${ encodeURIComponent( commentId ) }` ), { action, reply } ).pipe( map( ( r ) => r.data ) );
  }

  // ── Approvers, from their link ─────────────────────────────────
  open ( token: string ): Observable<GuestApproval> {
    return this.http.get<Envelope<GuestApproval>>( `${ this.guestBase }/${ encodeURIComponent( token ) }` ).pipe( map( ( r ) => r.data ) );
  }

  comment ( token: string, body: { sectionTitle: string; quote: string; text: string; replacement?: string } ): Observable<ApprovalComment> {
    return this.http.post<Envelope<ApprovalComment>>( `${ this.guestBase }/${ encodeURIComponent( token ) }/comments`, body ).pipe( map( ( r ) => r.data ) );
  }

  decide ( token: string, decision: 'approve' | 'changes', message: string ): Observable<GuestApproval> {
    return this.http.post<Envelope<GuestApproval>>( `${ this.guestBase }/${ encodeURIComponent( token ) }/decision`, { decision, message } ).pipe( map( ( r ) => r.data ) );
  }
}
