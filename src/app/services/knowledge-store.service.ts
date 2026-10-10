import { Injectable, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap, take, tap } from 'rxjs/operators';

import { KnowledgeItem, normalizeKnowledge } from '../models/knowledge';
import { DocsAuthService } from './docs-auth.service';
import { DocumentResultSet } from './documents-store.service';
import { ResponseFlowService } from './response-flow.service';

/**
 * The tenant's Knowledge answers, shared by the grid (1g) and the answer
 * view (2d) so stepping prev/next never refetches. Guests have no answers;
 * the response-flows API needs a signed-in user.
 */
@Injectable( { providedIn: 'root' } )
export class KnowledgeStoreService {
  private readonly api = inject( ResponseFlowService );
  private readonly auth = inject( DocsAuthService );

  readonly items = signal<KnowledgeItem[]>( [] );
  readonly loaded = signal( false );
  readonly signedIn = signal( false );
  readonly resultSet = signal<DocumentResultSet | null>( null );

  private inflight: Observable<KnowledgeItem[]> | null = null;

  load ( force = false ): Observable<KnowledgeItem[]> {
    if ( this.loaded() && !force ) return of( this.items() );
    if ( this.inflight && !force ) return this.inflight;
    this.inflight = this.auth.getUserId().pipe(
      take( 1 ),
      tap( ( userId ) => this.signedIn.set( !!userId ) ),
      switchMap( ( userId ) => userId ? this.api.getResponseFlows() : of( [] ) ),
      map( ( items ) => ( Array.isArray( items ) ? items : [] ).map( normalizeKnowledge ) ),
      catchError( () => of( [] as KnowledgeItem[] ) ),
      tap( ( items ) => {
        this.items.set( items );
        this.loaded.set( true );
        this.inflight = null;
      } ),
      shareReplay( 1 ),
    );
    return this.inflight;
  }

  byId ( id: string ): KnowledgeItem | undefined {
    return this.items().find( ( item ) => item.id === String( id ) );
  }

  remove ( id: string ): void {
    this.items.update( ( items ) => items.filter( ( item ) => item.id !== String( id ) ) );
    const set = this.resultSet();
    if ( set ) this.resultSet.set( { ...set, ids: set.ids.filter( ( item ) => item !== String( id ) ) } );
  }
}
