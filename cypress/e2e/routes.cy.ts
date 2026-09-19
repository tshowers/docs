const routes = [
  '/', '/auth/callback', '/ios', '/docs/success', '/knowledge/success',
  '/docs/pricing', '/knowledge/pricing', '/docs', '/docs/landing',
  '/docs/upload', '/docs/documents', '/docs/editor', '/docs/editor/e2e-doc',
  '/docs/proposal-history', '/docs/rfp-list', '/docs/rfp-upload',
  '/knowledge/response-flow', '/knowledge/response-flow/e2e-flow',
  '/knowledge', '/login'
];

describe( 'Docs accessible routes', () => {
  for ( const route of routes ) {
    it( `loads ${route}`, () => {
      cy.visit( route, {
        onBeforeLoad: ( win ) => win.localStorage.setItem( '__docsCypressAuth', 'true' )
      } );
      cy.get( 'body' ).should( 'be.visible' );
    } );
  }
} );
