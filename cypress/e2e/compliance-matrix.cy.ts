// The compliance matrix (design_handoff_todd_docs_lifecycle 1d/1e) through
// the app: the editor's Requirements tab, an unanswered requirement in its
// section, Write this and Accept, jumping to the paragraph that answers
// one, the full table with the RFP's words and Export as appendix, and the
// matrix in Review & send's package when the RFP asks for it. The API is
// stubbed; the server's rules are in todd-backend __tests__/requirements.test.js.

export {};

const OPP = 'opp-king-county';
const ok = <T>( data: T ) => ( { success: true, data } );

const opportunity = {
  id: OPP, title: 'Permit Portal Modernization', agency: 'King County', solicitationNumber: 'RFP 2026-118', summary: '',
  dueDate: '2099-10-24', estimatedValue: '', pageLimit: '', portalUrl: '',
  submission: { method: 'email', email: 'bids@kingcounty.gov' }, criteria: [],
  fit: { score: 90, headline: '', reasons: [], gaps: [] },
  source: { kind: 'email', label: '', from: 'no-reply@kingcounty.gov', subject: '', receivedAt: '', mailboxId: 'dana-gmail' },
  status: 'drafting', stage: 'drafting', rfpDocumentId: 'rfp-doc', proposalDocumentId: 'proposal-doc', submissionRecord: null, createdAt: '', updatedAt: '',
};

const sections = [
  { key: 'team', title: '2. Team', ask: '', criteria: [], status: 'done', blocks: [{ type: 'paragraph', text: 'Dana Reyes is the single project manager.' }] },
  { key: 'tech', title: '3. Technical approach', ask: '', criteria: [], status: 'done', blocks: [
    { type: 'paragraph', text: 'A mobile-first Angular portal on Google Cloud.' },
    { type: 'heading', text: '3.2 Security' },
    { type: 'paragraph', text: 'We follow OWASP.' },
    { type: 'paragraph', text: 'Staff sign in with their existing King County Azure AD accounts through single sign-on.' },
  ] },
];

const base = { quote: '', page: 0, manual: false, matchedAt: '', suggestion: null };
const pm = { ...base, id: 'r1', ref: '2.3', text: 'Shall name a single project manager', type: 'shall', sectionKey: 'team', status: 'answered', answeredIn: { sectionKey: 'team', blockIndex: 0, label: '2. Team ¶1' }, matchedAt: '2026-10-22T10:00:00Z' };
const sso = { ...base, id: 'r2', ref: '3.2.1.4', text: 'Shall support single sign-on with King County Azure AD', type: 'shall', sectionKey: 'tech', status: 'answered', answeredIn: { sectionKey: 'tech', blockIndex: 3, label: '3.2 Security ¶2' }, matchedAt: '2026-10-22T11:00:00Z' };
const wcag = { ...base, id: 'r3', ref: '3.4.2', text: 'Must meet WCAG 2.1 AA', type: 'must', sectionKey: 'tech', status: 'not_answered', answeredIn: null, quote: 'The portal must meet WCAG 2.1 AA.', page: 15 };

function requirements ( items: any[], matrixRequired = false ) {
  const answered = items.filter( ( i ) => i.status === 'answered' ).length;
  return { status: 'done', items, summary: { total: items.length, answered, notAnswered: items.length - answered }, matrixRequired, extractedAt: '', matchedAt: '' };
}

function draft ( s = sections, notAnswered = 1 ) {
  return {
    opportunityId: OPP, proposalDocumentId: 'proposal-doc', hasRfpFile: true, sections: s, questions: [], pages: 1, updatedAt: '',
    checklist: [{ id: 'requirements', kind: 'requirements', label: 'Requirements answered', detail: '', ok: !notAnswered, status: notAnswered ? `2 of 3 · ${ notAnswered } not answered` : 'All 3 answered' }],
  };
}

function asOwner ( win: Window ) { win.localStorage.setItem( '__docsCypressAuth', 'true' ); }

