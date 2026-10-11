import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';

/**
 * The proposal PDF for Review & send (design_handoff_todd_docs 1f): US
 * Letter, 1" margins, 11pt Helvetica body, bold headings, "Page n of N" -
 * the formatting most RFPs ask for. Built in the browser from the proposal
 * Document's HTML, so manual edits in the editor are included.
 */
export interface PdfBlock {
  kind: 'title' | 'h2' | 'h3' | 'p' | 'li';
  text: string;
}

const PAGE = { width: 612, height: 792, margin: 72 };
const STYLE: Record<PdfBlock['kind'], { size: number; bold: boolean; before: number; after: number; indent: number }> = {
  title: { size: 20, bold: true, before: 0, after: 14, indent: 0 },
  h2: { size: 15, bold: true, before: 16, after: 8, indent: 0 },
  h3: { size: 12.5, bold: true, before: 12, after: 6, indent: 0 },
  p: { size: 11, bold: false, before: 0, after: 8, indent: 0 },
  li: { size: 11, bold: false, before: 0, after: 4, indent: 16 },
};
const LINE = 1.4;

/** Characters Windows-1252 (and so pdf-lib's standard fonts) can draw beyond Latin-1. */
const WIN_ANSI_EXTRA = new Set( Array.from( '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ' ) );
const REPLACE: Record<string, string> = { '→': '->', '←': '<-', '≥': '>=', '≤': '<=', '✓': 'Yes', '✔': 'Yes', '★': '*', ' ': ' ', ' ': ' ', '​': '' };

/** Makes text drawable with the standard fonts: plain stand-ins, never a crash. */
export function pdfSafe ( text: string ): string {
  return Array.from( String( text || '' ).normalize( 'NFC' ) ).map( ( ch ) => {
    if ( ch in REPLACE ) return REPLACE[ch];
    const code = ch.codePointAt( 0 ) || 0;
    if ( ch === '\n' || ( code >= 32 && code <= 126 ) || ( code >= 160 && code <= 255 ) || WIN_ANSI_EXTRA.has( ch ) ) return ch;
    const ascii = ch.normalize( 'NFKD' ).replace( /[^\x20-\x7e]/g, '' );
    return ascii || '?';
  } ).join( '' );
}

/** The proposal's HTML as PDF blocks: headings, paragraphs and list items. */
export function blocksFromHtml ( html: string, title = '' ): PdfBlock[] {
  const blocks: PdfBlock[] = title ? [{ kind: 'title', text: title }] : [];
  const doc = new DOMParser().parseFromString( `<div>${ html || '' }</div>`, 'text/html' );
  const textOf = ( el: Element ) => ( el.textContent || '' ).replace( /\s+/g, ' ' ).trim();
  const walk = ( node: Element ) => {
    for ( const child of Array.from( node.children ) ) {
      const tag = child.tagName.toLowerCase();
      if ( tag === 'h1' || tag === 'h2' ) blocks.push( { kind: 'h2', text: textOf( child ) } );
      else if ( /^h[3-6]$/.test( tag ) ) blocks.push( { kind: 'h3', text: textOf( child ) } );
      else if ( tag === 'li' ) blocks.push( { kind: 'li', text: textOf( child ) } );
      else if ( tag === 'p' ) {
        // <br> inside a paragraph keeps its line break.
        const parts = ( child.innerHTML || '' ).split( /<br\s*\/?>/i ).map( ( part ) => {
          const tmp = new DOMParser().parseFromString( `<span>${ part }</span>`, 'text/html' ).body;
          return ( tmp.textContent || '' ).replace( /\s+/g, ' ' ).trim();
        } );
        blocks.push( { kind: 'p', text: parts.join( '\n' ) } );
      } else if ( ['ul', 'ol', 'div', 'section', 'article', 'blockquote', 'body', 'span'].includes( tag ) && child.children.length ) walk( child );
      else if ( textOf( child ) ) blocks.push( { kind: 'p', text: textOf( child ) } );
    }
  };
  walk( doc.body.firstElementChild || doc.body );
  return blocks.filter( ( b ) => b.text );
}

function wrap ( text: string, font: PDFFont, size: number, width: number ): string[] {
  const lines: string[] = [];
  for ( const paragraph of text.split( '\n' ) ) {
    let line = '';
    for ( const word of paragraph.split( /\s+/ ).filter( Boolean ) ) {
      const next = line ? `${ line } ${ word }` : word;
      if ( font.widthOfTextAtSize( next, size ) <= width ) {
        line = next;
        continue;
      }
      if ( line ) lines.push( line );
      // A single word wider than the line (a long URL) is broken by character.
      let rest = word;
      while ( font.widthOfTextAtSize( rest, size ) > width ) {
        let cut = rest.length - 1;
        while ( cut > 1 && font.widthOfTextAtSize( rest.slice( 0, cut ), size ) > width ) cut -= 1;
        lines.push( rest.slice( 0, cut ) );
        rest = rest.slice( cut );
      }
      line = rest;
    }
    lines.push( line );
  }
  return lines;
}

/** Builds the PDF. Returns its bytes and page count (for "14 pp" and the checklist). */
export async function buildProposalPdf ( html: string, options: { title?: string; author?: string } = {} ): Promise<{ bytes: Uint8Array; pages: number }> {
  const pdf = await PDFDocument.create();
  pdf.setTitle( pdfSafe( options.title || 'Proposal' ) );
  if ( options.author ) pdf.setAuthor( pdfSafe( options.author ) );
  pdf.setCreator( 'TODD Docs' );
  const regular = await pdf.embedFont( StandardFonts.Helvetica );
  const bold = await pdf.embedFont( StandardFonts.HelveticaBold );
  const width = PAGE.width - PAGE.margin * 2;
  const ink = rgb( 0.06, 0.07, 0.08 );

  let page = pdf.addPage( [PAGE.width, PAGE.height] );
  let y = PAGE.height - PAGE.margin;
  const newPage = () => {
    page = pdf.addPage( [PAGE.width, PAGE.height] );
    y = PAGE.height - PAGE.margin;
  };

  for ( const block of blocksFromHtml( html, options.title ) ) {
    const style = STYLE[block.kind];
    const font = style.bold ? bold : regular;
    const text = pdfSafe( block.text );
    const lines = wrap( text, font, style.size, width - style.indent );
    const lineHeight = style.size * LINE;
    if ( y < PAGE.height - PAGE.margin ) y -= style.before;
    // Keep a heading with at least two lines of what follows.
    const keep = block.kind === 'h2' || block.kind === 'h3' ? lineHeight * ( lines.length + 2 ) : lineHeight;
    if ( y - keep < PAGE.margin ) newPage();
    lines.forEach( ( line, index ) => {
      if ( y - lineHeight < PAGE.margin ) newPage();
      y -= lineHeight;
      if ( block.kind === 'li' && index === 0 ) page.drawText( '•', { x: PAGE.margin + 4, y, size: style.size, font: regular, color: ink } );
      page.drawText( line, { x: PAGE.margin + style.indent, y, size: style.size, font, color: ink } );
    } );
    y -= style.after;
  }

  const pages = pdf.getPages();
  pages.forEach( ( p, index ) => {
    const label = `Page ${ index + 1 } of ${ pages.length }`;
    p.drawText( label, { x: PAGE.width - PAGE.margin - regular.widthOfTextAtSize( label, 9 ), y: PAGE.margin / 2, size: 9, font: regular, color: rgb( 0.35, 0.38, 0.44 ) } );
  } );
  return { bytes: await pdf.save(), pages: pages.length };
}
