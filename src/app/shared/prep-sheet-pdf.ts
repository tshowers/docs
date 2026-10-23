import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import { pdfSafe, wrap } from './proposal-pdf';

/**
 * The orals prep sheet (design_handoff_todd_docs_lifecycle 1k, Download prep
 * sheet): one Letter page with the presentation's details, the likely
 * questions, the three win themes and the numbers to know.
 */
export async function buildPrepSheetPdf ( sheet: { title: string; when: string; who: string; questions: string[]; themes: string[]; numbers: string[] } ): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle( pdfSafe( `Prep sheet · ${ sheet.title }` ) );
  pdf.setCreator( 'TODD Docs' );
  const regular = await pdf.embedFont( StandardFonts.Helvetica );
  const bold = await pdf.embedFont( StandardFonts.HelveticaBold );
  const ink = rgb( 0.06, 0.07, 0.08 );
  const muted = rgb( 0.35, 0.38, 0.44 );
  const margin = 64;
  const width = 612 - margin * 2;
  let page = pdf.addPage( [612, 792] );
  let y = 792 - margin;
  const line = ( text: string, size: number, font = regular, color = ink, indent = 0 ) => {
    for ( const part of wrap( pdfSafe( text ), font, size, width - indent ) ) {
      if ( y - size * 1.4 < margin ) {
        page = pdf.addPage( [612, 792] );
        y = 792 - margin;
      }
      y -= size * 1.4;
      page.drawText( part, { x: margin + indent, y, size, font, color } );
    }
  };
  line( sheet.title, 20, bold );
  if ( sheet.when ) line( sheet.when, 11, regular, muted );
  if ( sheet.who ) line( sheet.who, 11, regular, muted );
  const block = ( heading: string, items: string[] ) => {
    if ( !items.length ) return;
    y -= 14;
    line( heading, 13, bold );
    items.forEach( ( item, i ) => {
      y -= 4;
      line( `${ i + 1 }.  ${ item }`, 11, regular, ink, 4 );
    } );
  };
  block( 'Likely questions', sheet.questions );
  block( 'Your 3 win themes', sheet.themes );
  block( 'Numbers to know', sheet.numbers );
  return pdf.save();
}
