Cypress.on( 'uncaught:exception', () => false );

beforeEach( () => {
  cy.intercept( '**/api/**', ( request ) => {
    if ( request.method === 'GET' ) request.reply( { statusCode: 200, body: [] } );
    else request.reply( { statusCode: 200, body: { id: 'docs-cypress-flow' } } );
  } ).as( 'apiFallback' );
  // The Cypress user has the Docs app, so write actions aren't gated (WriteAccessService).
  cy.intercept( 'GET', '**/account/summary*', { statusCode: 200, body: { data: { writeAccess: { docs: true } } } } ).as( 'accountSummary' );
} );
