import { formatCitation } from './knowledge-detail.component';

describe( 'formatCitation', () => {
  it( 'keeps the old Knowledge Base citation format', () => {
    expect( formatCitation( { answer: 'We build to WCAG 2.1 AA.', source: 'https://www.w3.org/TR/WCAG21/' }, new Date( '2026-10-09T12:00:00Z' ) ) )
      .toBe( 'We build to WCAG 2.1 AA. Source: w3.org. https://www.w3.org/TR/WCAG21/ (accessed 2026-10-09).' );
  } );
} );
