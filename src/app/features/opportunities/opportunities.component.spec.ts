import { checkedAgo, senderNames } from './opportunities.component';
import { normalizeSender } from '../rfp-inbox/rfp-inbox.component';

describe( 'opportunities helpers', () => {
  it( 'names alert senders the way people say them', () => {
    expect( senderNames( ['procurement-notifications@opengov.com', 'no-reply@kingcounty.gov', 'no-reply@gobonfire.com'] ) ).toBe( 'OpenGov, King County and Bonfire' );
    expect( senderNames( ['@bidnet.com'] ) ).toBe( 'BidNet' );
    expect( senderNames( ['a@city.gov', 'b@city.gov'] ) ).toBe( 'city.gov' );
  } );

  it( 'says how long ago the inbox was checked', () => {
    const now = new Date( '2026-10-10T12:00:00Z' );
    expect( checkedAgo( '2026-10-10T11:59:40Z', now ) ).toBe( 'just now' );
    expect( checkedAgo( '2026-10-10T11:55:00Z', now ) ).toBe( '5 min ago' );
    expect( checkedAgo( '2026-10-10T10:00:00Z', now ) ).toBe( '2 hours ago' );
    expect( checkedAgo( '', now ) ).toBe( '' );
  } );

  it( 'accepts sender addresses and bare domains, like the server', () => {
    expect( normalizeSender( ' No-Reply@GoBonfire.com ' ) ).toBe( 'no-reply@gobonfire.com' );
    expect( normalizeSender( 'bidnet.com' ) ).toBe( '@bidnet.com' );
    expect( normalizeSender( 'not an address' ) ).toBe( '' );
  } );
} );
