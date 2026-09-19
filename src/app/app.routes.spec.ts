import { routes } from './app.routes';

describe( 'Docs route table', () => {
  it( 'exposes every Docs and Knowledge route', () => {
    expect( routes.map( route => route.path ) ).toEqual( [
      '', 'auth/callback', 'ios', 'docs/success', 'knowledge/success',
      'docs/pricing', 'knowledge/pricing', 'docs', 'docs/landing', 'docs/upload',
      'docs/documents', 'docs/editor', 'docs/editor/:id', 'docs/proposal-history',
      'docs/rfp-list', 'docs/rfp-upload', 'knowledge/response-flow',
      'knowledge/response-flow/:id', 'knowledge', 'login'
    ] );
    expect( routes.filter( route => route.redirectTo ).map( route => route.redirectTo ) ).toEqual( ['docs'] );
    expect( routes.filter( route => route.loadComponent ).length ).toBe( 19 );
  } );
} );
