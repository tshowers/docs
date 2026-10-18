import { approvalLink, describeEvent, initials, parseApprover, sectionsOf, shareMessage, shortWhen, suggestedApproveBy } from './approval';

describe( 'approval helpers', () => {
  it( 'reads a name, an email, or "Name <email>" as an approver', () => {
    expect( parseApprover( 'Jordan@ParkITO.law' ) ).toEqual( { name: '', email: 'jordan@parkito.law' } );
    expect( parseApprover( 'Jordan Park <jordan@parkito.law>' ) ).toEqual( { name: 'Jordan Park', email: 'jordan@parkito.law' } );
    expect( parseApprover( 'Marcus Lee,' ) ).toEqual( { name: 'Marcus Lee', email: '' } );
    expect( parseApprover( 'jordan@' ) ).toBeNull();
    expect( parseApprover( '  ' ) ).toBeNull();
  } );

  it( 'makes initials from a name, or from an email when there is no name', () => {
    expect( initials( 'Marcus Lee' ) ).toBe( 'ML' );
    expect( initials( '', 'jordan.park@parkito.law' ) ).toBe( 'JP' );
    expect( initials( '', 'jordan@parkito.law' ) ).toBe( 'J' );
  } );

  it( 'suggests approve-by times before the RFP is due, on working days', () => {
    const due = new Date( 2026, 9, 24, 17, 0 ); // Sat Oct 24, 5 PM
    const now = new Date( 2026, 9, 18, 9, 0 );
    const [first, second] = suggestedApproveBy( due, now );
    expect( shortWhen( first ) ).toBe( 'Wed, 5 PM' );
    expect( shortWhen( second ) ).toBe( 'Thu, noon' );
    expect( suggestedApproveBy( due, new Date( 2026, 9, 24, 16, 0 ) ) ).toEqual( [] );
  } );

  it( 'writes the note the owner sends with a link, with no TODD sender involved', () => {
    const link = approvalLink( 'tok123', 'https://docs.taliferro.tech' );
    expect( link ).toBe( 'https://docs.taliferro.tech/approve/tok123' );
    const m = shareMessage( { ownerName: 'Dana Reyes', buyer: 'King County', dueAt: '', note: 'Check section 5.' }, { name: 'Jordan Park', email: '' }, link );
    expect( m.subject ).toBe( 'Can you approve our proposal to King County?' );
    expect( m.body ).toContain( 'Hi Jordan,' );
    expect( m.body ).toContain( 'Check section 5.' );
    expect( m.body ).toContain( link );
    expect( m.body ).toContain( 'You don\'t need an account' );
    expect( m.sms ).toContain( link );
  } );

  it( 'lists sections and describes Activity', () => {
    expect( sectionsOf( '<h2>5. Pricing</h2><p>x</p><h3>5.2 <b>Terms</b></h3>' ) ).toEqual( ['5. Pricing', '5.2 Terms'] );
    expect( describeEvent( { type: 'requested', actor: 'Dana', at: '', meta: { names: ['Marcus Lee', 'Jordan'] } } ).text ).toBe( 'You asked Marcus Lee and Jordan to approve' );
    expect( describeEvent( { type: 'bypassed', actor: 'Dana', at: '', meta: { reason: 'Deadline' } } ).text ).toContain( 'Deadline' );
  } );
} );
