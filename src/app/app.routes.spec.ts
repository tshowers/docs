import { routes } from './app.routes';

describe( 'Docs route table', () => {
  it( 'exposes every Docs and Knowledge route', () => {
    expect( routes.map( route => route.path ) ).toEqual( [
      '', 'auth/callback', 'mobile-handoff', 'ios', 'about', 'help', 'docs/success', 'knowledge/success',
      'docs/pricing', 'knowledge/pricing', 'docs', 'docs/landing', 'opportunities', 'opportunities/inbox', 'opportunities/:id/proposal', 'opportunities/:id', 'documents',
      'documents/:id', 'docs/documents', 'upload', 'docs/upload', 'new', 'docs/editor', 'docs/editor/:id',
      'docs/proposal-history', 'docs/rfp-list', 'docs/rfp-upload', 'knowledge/response-flow',
      'knowledge/response-flow/:id', 'knowledge', 'knowledge/:id', 'get-started', 'profile', 'login',
      'pricing', '**'
    ] );
    // The old Stripe pricing pages now land on /pricing ("browse free,
    // create with the app"); the vault and upload moved under the
    // Documents tab; RFP list, Proposal History and RFP upload under
    // Opportunities.
    expect( routes.filter( route => route.redirectTo ).map( route => route.redirectTo ) ).toEqual( ['pricing', 'pricing', 'docs', 'documents', 'upload', 'opportunities', 'opportunities', '/upload?rfp=1'] );
    expect( routes.filter( route => route.loadComponent ).length ).toBe( 28 );
  } );
} );
