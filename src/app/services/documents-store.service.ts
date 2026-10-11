import { Injectable, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap, take, tap } from 'rxjs/operators';

import { Document } from '../models/document.model';
import { DocService } from './doc.service';
import { DocsAuthService } from './docs-auth.service';

/** The list a single-document page steps through: "5 of 8", Back "To 8 found for king county". */
export interface DocumentResultSet {
  ids: string[];
  /** "8 found for king county", "12 documents", "3 RFPs". */
  label: string;
  /** Where Back goes, with the search and filter that built the list. */
  returnUrl: string;
  returnQuery: Record<string, string>;
  scrollY: number;
}

/**
 * The tenant's documents, loaded once and shared by the Documents grid and
 * the single-document view, so opening a card and stepping prev/next never
 * refetches. Guests get the API's browse-mode response like before.
 */
@Injectable( { providedIn: 'root' } )
export class DocumentsStoreService {
  private readonly docService = inject( DocService );
  private readonly auth = inject( DocsAuthService );

  readonly documents = signal<Document[]>( [] );
  readonly loaded = signal( false );
  readonly tenantId = signal( '' );
  readonly resultSet = signal<DocumentResultSet | null>( null );

  private inflight: Observable<Document[]> | null = null;

  /** Loads (or reuses) the tenant's documents. `force` refetches after a change. */
  load ( force = false ): Observable<Document[]> {
    if ( this.loaded() && !force ) return of( this.documents() );
    if ( this.inflight && !force ) return this.inflight;
    this.inflight = this.auth.getTenantId().pipe(
      take( 1 ),
      tap( ( tenantId ) => this.tenantId.set( String( tenantId || '' ) ) ),
      switchMap( ( tenantId ) => this.docService.getDocuments( String( tenantId || '' ) ) ),
      map( ( response: any ) => ( Array.isArray( response ) ? response : response?.documents || [] ) as Document[] ),
      catchError( () => of( [] as Document[] ) ),
      tap( ( docs ) => {
        this.documents.set( docs );
        this.loaded.set( true );
        this.inflight = null;
      } ),
      shareReplay( 1 ),
    );
    return this.inflight;
  }

  byId ( id: string ): Document | undefined {
    return this.documents().find( ( doc ) => String( doc.id ) === String( id ) );
  }

  /** Replaces one document after an edit, keeping its place in the list. */
  replace ( updated: Document ): void {
    this.documents.update( ( docs ) => docs.map( ( doc ) => String( doc.id ) === String( updated.id ) ? { ...doc, ...updated } : doc ) );
  }

  remove ( id: string ): void {
    this.documents.update( ( docs ) => docs.filter( ( doc ) => String( doc.id ) !== String( id ) ) );
    const set = this.resultSet();
    if ( set ) this.resultSet.set( { ...set, ids: set.ids.filter( ( item ) => item !== String( id ) ) } );
  }
}
