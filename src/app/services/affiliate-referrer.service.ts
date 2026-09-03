import { Injectable } from '@angular/core';

/**
 * Deliberately minimal stand-in for the real AffiliateTrackingService
 * (264 lines: URL-param capture, session/local storage promotion, legacy
 * referral-code fallback, route-change "touch" tracking). Checkout works
 * fine with no referrerUid at all (it's an optional field), so full
 * affiliate attribution wasn't ported. Ported unchanged from
 * web-products/network's AffiliateReferrerService.
 */
@Injectable( { providedIn: 'root' } )
export class AffiliateReferrerService {
  getReferrerUid (): string | null {
    return null;
  }
}
