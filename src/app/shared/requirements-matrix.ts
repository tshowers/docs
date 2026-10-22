import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import { Requirement } from '../models/opportunity';
import { pdfSafe, wrap } from './proposal-pdf';

/**
 * The compliance matrix as an appendix (design_handoff_todd_docs_lifecycle
 * 1e, Export as appendix): one row per shall/must/will with the RFP
 * reference, the requirement, its type and where the proposal answers it.
 * Built in the browser like the proposal PDF; Word is loaded on demand.
 */
export interface MatrixRow {
  ref: string;
  requirement: string;
  type: string;
  answeredIn: string;
}

/** Where it's answered, as the appendix says it. */
export function answeredInLabel ( item: Pick<Requirement, 'status' | 'answeredIn' | 'manual'>, sectionTitle: ( key: string ) => string = () => '' ): string {
  if ( item.status !== 'answered' ) return 'Not answered';
  if ( item.answeredIn?.label ) return item.answeredIn.label;
  return sectionTitle( item.answeredIn?.sectionKey || '' ) || 'Answered';
}

export function matrixRows ( items: Requirement[], sectionTitle?: ( key: string ) => string ): MatrixRow[] {
  return items.map( ( r ) => ( { ref: r.ref || '–', requirement: r.text, type: r.type, answeredIn: answeredInLabel( r, sectionTitle ) } ) );
}

const PAGE = { width: 792, height: 612, margin: 54 };
const COLUMNS: { key: keyof MatrixRow; label: string; share: number }[] = [
  { key: 'ref', label: 'RFP ref', share: 0.12 },
  { key: 'requirement', label: 'Requirement', share: 0.52 },
  { key: 'type', label: 'Type', share: 0.08 },
  { key: 'answeredIn', label: 'Answered in', share: 0.28 },
];

/** US Letter landscape, 9.5pt, the header row repeated on every page. */
export async function buildMatrixPdf ( rows: MatrixRow[], options: { title: string; author?: string } ): Promise<{ bytes: Uint8Array; pages: number }> {
  const pdf = await PDFDocument.create();
  pdf.setTitle( pdfSafe( options.title ) );
  if ( options.author ) pdf.setAuthor( pdfSafe( options.author ) );
  pdf.setCreator( 'TODD Docs' );
  const regular = await pdf.embedFont( StandardFonts.Helvetica );
  const bold = await pdf.embedFont( StandardFonts.HelveticaBold );
  const ink = rgb( 0.06, 0.07, 0.08 );
  const rule = rgb( 0.85, 0.86, 0.89 );
  const size = 9.5;
  const line = size * 1.35;
  const pad = 6;
  const width = PAGE.width - PAGE.margin * 2;
  const widths = COLUMNS.map( ( c ) => c.share * width );

  let page = pdf.addPage( [PAGE.width, PAGE.height] );
  let y = PAGE.height - PAGE.margin;

  const drawRow = ( cells: string[], font = regular ) => {
    const wrapped = cells.map( ( cell, i ) => wrap( pdfSafe( cell ), font, size, widths[i] - pad * 2 ) );
    const height = Math.max( ...wrapped.map( ( l ) => l.length ) ) * line + pad * 2;
    return { wrapped, height, draw: () => {
      let x = PAGE.margin;
      wrapped.forEach( ( lines, i ) => {
        lines.forEach( ( text, n ) => page.drawText( text, { x: x + pad, y: y - pad - size - n * line, size, font, color: ink } ) );
        x += widths[i];
      } );
      y -= height;
      page.drawLine( { start: { x: PAGE.margin, y }, end: { x: PAGE.width - PAGE.margin, y }, thickness: 0.6, color: rule } );
    } };
  };
  const header = () => drawRow( COLUMNS.map( ( c ) => c.label ), bold ).draw();

  page.drawText( pdfSafe( options.title ), { x: PAGE.margin, y: y - 16, size: 16, font: bold, color: ink } );
  y -= 30;
  header();
  for ( const row of rows ) {
    const next = drawRow( COLUMNS.map( ( c ) => row[c.key] ) );
    if ( y - next.height < PAGE.margin ) {
      page = pdf.addPage( [PAGE.width, PAGE.height] );
      y = PAGE.height - PAGE.margin;
      header();
    }
    next.draw();
  }

  const pages = pdf.getPages();
  pages.forEach( ( p, index ) => {
    const label = `Page ${ index + 1 } of ${ pages.length }`;
    p.drawText( label, { x: PAGE.width - PAGE.margin - regular.widthOfTextAtSize( label, 9 ), y: PAGE.margin / 2, size: 9, font: regular, color: rgb( 0.35, 0.38, 0.44 ) } );
  } );
  return { bytes: await pdf.save(), pages: pages.length };
}

export async function buildMatrixDocx ( rows: MatrixRow[], options: { title: string; author?: string } ): Promise<Blob> {
  const { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, PageOrientation } = await import( 'docx' );
  const cell = ( text: string, bold = false, share = 0.25 ) => new TableCell( {
    width: { size: Math.round( share * 100 ), type: WidthType.PERCENTAGE },
    children: [new Paragraph( { children: [new TextRun( { text, bold, size: 19 } )] } )],
  } );
  const table = new Table( {
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow( { tableHeader: true, children: COLUMNS.map( ( c ) => cell( c.label, true, c.share ) ) } ),
      ...rows.map( ( row ) => new TableRow( { children: COLUMNS.map( ( c ) => cell( row[c.key], false, c.share ) ) } ) ),
    ],
  } );
  const doc = new Document( {
    creator: options.author || 'TODD Docs',
    title: options.title,
    sections: [{
      properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } },
      children: [new Paragraph( { heading: HeadingLevel.HEADING_1, children: [new TextRun( options.title )] } ), table],
    }],
  } );
  return Packer.toBlob( doc );
}
