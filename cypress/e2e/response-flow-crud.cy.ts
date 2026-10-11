// Knowledge answers: Add an answer (3d) creates one, the answer page (2d)
// shows it, Edit reopens the same page pre-filled, and Delete lives on the
// answer page.
describe( 'Knowledge answer lifecycle', () => {
  const id = 'docs-cypress-flow';
  let flow: any = null;
  const auth = { onBeforeLoad: ( win: Window ) => win.localStorage.setItem( '__docsCypressAuth', 'true' ) };

  beforeEach( () => {
    cy.intercept( 'GET', '**/api/response-flows', ( req ) => req.reply( { statusCode: 200, body: flow ? [flow] : [] } ) ).as( 'listFlows' );
    cy.intercept( 'GET', `**/api/response-flows/${id}`, ( req ) => req.reply( { statusCode: 200, body: flow } ) ).as( 'getFlow' );
    cy.intercept( 'POST', '**/api/response-flows', ( req ) => {
      flow = { id, ...req.body };
      req.reply( { statusCode: 200, body: flow } );
    } ).as( 'createFlow' );
    cy.intercept( 'PUT', `**/api/response-flows/${id}`, ( req ) => {
      flow = { ...flow, ...req.body };
      req.reply( { statusCode: 200, body: flow } );
    } ).as( 'updateFlow' );
    cy.intercept( 'DELETE', `**/api/response-flows/${id}`, ( req ) => {
      flow = null;
      req.reply( { statusCode: 200, body: {} } );
    } ).as( 'deleteFlow' );
    cy.intercept( 'POST', '**/api/docs/knowledge/suggest', { statusCode: 200, body: { success: true, data: { category: 'Support', isNewCategory: true, keywords: ['support'] } } } );
  } );

  it( 'adds, shows, edits and deletes an answer', () => {
    cy.visit( '/knowledge/response-flow', auth );
    cy.get( '[data-cy="answer-question"]' ).type( 'How do we support customers?' );
    cy.get( '[data-cy="answer-text-0"]' ).type( 'Support is available by email.' );
    cy.contains( 'button', 'Add a link' ).click();
    cy.get( 'input[placeholder="https://…"]' ).type( 'example.com/support{enter}' );
    cy.get( '[data-cy="answer-save"]' ).click();
    cy.wait( '@createFlow' ).its( 'request.body' ).should( ( body ) => {
      expect( body.question ).to.eq( 'How do we support customers?' );
      expect( body.answers[0] ).to.deep.include( { answer: 'Support is available by email.', source: 'https://example.com/support' } );
      expect( body.status ).to.eq( 'complete' );
    } );

    cy.visit( `/knowledge/${id}`, auth );
    cy.contains( 'h1', 'How do we support customers?' ).should( 'be.visible' );
    cy.contains( 'button', 'Edit' ).click();
    cy.get( '[data-cy="answer-question"]' ).should( 'have.value', 'How do we support customers?' ).clear().type( 'How do we support enterprise customers?' );
    cy.get( '[data-cy="answer-save"]' ).click();
    cy.wait( '@updateFlow' ).its( 'request.body.question' ).should( 'eq', 'How do we support enterprise customers?' );

    cy.visit( `/knowledge/${id}`, auth );
    cy.on( 'window:confirm', () => true );
    cy.get( 'button[aria-label="More actions"]' ).click();
    cy.contains( 'button', 'Delete' ).click();
    cy.wait( '@deleteFlow' );
  } );
} );
