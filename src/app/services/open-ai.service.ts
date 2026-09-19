import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, tap, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { LoggerService } from './logger.service';

/**
 * Trimmed port of TODD's open-ai.service.ts, scoped to the one endpoint the
 * assistant-box pilot needs: the shared `/app-assistant` endpoint the whole
 * suite already calls, parameterized by domain. Docs asks for the
 * 'document' domain slice for document work, and 'general' for knowledge
 * questions (KnowlegeLLMService calls getAssistance(..., 'general', ...)
 * directly in TODD's original too - Knowledge was never its own backend
 * domain, it's general-purpose Q&A with client-side draft extraction on
 * top). This is a separate, new service from the existing
 * DocsOpenAiService (proposalAssistant/documentEditorAssistant) - that one
 * powers the document-editor's own AI features and isn't part of the
 * assistant-box chat, so it's untouched.
 */
@Injectable( { providedIn: 'root' } )
export class OpenAIService {
  constructor ( private http: HttpClient, private logger: LoggerService ) { }

  private wrapDataForDomain ( domain: 'general' | 'document', data?: any ): any | null {
    if ( !data ) return null;

    if ( Array.isArray( data ) ) return { docs: data };

    if ( typeof data === 'object' ) {
      if ( Array.isArray( ( data as any ).docs ) ) return data;

      const looksLikeEntity = ( obj: any ) => obj && ( obj.id || obj.title || obj.name );
      if ( looksLikeEntity( data ) && domain === 'document' ) return { docs: [data] };
      return data;
    }

    return null;
  }

  getAssistance ( prompt: string, domain: 'general' | 'document', user?: string, data?: any ): Observable<any> {
    this.logger.log( 'Calling', `${environment.backendURL}/app-assistant`, 'With this message', prompt );
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${environment.apiKey}` );
    const payload = {
      prompt,
      domain,
      data: this.wrapDataForDomain( domain, data )
    };

    return this.http
      .post<any>( `${environment.backendURL}/app-assistant`, payload, { headers } )
      .pipe(
        tap( ( res ) => {
          try {
            this.logger.info( 'APP_ASSISTANT_RAW_RESPONSE', { domain, type: typeof res } );
          } catch { /* ignore */ }
        } ),
        catchError( ( err: any ) => {
          this.logger.error( 'APP_ASSISTANT_ERROR', { domain, err } );
          return throwError( () => err );
        } )
      );
  }

  getDocumentAssistantResponse ( prompt: string, userId: string, data: any ): Observable<any> {
    return this.getAssistance( prompt, 'document', userId, data );
  }
}
