import { docsTabForUrl } from './docs-header.component';

describe( 'docsTabForUrl', () => {
  it( 'lights the tab each page belongs to, old addresses included', () => {
    expect( docsTabForUrl( '/docs' ) ).toBe( 'home' );
    expect( docsTabForUrl( '/docs?ref=menu' ) ).toBe( 'home' );
    expect( docsTabForUrl( '/opportunities' ) ).toBe( 'opportunities' );
    expect( docsTabForUrl( '/docs/rfp-list' ) ).toBe( 'opportunities' );
    expect( docsTabForUrl( '/docs/proposal-history' ) ).toBe( 'opportunities' );
    expect( docsTabForUrl( '/documents' ) ).toBe( 'documents' );
    expect( docsTabForUrl( '/upload' ) ).toBe( 'documents' );
    expect( docsTabForUrl( '/upload?rfp=1' ) ).toBe( 'opportunities' );
    expect( docsTabForUrl( '/opportunities/inbox' ) ).toBe( 'opportunities' );
    expect( docsTabForUrl( '/docs/editor/abc' ) ).toBe( 'documents' );
    expect( docsTabForUrl( '/knowledge/response-flow/1' ) ).toBe( 'knowledge' );
    expect( docsTabForUrl( '/about' ) ).toBe( 'about' );
    expect( docsTabForUrl( '/help' ) ).toBe( 'help' );
    expect( docsTabForUrl( '/profile' ) ).toBeNull();
    expect( docsTabForUrl( '/docs/documents-old' ) ).toBeNull();
  } );
} );
