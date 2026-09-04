import { Injectable } from '@angular/core';
import { addDoc, collection, deleteDoc, doc, getDocs, getFirestore } from 'firebase/firestore';
import { Dropdown } from '../models/dropdown.model';

/**
 * Trimmed, Firestore-direct replacement for the slice of TODD's DataService
 * that InputTypeAheadComponent/DropDownEditButtonComponent use -
 * `getCollectionData(endpointKey, user)` / `addDocument` / `deleteDocument`
 * against `tenants/{tenantId}/{collection}`, same convention
 * web-products/network's own NetworkDataService already uses. Response Flow
 * is the only page in this app that needs a dropdown-editable collection
 * (Knowledge Base categories), so only that one ENDPOINTS mapping is
 * carried over rather than the monorepo's full ~30-key ENDPOINTS table.
 */
const COLLECTION_PATHS: Record<string, string> = {
  KNOWLEDGE_BASE_CATEGORIES: 'knowledge-categories',
};

@Injectable( { providedIn: 'root' } )
export class DocsDropdownService {
  private get firestore () {
    return getFirestore();
  }

  private resolvePath ( collectionKey: string ): string {
    return COLLECTION_PATHS[collectionKey] || collectionKey;
  }

  async getItems ( tenantId: string, collectionKey: string ): Promise<Dropdown[]> {
    if ( !tenantId ) return [];
    const ref = collection( this.firestore, `tenants/${tenantId}/${this.resolvePath( collectionKey )}` );
    const snap = await getDocs( ref );
    return snap.docs.map( ( d ) => ( { id: d.id, ...( d.data() as any ) } ) as Dropdown );
  }

  async addItem ( tenantId: string, collectionKey: string, name: string ): Promise<string> {
    const ref = collection( this.firestore, `tenants/${tenantId}/${this.resolvePath( collectionKey )}` );
    const docRef = await addDoc( ref, { name } );
    return docRef.id;
  }

  async removeItem ( tenantId: string, collectionKey: string, id: string ): Promise<void> {
    const ref = collection( this.firestore, `tenants/${tenantId}/${this.resolvePath( collectionKey )}` );
    await deleteDoc( doc( ref, id ) );
  }
}
