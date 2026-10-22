// The evaluator score-check (design_handoff_todd_docs_lifecycle 1i/1j/1n)
// through the app: Review & send runs it the first time and shows each
// criterion with its fix; Fix this opens the editor's Score tab with TODD's
// revision in the draft; accepting it rewrites the paragraph and scores
// again; approvers see the totals on their link. The API is stubbed; the
// server's rules are in todd-backend __tests__/scoreCheck.test.js.

export {};

const OPP = 'opp-king-county';
const ok = <T>( data: T ) => ( { success: true, data } );

const opportunity = {
  id: OPP, title: 'Permit Portal Modernization', agency: 'King County', solicitationNumber: 'RFP 2026-118', summary: '',
  dueDate: '2099-10-24', estimatedValue: '', pageLimit: '', portalUrl: '',
  submission: { method: 'email', email: 'bids@kingcounty.gov' }, criteria: [],
  fit: { score: 90, headline: '', reasons: [], gaps: [] },
  source: { kind: 'email', label: '', from: 'no-reply@kingcounty.gov', subject: '', receivedAt: '', mailboxId: 'm1' },
  status: 'drafting', stage: 'drafting', rfpDocumentId: 'rfp-doc', proposalDocumentId: 'proposal-doc', submissionRecord: null, createdAt: '', updatedAt: '',
};

const sections = ( summary = 'Founded in 2019, Taliferro Tech is a Seattle software company that builds modern web applications.' ) => [
  { key: 'summary', title: '1. Executive summary', ask: '', criteria: [], status: 'done', blocks: [{ type: 'paragraph', text: summary }, { type: 'paragraph', text: 'Our team has shipped Angular and Firebase systems for public agencies.' }] },
  { key: 'tech', title: '3. Technical approach', ask: '', criteria: [], status: 'done', blocks: [{ type: 'paragraph', text: 'A mobile-first portal.' }] },
];
const draft = ( s = sections() ) => ( { opportunityId: OPP, proposalDocumentId: 'proposal-doc', hasRfpFile: true, sections: s, questions: [], pages: 1, updatedAt: '', checklist: [] } );

const criteria = [
  { id: 'c1', name: 'Technical approach', points: 18, max: 30, why: 'Doesn\'t say how you\'ll migrate their 2011 records.', fix: 'Add a migration plan to section 4.', gain: 6, sectionKey: 'tech', revision: null },
  { id: 'c2', name: 'Executive summary', points: 6, max: 10, why: 'Opens with your founding story, not their problem.', fix: 'Lead with their 2011 system and what it costs residents.', gain: 3, sectionKey: 'summary', revision: null },
  { id: 'c3', name: 'Project management', points: 12, max: 15, why: 'Named PM, weekly reports, clear releases.', fix: '', gain: 0, sectionKey: 'tech', revision: null },
];
const scored = ( c = criteria, total = 36 ) => ( { status: 'done', total, max: 55, criteria: c, opening: { ok: true, note: '', fix: '', sectionKey: 'summary', revision: null }, ranAt: new Date().toISOString(), stale: false } );

function asOwner ( win: Window ) { win.localStorage.setItem( '__docsCypressAuth', 'true' ); }

