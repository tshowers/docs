import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Trimmed from services/open-ai.service.ts (a large service backing many
 * of TODD's AI features) to just the two calls DocumentEditorComponent
 * needs - both against the same `${backendURL}/document-helper` endpoint
 * the monorepo hits, so no backend changes are needed. Drops the
 * DataService.logEvent() analytics call each method made (fire-and-forget
 * usage logging, not core to the feature - same call this app already
 * drops elsewhere, e.g. NetworkPurchaseFlowService's dropped
 * trackCheckoutStarted/trackPaidConversion).
 */
@Injectable( {
  providedIn: 'root'
} )
export class DocsOpenAiService {
  constructor ( private http: HttpClient ) { }

  private authHeaders (): HttpHeaders {
    return new HttpHeaders().set( 'Authorization', `Bearer ${environment.apiKey}` );
  }

  proposalAssistant ( document: string, rfp: any, proposals: any[], user: string ): Observable<any> {
    const prompt = `
    You are a government RFP proposal writer for a tech consulting firm. Based on the RFP document and the company’s historical proposals, generate a proposal that includes:

    - Cover letter
    - Company qualifications
    - Technical approach
    - Key staff
    - Relevant past performance
    - Pricing section (placeholder)

    Use the structure and tone from the attached reference proposals. Use the company’s known certifications, services, and project history.

    If any required information is missing, insert a [PLACEHOLDER] for user to complete.`;

    return this.http.post<any>(
      `${environment.backendURL}/document-helper`,
      { document, prompt, rfp, proposals },
      { headers: this.authHeaders() }
    );
  }

  documentEditorAssistant ( instructions: string, html: string, user: string ): Observable<any> {
    return this.http.post<any>(
      `${environment.backendURL}/document-helper`,
      { instructions, html },
      { headers: this.authHeaders() }
    );
  }
}
