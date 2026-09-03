import { Injectable } from '@angular/core';
import { collection, doc, getDoc, getFirestore } from 'firebase/firestore';

/**
 * Trimmed, Firestore-direct data layer for the standalone Docs app -
 * mirrors DataService.getContactFullByIdOnce(contactId, user) the same
 * way web-products/network's NetworkDataService.getContact does. Docs and
 * Knowledge pricing pages both need a tenant's own contact doc to read
 * per-tenant custom pricing overrides off `company.products`; nothing
 * else in this app reads/writes the tenants/{tenantId}/contacts
 * collection, so only that one read is ported here.
 */
@Injectable( { providedIn: 'root' } )
export class DocsDataService {
  private get firestore () {
    return getFirestore();
  }

  /** Mirrors DataService.getContactFullByIdOnce(contactId, user). */
  async getContact ( tenantId: string, contactId: string ): Promise<any | null> {
    if ( !contactId ) return null;
    const contactsRef = collection( this.firestore, `tenants/${tenantId}/contacts` );
    const snap = await getDoc( doc( contactsRef, contactId ) );
    return snap.exists() ? { id: snap.id, ...( snap.data() as any ) } : null;
  }
}
