// iPhone and iPad (design_handoff_todd_docs_lifecycle 1o, 1p, 1s): on a phone
// the opportunity opens on its must-haves with the counts, the stage line is
// one scrolling row, the pinned bar holds the main action and one row
// beside it, and Review & send puts the Approvers card under the headline.
// On iPad the must-haves stay in the right column.

export {};

const ok = <T>( data: T ) => ( { success: true, data } );
const asOwner = ( w: Window ) => w.localStorage.setItem( '__docsCypressAuth', 'true' );
const item = ( id: string, text: string, state: string, proof: string ) => ( { id, ref: '2.1', text, category: 'other', state, proof, question: '', answer: '', answeredAt: '', knowledgeId: '' } );
const opp: any = {
  id: 'o1', title: 'Permit Portal Modernization', agency: 'King County', solicitationNumber: 'RFP 2026-118', summary: '', dueDate: '2099-10-24', estimatedValue: '', pageLimit: '', portalUrl: '',
  submission: { method: 'email', email: 'bids@kingcounty.gov' }, criteria: [], fit: { score: 92, headline: '', reasons: [], gaps: [] },
  source: { kind: 'email', label: '', from: 'no-reply@kingcounty.gov', subject: '', receivedAt: '', mailboxId: 'm1' }, status: 'new', stage: 'qualifying', rfpDocumentId: 'r', proposalDocumentId: '', submissionRecord: null,
  mustHaves: { status: 'done', items: [item( 'mh1', 'Washington business license', 'met', 'in Documents' ), item( 'mh2', '3 public-sector references', 'not_met', 'You have 1' )], checkedAt: '', summary: { total: 2, met: 1, notMet: 1, unknown: 0 } },
  keyDates: { status: 'done', questionsTo: '', questionsVia: 'email', checkedAt: '', items: [] }, buyerQuestions: { items: [], sent: null }, history: [], createdAt: '', updatedAt: '',
};

describe( 'Phone and iPad layout', () => {
  beforeEach( () => {
    cy.intercept( 'GET', /\/api\/docs\/inboxes$/, ok( [] ) );
    cy.intercept( 'GET', /\/api\/docs\/opportunities$/, ok( [] ) );
    cy.intercept( 'GET', /\/updates$/, ok( [] ) );
  } );

  it( 'on a phone: must-haves first, counts, one-line stages, a short pinned bar', () => {
    let current = opp;
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/o1$/, ( req ) => req.reply( ok( current ) ) );
    cy.viewport( 390, 844 );
    cy.visit( '/opportunities/o1', { onBeforeLoad: asOwner } );
    cy.get( '.od__gate' ).then( ( gate ) => cy.get( '.od__dates' ).then( ( dates ) => expect( gate[0].getBoundingClientRect().top ).to.be.lessThan( dates[0].getBoundingClientRect().top ) ) );
    cy.get( '.od__counts' ).should( 'be.visible' ).and( 'contain', '1 met' ).and( 'contain', '1 missing' );
    cy.get( '.od__found' ).should( 'contain', '1 missing' );
    cy.get( '.od__steps' ).should( 'have.css', 'flex-wrap', 'nowrap' );
    cy.get( '.od__actions' ).should( 'have.css', 'position', 'sticky' ).invoke( 'outerHeight' ).should( 'be.lessThan', 140 );
    cy.contains( '.od__actions button', 'We can\'t meet this' ).should( 'be.visible' );

    cy.then( () => { current = { ...opp, status: 'drafting', stage: 'drafting', proposalDocumentId: 'p1' }; } );
    cy.visit( '/opportunities/o1', { onBeforeLoad: asOwner } );
    cy.get( '.od__actions .od__status' ).should( 'not.be.visible' );
    cy.contains( '.od__actions .od__pair a', 'Review & send' ).should( 'be.visible' );
    cy.get( '.od__actions' ).invoke( 'outerHeight' ).should( 'be.lessThan', 140 );
  } );

  it( 'on iPad: the must-haves stay beside the opportunity', () => {
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/o1$/, ok( opp ) );
    cy.viewport( 1180, 820 );
    cy.visit( '/opportunities/o1', { onBeforeLoad: asOwner } );
    cy.get( '.od__side .od__gate' ).should( 'be.visible' ).then( ( gate ) => cy.get( '.od__title' ).then( ( title ) => expect( gate[0].getBoundingClientRect().left ).to.be.greaterThan( title[0].getBoundingClientRect().right - 40 ) ) );
    cy.get( '.od__counts' ).should( 'not.be.visible' );
  } );
} );
