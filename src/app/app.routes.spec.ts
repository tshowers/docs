import { routes } from './app.routes';

describe( 'Docs route table', () => {
  it( 'exposes every Docs and Knowledge route', () => {
    expect( routes.map( route => route.path ) ).toEqual( [
      '', 'auth/callback', 'mobile-handoff', 'ios', 'help', 'docs/success', 'knowledge/success',
      'docs/pricing', 'knowledge/pricing', 'docs', 'docs/landing', 'docs/upload',
      'docs/documents', 'docs/editor', 'docs/editor/:id', 'docs/proposal-history',
      'docs/rfp-list', 'docs/rfp-upload', 'knowledge/response-flow',
      'knowledge/response-flow/:id', 'knowledge', 'get-started', 'profile', 'login',
      'pricing', '**'
    ] );
    // The old Stripe pricing pages now land on /pricing ("browse free,
    // create with the app").
    expect( routes.filter( route => route.redirectTo ).map( route => route.redirectTo ) ).toEqual( ['pricing', 'pricing', 'docs'] );
    expect( routes.filter( route => route.loadComponent ).length ).toBe( 23 );
  } );
} );
