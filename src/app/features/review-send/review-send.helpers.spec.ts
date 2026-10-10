import { defaultBody, defaultSender, defaultSubject, isNoReply, whyThisAddress } from './review-send.helpers';

describe( 'review & send helpers', () => {
  const o = { agency: 'King County', solicitationNumber: 'RFP 2026-118', title: 'Permit Portal Modernization', submission: { method: 'email' as const, email: 'bids@kingcounty.gov' }, source: { kind: 'email' as const, label: '', from: 'no-reply@kingcounty.gov', subject: '', receivedAt: '', mailboxId: '' } };

  it( 'writes the subject and a short cover email', () => {
    expect( defaultSubject( o, 'Taliferro Tech' ) ).toBe( 'RFP 2026-118 Permit Portal Modernization — Taliferro Tech' );
    expect( defaultBody( o, { name: 'Dana Reyes', company: 'Taliferro Tech, LLC' }, ['Proposal.pdf', 'Attachment B (signed).pdf', 'Certificate of insurance.pdf'] ) ).toBe(
      'Dear King County Procurement,\n\nTaliferro Tech, LLC is pleased to submit our proposal for RFP 2026-118, Permit Portal Modernization. The proposal, Attachment B (signed).pdf and Certificate of insurance.pdf are attached.\n\nPlease let me know if you need anything else.\n\nDana Reyes\nTaliferro Tech, LLC',
    );
  } );

  it( 'joins one extra attachment with "and"', () => {
    expect( defaultBody( o, { name: 'Dana', company: '' }, ['Proposal.pdf', 'Attachment B.pdf'] ) ).toContain( 'We are pleased to submit our proposal for RFP 2026-118, Permit Portal Modernization. The proposal and Attachment B.pdf are attached.' );
  } );

  it( 'explains the address, and never treats a no-reply as one', () => {
    expect( isNoReply( 'no-reply@kingcounty.gov' ) ).toBeTrue();
    expect( whyThisAddress( o, 'bids@kingcounty.gov' ) ).toContain( 'which can\'t receive mail' );
    expect( whyThisAddress( o, 'other@kingcounty.gov' ) ).toContain( 'You changed this' );
    expect( whyThisAddress( { ...o, submission: { method: 'unknown', email: '' } }, '' ) ).toContain( 'didn\'t say where' );
  } );

  it( 'sends from an inbox Outreach already sends from', () => {
    const inboxes = [
      { id: 'bids', purposes: ['rfp'], status: 'connected' },
      { id: 'info', purposes: ['outreach', 'rfp'], status: 'connected' },
    ] as any;
    expect( defaultSender( inboxes )?.id ).toBe( 'info' );
    expect( defaultSender( [] ) ).toBeNull();
  } );
} );
