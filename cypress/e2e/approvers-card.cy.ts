// Get approval by private link (design_handoff_todd_docs_lifecycle 1m/1n):
// the Approvers card on Review & send (status per person, Copy link, add
// someone by name with a role, the suggest-edits switch), the /a/ short
// link, and the approver's Download PDF. The full ask-approve-send flow is
// approval-flow.cy.ts.

export {};

const OPP = 'opp-pierce';
const ok = <T>( data: T ) => ( { success: true, data } );
const now = new Date().toISOString();
const opportunity = { id: OPP, title: 'Records Search Upgrade', agency: 'Pierce County', solicitationNumber: 'RFP 2026-31', summary: '', dueDate: '2099-10-24', estimatedValue: '', pageLimit: '', portalUrl: '', submission: { method: 'email', email: 'rfp@piercecountywa.gov' }, criteria: [], fit: { score: 88, headline: '', reasons: [], gaps: [] }, source: { kind: 'email', label: '', from: 'x@y.gov', subject: '', receivedAt: '', mailboxId: 'm1' }, status: 'drafting', stage: 'in_review', rfpDocumentId: '', proposalDocumentId: 'proposal-doc', submissionRecord: null, createdAt: '', updatedAt: '' };
const ap = ( id: string, name: string, role: string, state: string, extra: any = {} ) => ( { id, name, email: '', role, token: `token-${ id }-0123456789abcdefghij`, state, approvedVersion: state === 'approved' ? 3 : 0, message: '', openedAt: '', decidedAt: '', sharedAt: '', ...extra } );