describe( 'Score-check', () => {
  beforeEach( () => {
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-king-county$/, ok( opportunity ) );
    cy.intercept( 'GET', /\/api\/docs\/opportunities$/, ok( [] ) );
    cy.intercept( 'GET', /\/api\/docs\/inboxes$/, ok( [] ) );
  } );

  it( 'runs on Review & send the first time, and Fix this opens the revision in the editor', () => {
    let check: any = { status: 'none', total: 0, max: 0, criteria: [], opening: null, ranAt: '', stale: false };
    let current = draft();
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-king-county\/proposal$/, ( req ) => req.reply( ok( current ) ) );
    cy.intercept( 'GET', /\/proposal\/requirements$/, ok( { status: 'done', items: [], summary: { total: 0, answered: 0, notAnswered: 0 }, matrixRequired: false, extractedAt: '', matchedAt: '' } ) );
    cy.intercept( 'POST', /\/proposal\/requirements\/check$/, ok( { status: 'done', items: [], summary: { total: 0, answered: 0, notAnswered: 0 }, matrixRequired: false, extractedAt: '', matchedAt: '' } ) );
    cy.intercept( 'GET', /\/approval$/, ok( null ) );
    cy.intercept( 'GET', /\/api\/docs$/, { documents: [] } );
    cy.intercept( 'GET', /\/api\/docs\/proposal-doc$/, { document: { id: 'proposal-doc', title: 'Proposal · Permit Portal Modernization', type: 'proposal', htmlContent: '<h2>1. Executive summary</h2><p>Founded in 2019.</p>' } } );
    cy.intercept( 'GET', /\/proposal\/scorecheck$/, ( req ) => req.reply( ok( check ) ) );
    let runs = 0;
    cy.intercept( 'POST', /\/proposal\/scorecheck$/, ( req ) => {
      runs += 1;
      check = runs === 1 ? scored() : scored( criteria.map( ( c ) => c.id === 'c2' ? { ...c, points: 9, fix: '', gain: 0, why: 'Opens with their problem.' } : c ), 39 );
      req.reply( { delay: 200, body: ok( check ) } );
    } ).as( 'run' );
    cy.intercept( 'POST', /\/scorecheck\/c2\/fix$/, ( req ) => {
      check = { ...check, criteria: check.criteria.map( ( c: any ) => c.id === 'c2' ? { ...c, revision: { sectionKey: 'summary', blockIndex: 0, oldText: sections()[0].blocks[0].text, text: 'King County residents still apply for permits on a system built in 2011 that doesn\'t work on a phone.', gain: 3, at: '' } } : c ) };
      req.reply( ok( check ) );
    } ).as( 'fix' );
    cy.intercept( 'POST', /\/scorecheck\/c2\/revision$/, ( req ) => {
      current = draft( sections( 'King County residents still apply for permits on a system built in 2011 that doesn\'t work on a phone.' ) );
      check = { ...check, criteria: check.criteria.map( ( c: any ) => c.id === 'c2' ? { ...c, revision: null, fixed: true } : c ) };
      req.reply( ok( { scoreCheck: check, draft: current, copyToEditor: false } ) );
    } ).as( 'accept' );

    cy.visit( `/opportunities/${ OPP }/send`, { onBeforeLoad: asOwner } );
    cy.wait( '@run' );
    cy.contains( '.sc__total', 'About 36' ).and( 'contain', 'of 55' );
    cy.contains( '.sc', 'Not a promise.' );
    cy.contains( '.sc__rows li', 'Technical approach' ).should( 'contain', '18 / 30' ).find( '.sc__bar' ).should( 'have.attr', 'data-tint', 'pink' );
    cy.contains( '.sc__rows li', 'Project management' ).should( 'not.contain', 'Fix this' );
    cy.contains( '.sc', 'Approvers see this score-check on their link.' );

    cy.contains( '.sc__rows li', 'Executive summary' ).contains( 'button', 'Fix this' ).click();
    cy.location( 'pathname' ).should( 'eq', `/opportunities/${ OPP }/proposal` );
    cy.location( 'search' ).should( 'eq', '?fix=c2' );
    cy.wait( '@fix' );
    cy.contains( '.pe__tabs button.is-on', 'Score' );
    cy.contains( '.pe__section', '1. Executive summary' ).should( 'contain', '6/10' );
    cy.contains( '.sc__gains li', 'Add a migration plan' ).should( 'contain', '+6' );
    cy.contains( '.sc', 'Doing both brings it to about 45.' );
    cy.contains( '#fix-c2 .pe__old', 'Founded in 2019' );
    cy.contains( '#fix-c2 .pe__suggest', 'Suggested revision · +3 points' ).and( 'contain', 'built in 2011' );

    cy.contains( '#fix-c2 button', 'Accept' ).click();
    cy.wait( '@accept' ).its( 'request.body' ).should( 'deep.equal', { action: 'accept' } );
    cy.wait( '@run' );
    cy.get( '#fix-c2' ).should( 'not.exist' );
    cy.contains( '#section-summary .pe__p', 'built in 2011' );
    cy.contains( '.sc__ring', '39' );
    cy.contains( '.pe__section', '1. Executive summary' ).should( 'contain', '9/10' );
  } );

  it( 'shows approvers the totals on their link', () => {
    cy.intercept( 'GET', /\/api\/public\/approvals\/[^/]+$/, ok( {
      readOnly: false, status: 'waiting', ownerName: 'Tyrone Showers', company: 'Taliferro Tech', note: '', rule: 'all', dueAt: '', allowSuggestions: false, version: 3,
      opportunity: { title: 'Records Search Upgrade', agency: 'Pierce County', solicitationNumber: 'RFP 2026-31', dueDate: '2099-10-24', portalOnly: false },
      email: { to: 'bids@piercecounty.gov', subject: 'x', body: '' }, attachments: [], checklist: { ok: 1, total: 1 },
      scoreCheck: { total: 82, max: 100, ranAt: '2026-10-21T18:00:00Z', criteria: [{ name: 'Technical approach', points: 26, max: 30 }, { name: 'Experience', points: 21, max: 25 }] },
      html: '<h2>1. Executive summary</h2><p>Pierce County staff search 40 years of records.</p>', previousHtml: '', previousVersion: 0, linkExpiresAt: '2099-10-24T00:00:00Z',
      me: { id: 'a1', name: 'Marcus Reed', email: '', state: 'reviewing', message: '', decidedAt: '' }, others: [], comments: [],
    } ) );
    cy.visit( '/approve/token-0123456789abcdefghijklmnop' );
    cy.contains( '.ap__score h2', 'TODD\'s score-check' ).and( 'contain', 'About 82 / 100' );
    cy.contains( '.ap__score', 'An estimate against Pierce County\'s scoring criteria. Run Oct 21.' );
    cy.contains( '.ap__score li', 'Technical approach' ).and( 'contain', '26 / 30' );
  } );
} );
