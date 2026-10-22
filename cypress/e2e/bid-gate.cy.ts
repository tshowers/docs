// The Bid / No-Bid gate (design_handoff_todd_docs_lifecycle 1a/1c/1h)
// through the app: TODD reads the RFP for must-haves on the first visit,
// a not-sure one is answered inline, a missing one turns Draft proposal into
// "We can't meet this", Draft anyway asks why, and Not for us takes one tap.
// The API is stubbed; the server's rules are tested in todd-backend
// __tests__/mustHaves.service.test.js.

export {};

const OPP = 'opp-king-county';
const ok = <T>( data: T ) => ( { success: true, data } );

const base = {
  id: OPP, title: 'Permit Portal Modernization', agency: 'King County', solicitationNumber: 'RFP 2026-118',
  summary: 'King County wants a vendor to replace its 2011 permit application system.',
  dueDate: '2099-10-24', estimatedValue: '$480K est.', pageLimit: '30 pages', portalUrl: '',
  submission: { method: 'email', email: 'bids@kingcounty.gov' }, criteria: [],
  fit: { score: 92, headline: 'Strong fit on the work', reasons: ['Matches your Angular/Firebase work'], gaps: [] },
  source: { kind: 'email', label: '', from: 'no-reply@kingcounty.gov', subject: '', receivedAt: '2026-10-09T16:00:00Z', mailboxId: 'm1' },
  status: 'new', stage: 'found', rfpDocumentId: 'rfp-doc', proposalDocumentId: '', submissionRecord: null,
  decision: null, noBid: null, history: [], createdAt: '', updatedAt: '',
};

const item = ( id: string, text: string, state: string, proof: string, question = '' ) => ( { id, ref: '2.1', text, category: 'other', state, proof, question, answer: '', answeredAt: '', knowledgeId: '' } );
const checked = ( items: any[] ) => {
  const count = ( s: string ) => items.filter( ( i ) => i.state === s ).length;
  return { ...base, stage: 'qualifying', mustHaves: { status: 'done', items, checkedAt: '2026-10-22T16:00:00Z', summary: { total: items.length, met: count( 'met' ), notMet: count( 'not_met' ), unknown: count( 'unknown' ) } } };
};
const unchecked = { ...base, mustHaves: { status: 'unchecked', items: [], checkedAt: '', summary: { total: 0, met: 0, notMet: 0, unknown: 0 } } };

const license = item( 'mh1', 'Washington business license', 'met', 'UBI 604-112-889 · in Documents' );
const references = item( 'mh2', '3 public-sector references of similar size', 'not_met', 'You have 1: King County Elections portal' );
const supplier = item( 'mh3', 'Registered in King County\'s supplier portal', 'unknown', 'I couldn\'t find a registration number', 'Are you registered with King County as a supplier?' );

function asOwner ( win: Window ) { win.localStorage.setItem( '__docsCypressAuth', 'true' ); }

