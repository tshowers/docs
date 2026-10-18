// An approver opens their private link signed out: no account, no sign-in.
const view = {
  readOnly: false,
  status: 'waiting',
  ownerName: 'Dana Reyes',
  company: 'Taliferro Tech',
  note: 'Can you check pricing in section 5?',
  rule: 'all',
  dueAt: '2026-10-21T17:00:00.000Z',
  allowSuggestions: true,
  version: 3,
  opportunity: { title: 'Permit Portal Modernization', agency: 'King County', solicitationNumber: 'RFP 2026-118', dueDate: '2099-10-24', portalOnly: false },
  email: { to: 'bids@kingcounty.gov', subject: 'RFP 2026-118', body: 'Dear King County Procurement,' },
  attachments: [{ name: 'Attachment B (signed).pdf', detail: '1 pp' }],
  checklist: { ok: 6, total: 6 },
  html: '<h2>5. Pricing</h2><p>We propose a fixed price.</p><h3>5.2 Terms</h3><p>Liability is limited to the fees paid.</p>',
  previousHtml: '',
  previousVersion: 0,
  linkExpiresAt: '2099-10-24T23:59:59.000Z',
  me: { id: 'a2', name: '', email: 'jordan@parkito.law', state: 'reviewing', message: '', decidedAt: '' },
  others: [{ name: 'Marcus Lee', state: 'approved', decidedAt: '2026-10-20T21:31:00.000Z' }],
  comments: [],
};

describe( 'Approve from a private link', () => {
  it( 'shows the proposal and records an approval without signing in', () => {
    cy.intercept( 'GET', '**/public/approvals/guest-token-123', { success: true, data: view } ).as( 'open' );
    cy.intercept( 'POST', '**/public/approvals/guest-token-123/decision', ( req ) => {
      expect( req.body ).to.deep.equal( { decision: 'approve', message: 'Fine to send.' } );
      req.reply( { success: true, data: { ...view, me: { ...view.me, state: 'approved', message: 'Fine to send.' } } } );
    } ).as( 'decide' );

    cy.visit( '/approve/guest-token-123' );
    cy.wait( '@open' );
    cy.get( 'app-docs-header' ).should( 'not.exist' );
    cy.contains( 'h1', 'Proposal · Permit Portal Modernization' );
    cy.contains( 'Shared with you by' ).should( 'contain', 'Dana Reyes' );
    cy.get( '.ap__page' ).should( 'contain', 'Liability is limited to the fees paid.' );
    cy.contains( '.ap__sections button', '5.2 Terms' );
    cy.contains( 'What King County gets' );
    cy.contains( 'Marcus Lee approved' );

    cy.get( '#ap-message' ).type( 'Fine to send.' );
    cy.contains( '.ap__decide button', 'Approve' ).click();
    cy.wait( '@decide' );
    cy.contains( 'You approved version 3.' );
  } );

  it( 'explains a link that was turned off', () => {
    cy.intercept( 'GET', '**/public/approvals/old-token-456', { statusCode: 404, body: { success: false, message: 'This link was turned off. Ask whoever sent it for a new one.' } } );
    cy.visit( '/approve/old-token-456' );
    cy.contains( 'This link isn\'t working' );
    cy.contains( 'This link was turned off.' );
  } );
} );
