describe( 'Knowledge Base response-flow lifecycle', () => {
  const id = 'docs-cypress-flow';
  let flow: any = null;

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
  } );

  it( 'creates, reads in Knowledge Base, updates, and deletes a response flow', () => {
    cy.visit( '/knowledge/response-flow', { onBeforeLoad: ( win ) => win.localStorage.setItem( '__docsCypressAuth', 'true' ) } );
    cy.get( 'input[placeholder="Enter your question..."]' ).type( 'How do we support customers?' );
    cy.contains( 'button', 'Next' ).click( { force: true } );
    cy.get( 'textarea[placeholder="Type your response..."]' ).type( 'Support is available by email.' );
    cy.get( 'input[placeholder="https://example.com"]' ).type( 'https://example.com/support' );
    cy.contains( 'button', 'Add' ).click();
    cy.contains( 'button', 'Next' ).click( { force: true } );
    cy.get( 'input[placeholder="Recommended item..."]' ).type( 'Read the support guide' );
    cy.get( 'input[placeholder="https://..."]' ).first().type( 'https://example.com/guide' );
    cy.get( 'select' ).eq( 0 ).select( 'Resource' );
    cy.contains( 'button', 'Add Recommendation' ).click();
    cy.contains( 'button', 'Next' ).click( { force: true } );
    cy.get( 'input[placeholder="https://..."]' ).type( 'https://example.com/contact' );
    cy.contains( 'button', 'Add' ).click();
    cy.contains( 'button', 'Next' ).click( { force: true } );
    cy.get( 'input[placeholder*="Type a keyword"]' ).type( 'support' );
    cy.contains( 'button', 'Add' ).click();
    cy.contains( 'button', 'Submit' ).click( { force: true } );
    cy.wait( '@createFlow' ).its( 'request.body.question' ).should( 'eq', 'How do we support customers?' );

    cy.visit( '/knowledge', { onBeforeLoad: ( win ) => win.localStorage.setItem( '__docsCypressAuth', 'true' ) } );
    cy.wait( '@listFlows' );
    cy.contains( 'How do we support customers?' ).should( 'be.visible' );
    cy.get( 'button[title="Edit"]' ).click( { force: true } );
    cy.get( 'input[placeholder="Enter your question..."]' ).should( 'have.value', 'How do we support customers?' ).clear().type( 'How do we support enterprise customers?' );
    cy.contains( 'button', 'Next' ).click( { force: true } ).click( { force: true } ).click( { force: true } ).click( { force: true } );
    cy.contains( 'button', 'Submit' ).click( { force: true } );
    cy.wait( '@updateFlow' );
    cy.visit( '/knowledge' );
    cy.wait( '@listFlows' );
    cy.contains( 'How do we support enterprise customers?' ).should( 'be.visible' );
    cy.on( 'window:confirm', () => true );
    cy.get( 'button[title="Delete"]' ).click( { force: true } );
    cy.wait( '@deleteFlow' );
    cy.contains( 'How do we support enterprise customers?' ).should( 'not.exist' );
  } );
} );
