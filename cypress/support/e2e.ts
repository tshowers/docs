Cypress.on( 'uncaught:exception', () => false );

beforeEach( () => {
  cy.intercept( '**/api/**', ( request ) => {
    if ( request.method === 'GET' ) request.reply( { statusCode: 200, body: [] } );
    else request.reply( { statusCode: 200, body: { id: 'docs-cypress-flow' } } );
  } ).as( 'apiFallback' );
} );
