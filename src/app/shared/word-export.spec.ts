import JSZip from 'jszip';

import { buildDocx, paragraphsFromHtml } from './word-export';

describe( 'Word export', () => {
  it( 'turns headings, paragraphs and list items into Word paragraphs', () => {
    const paragraphs = paragraphsFromHtml( '<h1>Title</h1><p>One <b>bold</b></p><ul><li>a</li><li>b<ul><li>c</li></ul></li></ul><ol><li>d</li></ol>loose text' );
    expect( paragraphs.length ).toBe( 7 );
  } );

  it( 'builds a real .docx with the text in it', async () => {
    const blob = await buildDocx( '<h2>Approach</h2><p>We use <i>axe</i> in CI &amp; <a href="https://example.com">audits</a>.</p><ul><li>WCAG 2.2</li></ul>', { title: 'Proposal' } );
    const zip = await JSZip.loadAsync( await blob.arrayBuffer() );
    const xml = await zip.file( 'word/document.xml' )!.async( 'string' );
    expect( xml ).toContain( 'Approach' );
    expect( xml ).toContain( 'WCAG 2.2' );
    expect( xml ).toContain( '<w:i/>' );
    expect( xml ).toContain( 'Heading2' );
  } );
} );
