import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/**
 * Ported near-verbatim from taliferrotech's features/knowledge/response-flow.service.ts.
 *
 * The backend (kb.controller.js) wraps every response in an envelope -
 * `{ success, items }` for the list endpoint and `{ success, item }` for the
 * single-entry endpoints - so responses are unwrapped the same way
 * DocService does for `${backendURL}/docs` (`response?.documents ?? response`).
 * Without it, `getResponseFlows()` hands the raw `{ success, items }` object
 * to the Knowledge Base's `*ngFor`, which throws NG0900 since it isn't an array.
 */
@Injectable( {
  providedIn: 'root'
} )
export class ResponseFlowService {

  private readonly baseUrl = `${environment.backendURL}/response-flows`;

  constructor ( private http: HttpClient ) { }

  createResponseFlow ( flow: any ): Observable<any> {
    return this.http.post<any>( this.baseUrl, flow ).pipe(
      map( response => response?.item ?? response )
    );
  }

  getResponseFlows (): Observable<any[]> {
    return this.http.get<any>( this.baseUrl ).pipe(
      map( response => response?.items ?? response )
    );
  }

  getResponseFlow ( id: string ): Observable<any> {
    return this.http.get<any>( `${this.baseUrl}/${id}` ).pipe(
      map( response => response?.item ?? response )
    );
  }

  updateResponseFlow ( id: string, flow: any ): Observable<any> {
    return this.http.put<any>( `${this.baseUrl}/${id}`, flow ).pipe(
      map( response => response?.item ?? response )
    );
  }

  removeResponseFlow ( id: string ): Observable<any> {
    return this.http.delete<any>( `${this.baseUrl}/${id}` );
  }
}