describe( 'Approvers card and the approver\'s link', () => {
  it( 'shows each person, copies their link, adds one by name and switches suggestions', () => {
    let request: any = { opportunityId: OPP, rule: 'all', dueAt: '', note: '', onApproved: 'notify', allowSuggestions: true, status: 'waiting', version: 3, email: { to: 'rfp@piercecountywa.gov', subject: 'RFP 2026-31 Records Search Upgrade', body: 'Hello', mailboxId: 'm1' }, attachments: [], proposalPdfId: '',
      approvers: [ap( 'a1', 'Dana Lee', 'Partner', 'approved', { decidedAt: now } ), ap( 'a2', 'Marcus Reed', 'Accountant', 'reviewing', { openedAt: now, sharedAt: now } )],
      events: [], bypassReason: '', linkExpiresAt: '2099-10-24T00:00:00Z', proposalChanged: false, comments: [], createdAt: now, updatedAt: now };
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-pierce$/, ok( opportunity ) );
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-pierce\/proposal$/, ok( { opportunityId: OPP, proposalDocumentId: 'proposal-doc', hasRfpFile: true, sections: [], questions: [], pages: 1, updatedAt: '', checklist: [] } ) );
    cy.intercept( 'GET', /\/api\/docs\/inboxes$/, ok( [{ id: 'm1', emailAddress: 'tyrone@taliferro.com', displayName: '', provider: 'gmail', providerLabel: 'Gmail', status: 'connected', purposes: ['outreach'], rfpSenders: [], rfpLastSyncAt: '', rfpLastSyncStatus: '', rfpFoundCount: 0 }] ) );
    cy.intercept( 'GET', /\/api\/docs$/, { documents: [] } );
    cy.intercept( 'GET', /\/api\/docs\/proposal-doc$/, { document: { id: 'proposal-doc', title: 'Proposal · Records Search Upgrade', type: 'proposal', htmlContent: '<h2>1. Executive summary</h2><p>Pierce County.</p>' } } );
    cy.intercept( 'GET', /\/proposal\/scorecheck$/, ok( { status: 'done', total: 82, max: 100, criteria: [], opening: null, ranAt: now, stale: false } ) );
    cy.intercept( 'GET', /\/proposal\/requirements$/, ok( { status: 'done', items: [], summary: { total: 0, answered: 0, notAnswered: 0 }, matrixRequired: false, extractedAt: '', matchedAt: '' } ) );
    cy.intercept( 'GET', /\/opp-pierce\/approval$/, ( req ) => req.reply( ok( request ) ) );
    cy.intercept( 'POST', /\/opp-pierce\/approval$/, ( req ) => {
      request = { ...request, allowSuggestions: req.body.allowSuggestions, approvers: req.body.approvers.map( ( a: any, i: number ) => request.approvers.find( ( x: any ) => x.id === a.id ) || ap( `a${ i + 1 }`, a.name, a.role, 'waiting' ) ) };
      req.reply( ok( request ) );
    } ).as( 'save' );
    cy.intercept( 'POST', /\/approvers\/[^/]+\/shared$/, ok( { sharedAt: now } ) ).as( 'shared' );

    cy.visit( `/opportunities/${ OPP }/send`, { onBeforeLoad: ( w ) => {
      w.localStorage.setItem( '__docsCypressAuth', 'true' );
      cy.stub( w.navigator.clipboard, 'writeText' ).as( 'copy' ).resolves();
    } } );
    cy.contains( 'h1', '1 of 2 approved.' );
    cy.contains( '.rs__lede', 'Version 3 · 1 page · score-check about 82 of 100. If you edit the proposal, approvals start over.' );
    cy.contains( '.rs__people .rs__approver', 'Dana Lee' ).should( 'contain', '· Partner' ).and( 'contain', 'Approved v3 · ' ).find( '.rs__copy' ).should( 'not.exist' );
    cy.contains( '.rs__people .rs__approver', 'Marcus Reed' ).should( 'contain', 'not decided' ).contains( 'button', 'Copy link' ).click();
    cy.get( '@copy' ).should( 'have.been.calledWithMatch', /\/approve\/token-a2-/ );
    cy.wait( '@shared' ).its( 'request.body' ).should( 'deep.equal', { via: 'copy' } );

    cy.get( '.rs__add input' ).type( 'Cascade Data, Subcontractor' );
    cy.contains( '.rs__add button', 'Add' ).click();
    cy.wait( '@save' ).its( 'request.body.approvers' ).should( 'deep.equal', [
      { id: 'a1', name: 'Dana Lee', email: '', role: 'Partner' },
      { id: 'a2', name: 'Marcus Reed', email: '', role: 'Accountant' },
      { name: 'Cascade Data', email: '', role: 'Subcontractor' },
    ] );
    cy.contains( '.rs__people .rs__approver', 'Cascade Data' ).should( 'contain', 'Link not sent yet' );

    cy.contains( 'button', 'Copy all links' ).click();
    cy.get( '@copy' ).should( 'have.been.calledWithMatch', /Cascade Data: .*\/approve\/token-a3-/ );
    cy.get( '.rs__suggest input' ).uncheck();
    cy.wait( '@save' ).its( 'request.body.allowSuggestions' ).should( 'equal', false );
  } );

  it( 'opens from the short /a/ link and downloads the PDF of this version', () => {
    cy.intercept( 'GET', /\/api\/public\/approvals\/[^/]+$/, ok( {
      readOnly: false, status: 'waiting', ownerName: 'Tyrone Showers', company: 'Taliferro Tech', note: '', rule: 'all', dueAt: '', allowSuggestions: false, version: 3,
      opportunity: { title: 'Records Search Upgrade', agency: 'Pierce County', solicitationNumber: 'RFP 2026-31', dueDate: '2099-10-24', portalOnly: false },
      email: { to: 'rfp@piercecountywa.gov', subject: 'x', body: '' }, attachments: [], checklist: { ok: 1, total: 1 }, scoreCheck: null,
      html: '<h2>1. Executive summary</h2><p>Pierce County staff search 40 years of records.</p>', previousHtml: '', previousVersion: 0, linkExpiresAt: '2099-10-24T00:00:00Z',
      me: { id: 'a2', name: 'Marcus Reed', email: '', state: 'reviewing', message: '', decidedAt: '' }, others: [], comments: [],
    } ) );
    cy.visit( '/a/token-a2-0123456789abcdefghij' );
    cy.location( 'pathname' ).should( 'eq', '/approve/token-a2-0123456789abcdefghij' );
    cy.contains( 'Reviewing as Marcus Reed' );
    cy.contains( '.ap__ask', 'Tyrone wants your OK to send this to Pierce County.' );
    cy.contains( '.ap__exact', 'This is exactly what will be sent before Oct 24.' );
    cy.contains( 'button', 'Download PDF' ).click();
    cy.readFile( 'cypress/downloads/Proposal - Records Search Upgrade (version 3).pdf', { timeout: 10000 } ).should( 'have.length.greaterThan', 500 );
  } );
} );
