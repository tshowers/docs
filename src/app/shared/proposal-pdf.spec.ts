import { blocksFromHtml, buildProposalPdf, pdfSafe } from './proposal-pdf';

describe( 'proposal PDF', () => {
  it( 'reads headings, paragraphs and list items from the proposal HTML', () => {
    const blocks = blocksFromHtml( '<h2>3. Technical approach</h2><h3>3.4 Accessibility</h3><p>Line one<br>line two</p><ul><li>axe in CI</li></ul><p><mark>[price]</mark></p>', 'Proposal' );
    expect( blocks ).toEqual( [
      { kind: 'title', text: 'Proposal' },
      { kind: 'h2', text: '3. Technical approach' },
      { kind: 'h3', text: '3.4 Accessibility' },
      { kind: 'p', text: 'Line one\nline two' },
      { kind: 'li', text: 'axe in CI' },
      { kind: 'p', text: '[price]' },
    ] );
  } );

  it( 'keeps what the standard fonts can draw and swaps the rest', () => {
    expect( pdfSafe( 'Taliferro — “WCAG” café → ✓ 日本' ) ).toBe( 'Taliferro — “WCAG” café -> Yes ??' );
  } );

  it( 'builds a real multi-page PDF', async () => {
    const long = Array.from( { length: 40 }, ( _v, i ) => `<p>Paragraph ${ i } ${ 'word '.repeat( 60 ) }</p>` ).join( '' );
    const { bytes, pages } = await buildProposalPdf( `<h2>Section</h2>${ long }`, { title: 'Proposal · Permit Portal', author: 'Taliferro Tech' } );
    expect( new TextDecoder().decode( bytes.slice( 0, 5 ) ) ).toBe( '%PDF-' );
    expect( pages ).toBeGreaterThan( 3 );
  } );
} );
