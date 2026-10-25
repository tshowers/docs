// "Is TODD doing anything?" The header pill says what TODD is working on,
// how far along and how long; buttons show a spinner from the moment
// they're pressed until their work is done; a slow job says when it's done.

// A module of its own, so these helpers don't clash with other specs' globals.
export {};

const OPP = 'opp-working';
const ok = <T>( data: T ) => ( { success: true, data } );
const opportunity = {
  id: OPP, title: 'Permit Portal Modernization', agency: 'King County', solicitationNumber: 'RFP 2026-118', summary: '',
  dueDate: '2099-10-24', estimatedValue: '', pageLimit: '', portalUrl: '', submission: { method: 'email', email: 'bids@kingcounty.gov' },
  criteria: [], fit: { score: 90, headline: '', reasons: [], gaps: [] },
  source: { kind: 'email', label: '', from: '', subject: '', receivedAt: '', mailboxId: '' },
  status: 'drafting', rfpDocumentId: '', proposalDocumentId: 'proposal-doc', submissionRecord: null, createdAt: '', updatedAt: '',
};
const section = ( key: string, title: string, text = '' ) => ( {
  key, title, ask: '', criteria: [], status: text ? 'done' : 'pending', blocks: text ? [{ type: 'paragraph', text }] : [],
} );
const draft = ( sections: any[], questions: any[] = [] ) => ( {
  opportunityId: OPP, proposalDocumentId: 'proposal-doc', hasRfpFile: true, sections, questions, checklist: [], pages: 1, updatedAt: '',
} );
const requirements = { status: 'done', items: [], summary: { total: 0, answered: 0, notAnswered: 0 }, matrixRequired: false, extractedAt: '', matchedAt: '' };

function stubEditor () {
  cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-working$/, ok( opportunity ) );
  cy.intercept( 'GET', /\/proposal\/requirements$/, ok( requirements ) );
  cy.intercept( 'POST', /\/proposal\/requirements\/check$/, ok( requirements ) );
  cy.intercept( 'GET', /\/proposal\/scorecheck$/, ok( null ) );
}

describe( 'TODD is working', () => {
  it( 'shows planning, then each section drafting with progress, then says it is done', () => {
    stubEditor();
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-working\/proposal$/, ok( null ) );
    cy.intercept( 'POST', /\/proposal\/plan$/, { delay: 2000, body: ok( draft( [section( 'pricing', '5. Pricing' ), section( 'terms', '5.2 Terms' )] ) ) } ).as( 'plan' );
    cy.intercept( 'POST', /\/proposal\/sections\/pricing\/draft$/, { delay: 1600, body: ok( draft( [section( 'pricing', '5. Pricing', 'A fixed price.' ), section( 'terms', '5.2 Terms' )] ) ) } ).as( 'pricing' );
    cy.intercept( 'POST', /\/proposal\/sections\/terms\/draft$/, { delay: 1600, body: ok( draft( [section( 'pricing', '5. Pricing', 'A fixed price.' ), section( 'terms', '5.2 Terms', 'Liability is capped.' )] ) ) } ).as( 'terms' );

    cy.visit( `/opportunities/${ OPP }/proposal`, { onBeforeLoad: ( win ) => win.localStorage.setItem( '__docsCypressAuth', 'true' ) } );

    cy.get( '.tw' ).should( 'contain.text', 'TODD is planning the proposal' ).and( 'contain.text', 'about a minute' );
    cy.wait( '@plan' );
    cy.get( '.tw' ).should( 'contain.text', 'TODD is drafting 5. Pricing · 1 of 2' );
    cy.wait( '@pricing' );
    cy.get( '.tw' ).should( 'contain.text', 'TODD is drafting 5.2 Terms · 2 of 2' );
    cy.wait( '@terms' );
    cy.get( '.tw' ).should( 'not.exist' );
    cy.get( '.toast' ).should( 'contain.text', 'Drafted the proposal' );
  } );

  it( 'shows a spinner on the button from the moment it is pressed, even while sign-in is still being checked', () => {
    stubEditor();
    const question = { id: 'q1', sectionKey: 'pricing', question: 'What is your hourly rate?', why: '', status: 'open', answer: '', knowledgeId: '' };
    const done = [section( 'pricing', '5. Pricing', 'A fixed price.' )];
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-working\/proposal$/, ok( draft( done, [question] ) ) );
    // The account check is slow, so the write gate holds the first click.
    cy.intercept( 'GET', '**/account/summary*', { delay: 2500, statusCode: 200, body: { data: { writeAccess: { docs: true } } } } ).as( 'account' );
    let answered = false;
    cy.intercept( 'POST', /\/proposal\/questions\/q1$/, ( req ) => {
      answered = true;
      req.reply( { delay: 1800, body: ok( { draft: draft( done, [{ ...question, status: 'answered', answer: '$150' }] ), knowledge: { saved: true } } ) } );
    } ).as( 'answer' );

    cy.visit( `/opportunities/${ OPP }/proposal`, { onBeforeLoad: ( win ) => win.localStorage.setItem( '__docsCypressAuth', 'true' ) } );
    cy.get( 'textarea[aria-label="Your answer"]' ).type( '$150 an hour' );
    cy.contains( 'button', 'Use this answer' ).as( 'use' ).click();

    // Held by the write gate: nothing sent yet, but the button shows it's on its way.
    cy.get( '@use' ).should( 'have.class', 'dk-pending' ).and( 'have.attr', 'aria-busy', 'true' );
    cy.then( () => expect( answered ).to.equal( false ) );

    // Once access is known the click goes through; the spinner stays while TODD works.
    cy.wait( '@account' );
    cy.get( '.tw' ).should( 'contain.text', 'TODD is adding your answer to the draft' );
    cy.get( '.dk-pending' ).should( 'exist' );
    cy.wait( '@answer' );
    cy.get( '.dk-pending' ).should( 'not.exist' );
    cy.get( '.tw' ).should( 'not.exist' );
  } );
} );