describe( 'Compliance matrix', () => {
  beforeEach( () => {
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-king-county$/, ok( opportunity ) );
    cy.intercept( 'GET', /\/api\/docs\/opportunities$/, ok( [] ) );
    cy.intercept( 'GET', /\/api\/docs\/inboxes$/, ok( [] ) );
  } );

  it( 'shows what\'s not answered in its section, writes it, and counts it once accepted', () => {
    let current: any = requirements( [pm, sso, wcag] );
    let currentDraft: any = draft();
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-king-county\/proposal$/, ( req ) => req.reply( ok( currentDraft ) ) );
    cy.intercept( 'GET', /\/proposal\/requirements$/, ( req ) => req.reply( ok( current ) ) );
    cy.intercept( 'POST', /\/proposal\/requirements\/check$/, ( req ) => req.reply( ok( current ) ) ).as( 'check' );
    cy.intercept( 'POST', /\/requirements\/r3\/write$/, ( req ) => {
      current = requirements( [pm, sso, { ...wcag, suggestion: { sectionKey: 'tech', text: 'The portal will meet WCAG 2.1 AA, tested with [screen reader] every release.', at: '' } }] );
      req.reply( { delay: 200, body: ok( current ) } );
    } ).as( 'write' );
    cy.intercept( 'POST', /\/requirements\/r3\/suggestion$/, ( req ) => {
      const s = JSON.parse( JSON.stringify( sections ) );
      s[1].blocks.push( { type: 'paragraph', text: req.body.text || 'The portal will meet WCAG 2.1 AA, tested with [screen reader] every release.' } );
      currentDraft = draft( s, 0 );
      current = requirements( [pm, sso, { ...wcag, status: 'answered', answeredIn: { sectionKey: 'tech', blockIndex: 4, label: '3.2 Security ¶3' }, matchedAt: '2026-10-22T12:00:00Z' }] );
      req.reply( ok( { requirements: current, draft: currentDraft, copyToEditor: false } ) );
    } ).as( 'accept' );

    cy.visit( `/opportunities/${ OPP }/proposal`, { onBeforeLoad: asOwner } );
    cy.wait( '@check' );
    cy.contains( '.pe__tabs button.is-on', 'Requirements' );
    cy.contains( '.rm__head h2', '2 of 3 requirements answered' );
    cy.contains( '.rm__filter.is-on', 'Not answered' );
    cy.contains( '.rm__row', 'Must meet WCAG 2.1 AA' ).should( 'contain', 'Not answered yet' );
    cy.contains( '.rm__kicker', 'Recently matched' );
    cy.contains( '#section-tech .pe__unanswered', 'Not answered · RFP 3.4.2' );

    cy.contains( '.rm__row', 'Must meet WCAG 2.1 AA' ).contains( 'button', 'Write this' ).click();
    cy.wait( '@write' );
    cy.contains( '#section-tech .pe__suggest', 'tested with [screen reader] every release' );
    cy.contains( '.rm__row', 'Must meet WCAG 2.1 AA' ).should( 'contain', 'TODD wrote a draft' );

    cy.contains( '.pe__suggest button', 'Edit' ).click();
    cy.get( '.pe__suggest textarea' ).clear().type( 'The portal will meet WCAG 2.1 AA, tested with NVDA every release.' );
    cy.contains( '.pe__suggest button', 'Accept' ).click();
    cy.wait( '@accept' ).its( 'request.body' ).should( 'deep.equal', { action: 'accept', text: 'The portal will meet WCAG 2.1 AA, tested with NVDA every release.' } );
    cy.contains( '#section-tech .pe__p', 'tested with NVDA every release' );
    cy.get( '.pe__unanswered, .pe__suggest' ).should( 'not.exist' );
    cy.contains( '.rm__head h2', '3 of 3 requirements answered' );
    cy.contains( '.pe__tabs button', 'Checklist' ).click();
    cy.contains( '.pe__checks li', 'Requirements answered' ).should( 'contain', 'All 3 answered' );
  } );

  it( 'jumps to the paragraph that answers a requirement', () => {
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-king-county\/proposal$/, ok( draft() ) );
    cy.intercept( 'GET', /\/proposal\/requirements$/, ok( requirements( [pm, sso, wcag] ) ) );
    cy.intercept( 'POST', /\/proposal\/requirements\/check$/, ok( requirements( [pm, sso, wcag] ) ) );
    cy.visit( `/opportunities/${ OPP }/proposal`, { onBeforeLoad: asOwner } );
    cy.contains( '.rm__row--recent', 'single sign-on' ).contains( 'button', '3.2 Security ¶2' ).click();
    cy.get( '#blk-tech-3' ).should( 'have.class', 'is-flash' ).and( 'contain', 'Azure AD' );
    cy.get( '#blk-tech-3', { timeout: 4000 } ).should( 'not.have.class', 'is-flash' );
  } );

  it( 'opens the full table with the RFP\'s words, takes "it\'s answered", and exports the appendix', () => {
    let current: any = requirements( [pm, sso, wcag] );
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-king-county\/proposal$/, ok( draft() ) );
    cy.intercept( 'GET', /\/proposal\/requirements$/, ( req ) => req.reply( ok( current ) ) );
    cy.intercept( 'POST', /\/proposal\/requirements\/check$/, ( req ) => req.reply( ok( current ) ) );
    cy.intercept( 'POST', /\/requirements\/r3\/mark$/, ( req ) => {
      current = requirements( [pm, sso, { ...wcag, status: 'answered', manual: true, matchedAt: '2026-10-22T12:00:00Z' }] );
      req.reply( ok( current ) );
    } ).as( 'mark' );

    cy.visit( `/opportunities/${ OPP }/proposal`, { onBeforeLoad: asOwner } );
    cy.contains( '.pe__views button', 'Requirements' ).click();
    cy.location( 'search' ).should( 'include', 'view=requirements' );
    cy.get( '.pe__grid' ).should( 'not.exist' );
    cy.contains( '.rm--table .rm__cols', 'Answered in' );
    cy.contains( '.rm__filter', 'All' ).click();
    cy.get( '.rm--table .rm__row' ).should( 'have.length', 3 );
    cy.contains( '.rm__row', '2.3' ).should( 'contain', '2. Team ¶1' ).and( 'contain', 'shall' );

    cy.contains( '.rm__row', 'WCAG' ).find( '.rm__line' ).click();
    cy.contains( '.rm__quote', 'RFP · page 15 · 3.4.2' );
    cy.contains( '.rm__quote', '“The portal must meet WCAG 2.1 AA.”' );
    cy.contains( '.rm__draft', 'Nothing answers this yet' );
    cy.contains( '.rm__quote button', 'It\'s answered in the proposal' ).click();
    cy.wait( '@mark' ).its( 'request.body' ).should( 'deep.equal', { answered: true } );
    cy.contains( '.rm__head h2', '3 of 3 requirements answered' );
    cy.contains( '.rm__row', 'WCAG' ).should( 'contain', 'Marked answered' );

    cy.contains( 'button', 'Export as appendix' ).click();
    cy.contains( '.rm__menu button', 'PDF' ).click();
    cy.readFile( 'cypress/downloads/Compliance matrix - Permit Portal Modernization.pdf', { timeout: 10000 } ).should( 'have.length.greaterThan', 500 );
    cy.contains( '.pe__views button', 'Draft' ).click();
    cy.get( '.pe__grid' ).should( 'exist' );
  } );

  it( 'adds the matrix to the package when the RFP asks for it', () => {
    const answeredAll = requirements( [pm, sso], true );
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-king-county\/proposal$/, ok( { ...draft( sections, 0 ), checklist: [{ id: 'requirements', kind: 'requirements', label: 'Requirements answered', detail: '', ok: true, status: 'All 2 answered' }] } ) );
    cy.intercept( 'GET', /\/proposal\/requirements$/, ok( answeredAll ) );
    cy.intercept( 'GET', /\/approval$/, ok( null ) );
    cy.intercept( 'GET', /\/api\/profile$/, { profile: { firstName: 'Dana', lastName: 'Reyes', companyName: 'Taliferro Tech' } } );
    cy.intercept( 'GET', /\/api\/docs$/, { documents: [] } );
    cy.intercept( 'GET', /\/api\/docs\/proposal-doc$/, { document: { id: 'proposal-doc', title: 'Proposal · Permit Portal Modernization', type: 'proposal', htmlContent: '<h2>2. Team</h2><p>Dana.</p>' } } );
    cy.intercept( 'GET', /\/api\/docs\/inboxes$/, ok( [{ id: 'dana-gmail', emailAddress: 'dana@taliferro.tech', displayName: 'Dana Reyes', provider: 'gmail', providerLabel: 'Gmail', status: 'connected', purposes: ['rfp'], rfpSenders: [], rfpLastSyncAt: '', rfpLastSyncStatus: '', rfpFoundCount: 0 }] ) );
    cy.intercept( 'POST', '**/firebasestorage.googleapis.com/**', { name: 'x.pdf', bucket: 'taliferrotech.appspot.com', contentType: 'application/pdf', size: '100', downloadTokens: 't' } );
    cy.intercept( 'GET', '**/firebasestorage.googleapis.com/**', { name: 'x.pdf', bucket: 'taliferrotech.appspot.com', downloadTokens: 't' } );
    let saved = 0;
    cy.intercept( 'POST', /\/api\/docs$/, ( req ) => req.reply( { document: { id: saved++ ? 'matrix-pdf' : 'proposal-pdf' } } ) ).as( 'saveDoc' );
    cy.intercept( 'GET', /\/api\/docs\/matrix-pdf$/, { document: { id: 'matrix-pdf', name: 'Compliance matrix - Permit Portal Modernization.pdf', title: 'Compliance matrix', type: 'attachment', mimeType: 'application/pdf' } } );
    cy.intercept( 'POST', /\/proposal\/send$/, ( req ) => req.reply( ok( { ...opportunity, status: 'submitted', submissionRecord: { method: 'email', to: req.body.to, submittedAt: new Date().toISOString(), attachments: [] } } ) ) ).as( 'send' );

    cy.visit( `/opportunities/${ OPP }/send`, { onBeforeLoad: asOwner } );
    cy.contains( 'Compliance matrix - Permit Portal Modernization.pdf' );
    cy.contains( 'The RFP asks for it' );
    cy.contains( 'button', 'Send proposal' ).click();
    cy.wait( '@send' ).its( 'request.body.documentIds' ).should( 'deep.equal', ['proposal-pdf', 'matrix-pdf'] );
  } );
} );
