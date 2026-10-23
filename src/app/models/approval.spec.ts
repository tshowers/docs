import { allLinksText, approvalLink, approverLine, describeEvent, initials, parseApprover, sectionsOf, shareMessage, shortWhen, splitRole, suggestedApproveBy } from './approval';

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

  describe( 'the Approvers card (lifecycle 1m)', () => {
    const now = new Date( 2026, 9, 22, 15 );
    const base = { id: 'a1', name: 'Marcus Reed', email: '', token: 'tok-1234567890abcdefghij', approvedVersion: 0, message: '', openedAt: '', decidedAt: '', sharedAt: '' };

    it( 'says where each approver is', () => {
      expect( approverLine( { ...base, state: 'approved', approvedVersion: 3, decidedAt: new Date( 2026, 9, 22, 14, 14 ).toISOString() }, 3, now ) ).toEqual( { text: 'Approved v3 · 2:14 PM', tone: 'good' } );
      expect( approverLine( { ...base, state: 'reviewing', openedAt: new Date( 2026, 9, 22, 13, 50 ).toISOString() }, 3, now ).text ).toBe( 'Opened 1:50 PM · not decided' );
      expect( approverLine( { ...base, state: 'waiting', sharedAt: now.toISOString() }, 3, now ).text ).toBe( 'Link copied · not opened' );
      expect( approverLine( { ...base, state: 'waiting' }, 3, now ).text ).toBe( 'Link not sent yet' );
      expect( approverLine( { ...base, state: 'recheck', approvedVersion: 2 }, 3, now ).text ).toBe( 'Approved v2 · this is v3' );
      expect( approverLine( { ...base, state: 'changes', decidedAt: new Date( 2026, 9, 20 ).toISOString() }, 3, now ) ).toEqual( { text: 'Asked for changes · Oct 20', tone: 'bad' } );
    } );

    it( 'takes a role after the name', () => {
      expect( splitRole( 'Marcus Reed, Accountant' ) ).toEqual( { name: 'Marcus Reed', role: 'Accountant' } );
      expect( splitRole( 'Cascade Data · Subcontractor' ) ).toEqual( { name: 'Cascade Data', role: 'Subcontractor' } );
      expect( splitRole( 'Dana Lee' ) ).toEqual( { name: 'Dana Lee', role: '' } );
    } );

    it( 'copies one line per person still to approve', () => {
      const text = allLinksText( [{ ...base, state: 'reviewing' }, { ...base, id: 'a2', name: 'Dana Lee', token: 'tok-2', state: 'approved' }], 'Tyrone', 'Pierce County' );
      expect( text ).toContain( 'Tyrone would like your OK on our proposal to Pierce County.' );
      expect( text ).toContain( `Marcus Reed: ${ approvalLink( 'tok-1234567890abcdefghij' ) }` );
      expect( text ).not.toContain( 'Dana Lee' );
    } );
  } );
} );
