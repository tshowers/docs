import { Injectable } from '@angular/core';
import {
  Auth,
  getAuth,
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { Observable, shareReplay, switchMap, of, tap } from 'rxjs';

/**
 * Auth service for the standalone Docs app (Docs + Knowledge, both under
 * one deployment). Sign-in itself doesn't happen here - it redirects to
 * TODD's hosted login (todd.taliferro.tech/login), the same page every
 * other TODD client (network-web, network-ios/pulse-ios via TODDAuthKit's
 * HostedLogin) opens, so every TODD client presents the identical sign-in
 * screen instead of each maintaining its own copy of Google/Apple/
 * email-link/phone code that can drift out of sync. This service only
 * holds the two things every client still needs locally: completing the
 * redirect back from that page, and tenant/session reads.
 *
 * `client=docs-web` is used for both Docs and Knowledge routes - the
 * backend's authClients.js only defines docs-web/docs-ios, there is no
 * separate knowledge-web client, so Knowledge authenticates under the
 * same client as Docs.
 *
 * Ported line-for-line from web-products/network's NetworkAuthService,
 * with only the pending-login storage key and hosted-login `client` param
 * changed. Mirrors the exact same tenant resolution TODD's own
 * AuthService uses (`resolveAssignedTenantId`): `users/{uid}.companyId`
 * if set, else the uid itself is the tenant.
 */
@Injectable( { providedIn: 'root' } )
export class DocsAuthService {
  private get auth (): Auth {
    return getAuth();
  }

  private userId$?: Observable<string>;
  private tenantId$?: Observable<string>;

  /**
   * Mirrors TODD's own AuthService.getTenant() (a sync read backed by a
   * cached tenantId), needed here because DocService/ResponseFlowService
   * are plain HttpClient calls with no per-request header building of
   * their own - unlike web-products/network, which only ever talks to
   * Firestore directly or to endpoints that build headers by hand
   * (AccountBillingService), Docs relies on a global HTTP interceptor
   * (see docs-tenant.interceptor.ts) to attach x-tenant-id/x-user-id/
   * x-user-email, and interceptors can't await an Observable.
   */
  private lastKnownTenantId = '';

  private readonly pendingLoginStorageKey = 'docs_hosted_login_pending';

  getUser (): Observable<User | null> {
    return new Observable( ( subscriber ) => {
      const unsubscribe = onAuthStateChanged( this.auth, ( user ) => subscriber.next( user ) );
      return unsubscribe;
    } );
  }

  /** Matches TODD's own AuthService.getUserId() shape - components ported
   * from features/document/* and features/knowledge/* call this by name,
   * so keeping the signature identical means the rest of a component's
   * logic ports unchanged. */
  getUserId (): Observable<string> {
    if ( !this.userId$ ) {
      this.userId$ = new Observable<string>( ( subscriber ) => {
        const unsubscribe = onAuthStateChanged( this.auth, ( user ) => subscriber.next( user?.uid || '' ) );
        return unsubscribe;
      } ).pipe( shareReplay( { bufferSize: 1, refCount: false } ) );
    }
    return this.userId$;
  }

  /** Resolved once per session and shared - every ported component needs
   * this for `tenants/{tenantId}/...` reads, so it's cached here rather
   * than making each component re-resolve it. */
  getTenantId (): Observable<string> {
    if ( !this.tenantId$ ) {
      this.tenantId$ = this.getUserId().pipe(
        switchMap( ( uid ) => ( uid ? this.resolveTenantId( uid ) : of( '' ) ) ),
        tap( ( tenantId ) => { this.lastKnownTenantId = tenantId; } ),
        shareReplay( { bufferSize: 1, refCount: false } ),
      );
    }
    return this.tenantId$;
  }

  /**
   * Sync counterpart to getTenantId(), for the HTTP interceptor - see the
   * field comment above. Falls back to the signed-in uid (same default
   * TODD's own AuthService.getTenant() sync path uses before its
   * companyId lookup resolves) rather than returning nothing, since for
   * the common case - no companyId override - that fallback IS the
   * correct tenantId, not just a placeholder.
   */
  getTenantIdSync (): string {
    return this.lastKnownTenantId || this.getCurrentUserIdSync();
  }

  isLoggedIn (): Observable<boolean> {
    return new Observable( ( subscriber ) => {
      const unsubscribe = onAuthStateChanged( this.auth, ( user ) => subscriber.next( !!user ) );
      return unsubscribe;
    } );
  }

  getCurrentUserIdSync (): string {
    return this.auth.currentUser?.uid || '';
  }

  getCurrentUserEmailSync (): string {
    return String( this.auth.currentUser?.email || '' ).trim().toLowerCase();
  }

  /**
   * Leaves the app entirely for TODD's hosted login
   * (todd.taliferro.tech/login?client=docs-web&state=...), the same page
   * every TODD client signs in through. `state` is a random value stashed
   * alongside `returnUrl` in sessionStorage before leaving, and checked
   * again in AuthCallbackComponent when the page sends the user back - a
   * CSRF guard against a forged callback.
   */
  signIn ( returnUrl?: string ): void {
    const state = crypto.randomUUID();
    sessionStorage.setItem( this.pendingLoginStorageKey, JSON.stringify( { state, returnUrl } ) );
    const client = this.isLocalDevelopmentHost() ? 'docs-web-local' : 'docs-web';
    window.location.href = `https://todd.taliferro.tech/login?client=${client}&state=${state}`;
  }

  private isLocalDevelopmentHost (): boolean {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }

  /**
   * Reads back what signIn() stashed before leaving, verifies the state
   * value matches what the hosted login page is handing back, and clears
   * it either way so a stale/reused entry can't validate a later attempt.
   */
  consumePendingLogin ( state: string | null ): { returnUrl?: string } | null {
    const raw = sessionStorage.getItem( this.pendingLoginStorageKey );
    sessionStorage.removeItem( this.pendingLoginStorageKey );
    if ( !raw ) return null;

    try {
      const pending = JSON.parse( raw ) as { state: string; returnUrl?: string };
      if ( !state || pending.state !== state ) return null;
      return { returnUrl: pending.returnUrl };
    } catch {
      return null;
    }
  }

  /** Redeems the custom token AuthCallbackComponent received from the hosted login page. */
  async signInWithCustomToken ( token: string ): Promise<User> {
    const result = await signInWithCustomToken( this.auth, token );
    return result.user;
  }

  async signOut (): Promise<void> {
    await signOut( this.auth );
  }

  /**
   * Same rule as `users.service.ts`'s `getTenantLoggedInContactInfo` /
   * web-products/network's NetworkAuthService.resolveTenantId - not a guess.
   */
  async resolveTenantId ( uid: string ): Promise<string> {
    const snap = await getDoc( doc( getFirestore(), 'users', uid ) );
    const companyId = String( ( snap.data() as any )?.companyId || '' ).trim();
    return companyId || uid;
  }
}