describe( 'Bid / No-Bid gate', () => {
  beforeEach( () => {
    cy.intercept( 'GET', /\/api\/docs\/inboxes$/, ok( [] ) );
    cy.intercept( 'GET', /\/api\/docs\/opportunities$/, ok( [] ) );
    // Key dates and addenda (key-dates.cy.ts) aren't what this spec is about.
    cy.intercept( 'POST', /\/dates\/check$/, { statusCode: 503, body: { success: false } } );
    cy.intercept( 'GET', /\/updates$/, ok( [] ) );
  } );

  it( 'checks the must-haves on the first visit, then asks the one it can\'t tell', () => {
    let current: any = unchecked;
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-king-county$/, ( req ) => req.reply( ok( current ) ) );
    cy.intercept( 'POST', /\/musthaves\/check$/, ( req ) => {
      current = checked( [license, { ...references, state: 'met', proof: 'Elections, Parks and Records portals' }, supplier] );
      req.reply( { delay: 400, body: ok( current ) } );
    } ).as( 'check' );
    cy.intercept( 'POST', /\/musthaves\/mh3\/answer$/, ( req ) => {
      current = checked( [license, { ...references, state: 'met', proof: 'Elections, Parks and Records portals' }, { ...supplier, state: 'met', proof: 'You said yes · saved to Knowledge', answer: 'yes', answeredAt: '2026-10-22T16:01:00Z' }] );
      req.reply( ok( { opportunity: current, knowledge: { saved: true, id: 'kb1' } } ) );
    } ).as( 'answer' );

    cy.visit( `/opportunities/${ OPP }`, { onBeforeLoad: asOwner } );
    cy.contains( '.od__gate', 'Reading the RFP' );
    cy.wait( '@check' ).its( 'request.body' ).should( 'deep.equal', { force: false } );

    cy.contains( '.od__step[data-state="current"]', 'Qualifying' );
    cy.contains( '.od__fit', 'Fit is a judgment; must-haves are pass/fail.' );
    cy.contains( '.od__gate', 'Before I draft: must-haves' );
    cy.contains( '.od__gate', '3 found' );
    cy.contains( '.od__gate', 'Nothing here disqualifies you so far. One I can\'t tell yet.' );
    cy.contains( '.od__actions button', 'Draft proposal' ).should( 'be.enabled' );

    cy.contains( '.od__ask', 'Are you registered with King County as a supplier?' ).contains( 'button', 'Yes' ).click();
    cy.wait( '@answer' ).its( 'request.body' ).should( 'deep.equal', { answer: 'yes' } );
    cy.get( '.od__ask' ).should( 'not.exist' );
    cy.contains( '.od__gate', 'All 3 met. Nothing here would disqualify you.' );
    cy.contains( '.od__musthaves li', 'You said yes · saved to Knowledge' );
  } );

  it( 'turns a missing must-have into "We can\'t meet this", and Draft anyway asks why', () => {
    const current = checked( [license, references, supplier] );
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-king-county$/, ok( current ) );
    cy.intercept( 'POST', /\/musthaves\/check$/, cy.spy().as( 'check' ) );
    cy.intercept( 'POST', /\/decision$/, ( req ) => req.reply( ok( { ...current, decision: { type: 'draft_anyway', at: '', userId: 'u', reason: req.body.reason, detail: '' } } ) ) ).as( 'decide' );
    cy.intercept( 'POST', /\/api\/docs$/, { document: { id: 'proposal-doc' } } ).as( 'createProposal' );
    cy.intercept( 'PATCH', /\/api\/docs\/opportunities\/opp-king-county$/, ( req ) => req.reply( ok( { ...current, status: 'drafting', stage: 'drafting', proposalDocumentId: 'proposal-doc' } ) ) ).as( 'startDraft' );
    cy.intercept( 'GET', /\/proposal$/, ok( null ) );
    cy.intercept( 'POST', /\/proposal\/plan$/, { statusCode: 503, body: { success: false } } );

    cy.visit( `/opportunities/${ OPP }`, { onBeforeLoad: asOwner } );
    cy.contains( '.od__gate', 'One of these would get you disqualified, whatever the score. One I can\'t tell yet.' );
    cy.contains( '.od__musthaves small.is-missing', 'You have 1: King County Elections portal' );
    cy.get( '@check' ).should( 'not.have.been.called' );
    cy.contains( '.od__actions button', 'Draft proposal' ).should( 'not.exist' );
    cy.contains( '.od__actions button', 'We can\'t meet this' ).should( 'be.visible' );

    cy.contains( '.od__actions button', 'Draft anyway' ).click();
    cy.contains( '.od__reason', 'Missing: 3 public-sector references of similar size.' );
    cy.contains( '.od__reason button', 'Start drafting' ).should( 'be.disabled' );
    cy.get( '#od-why' ).type( 'Teaming with Cascade Data as prime.' );
    cy.contains( '.od__reason button', 'Start drafting' ).click();
    cy.wait( '@decide' ).its( 'request.body' ).should( 'deep.equal', { action: 'draft_anyway', reason: 'Teaming with Cascade Data as prime.' } );
    cy.wait( '@startDraft' ).its( 'request.body.status' ).should( 'eq', 'drafting' );
    cy.location( 'pathname' ).should( 'eq', `/opportunities/${ OPP }/proposal` );
  } );

  it( 'sets it aside as a no-bid: "We can\'t meet this", or Not for us with Other', () => {
    const current = checked( [license, references] );
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-king-county$/, ok( current ) );
    cy.intercept( 'POST', /\/decision$/, ( req ) => req.reply( ok( { ...current, status: 'dismissed', stage: 'no_bid', noBid: { reason: req.body.reason, detail: req.body.detail || '', at: '' } } ) ) ).as( 'decide' );

    cy.visit( `/opportunities/${ OPP }`, { onBeforeLoad: asOwner } );
    cy.contains( '.od__actions button', 'We can\'t meet this' ).click();
    cy.wait( '@decide' ).its( 'request.body' ).should( 'deep.equal', { action: 'no_bid', reason: 'Missing must-have', detail: '' } );
    cy.location( 'pathname' ).should( 'eq', '/opportunities' );

    const clean = checked( [license] );
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-king-county$/, ok( clean ) );
    cy.visit( `/opportunities/${ OPP }`, { onBeforeLoad: asOwner } );
    cy.contains( '.od__actions button', 'Draft proposal' ).should( 'be.enabled' );
    cy.contains( '.od__actions button', 'Not for us' ).click();
    cy.contains( '.od__reason', 'Why not this one?' );
    cy.contains( '.od__chip', 'Other' ).click();
    cy.get( '@decide.all' ).should( 'have.length', 1 );
    cy.get( '.od__reason textarea' ).type( 'The county wants an on-site team.' );
    cy.contains( '.od__reason button', 'Set it aside' ).click();
    cy.wait( '@decide' ).its( 'request.body' ).should( 'deep.equal', { action: 'no_bid', reason: 'Other', detail: 'The county wants an on-site team.' } );
  } );

  it( 'with only the alert, asks for the RFP and still lets you draft', () => {
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-king-county$/, ok( { ...base, rfpDocumentId: '', mustHaves: { status: 'no_rfp', items: [], checkedAt: '', summary: { total: 0, met: 0, notMet: 0, unknown: 0 } } } ) );
    cy.intercept( 'POST', /\/musthaves\/check$/, cy.spy().as( 'check' ) );

    cy.visit( `/opportunities/${ OPP }`, { onBeforeLoad: asOwner } );
    cy.contains( '.od__step[data-state="current"]', 'Found' );
    cy.contains( '.od__gate', 'I only have the alert email' );
    cy.contains( '.od__actions button', 'Draft from the alert' ).should( 'be.enabled' );
    cy.get( '@check' ).should( 'not.have.been.called' );
    cy.contains( '.od__actions button', 'Attach the RFP' ).click();
    cy.location( 'pathname' ).should( 'eq', '/upload' );
    cy.location( 'search' ).should( 'include', `opportunity=${ OPP }` ).and( 'include', 'back=opportunity' );
  } );

  it( 'shows the stage and must-haves on the Opportunities cards', () => {
    cy.intercept( 'GET', /\/api\/docs\/opportunities$/, ok( [
      checked( [license, references, supplier] ),
      { ...checked( [license] ), id: 'opp-2', title: 'Utility Billing Self-Service', fit: { ...base.fit, score: 84 } },
      { ...unchecked, id: 'opp-3', stage: 'qualifying', title: 'Vendor Compliance Dashboard', fit: { ...base.fit, score: 78 }, mustHaves: { ...unchecked.mustHaves, status: 'checking' } },
    ] ) );
    cy.visit( '/opportunities', { onBeforeLoad: asOwner } );
    cy.contains( '.opp-card', 'Permit Portal Modernization' ).within( () => {
      cy.contains( '.opp-stage', 'Qualifying' );
      cy.contains( '.opp-must[data-state="not_met"]', '1 must-have missing' );
    } );
    cy.contains( '.opp-card', 'Utility Billing Self-Service' ).contains( '.opp-must[data-state="met"]', 'All must-haves met' );
    cy.contains( '.opp-card', 'Vendor Compliance Dashboard' ).within( () => {
      cy.contains( '.opp-stage', 'Qualifying' );
      cy.contains( '.opp-must', 'Checking must-haves…' );
    } );
  } );
} );
