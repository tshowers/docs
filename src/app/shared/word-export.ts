import { AlignmentType, Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, ParagraphChild, TextRun } from 'docx';

/**
 * A real .docx from the editor's HTML (Studio's Word button). Keeps what
 * people expect to survive: headings, paragraphs, bulleted and numbered
 * lists, bold, italic, underline and links. Tables, images and colours are
 * not carried over. Loaded on demand - the library stays out of the main
 * bundle.
 */
type Marks = { bold?: boolean; italics?: boolean; underline?: Record<string, never>; strike?: boolean };

const HEADINGS: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  h1: HeadingLevel.HEADING_1,
  h2: HeadingLevel.HEADING_2,
  h3: HeadingLevel.HEADING_3,
  h4: HeadingLevel.HEADING_4,
  h5: HeadingLevel.HEADING_5,
  h6: HeadingLevel.HEADING_6,
};

function runsOf ( node: Node, marks: Marks = {} ): ParagraphChild[] {
  const runs: ParagraphChild[] = [];
  node.childNodes.forEach( ( child ) => {
    if ( child.nodeType === Node.TEXT_NODE ) {
      const text = ( child.textContent || '' ).replace( /\s+/g, ' ' );
      if ( text ) runs.push( new TextRun( { text, ...marks } ) );
      return;
    }
    if ( !( child instanceof HTMLElement ) ) return;
    const tag = child.tagName.toLowerCase();
    if ( tag === 'br' ) {
      runs.push( new TextRun( { text: '', break: 1 } ) );
      return;
    }
    const next: Marks = { ...marks };
    if ( tag === 'b' || tag === 'strong' ) next.bold = true;
    if ( tag === 'i' || tag === 'em' ) next.italics = true;
    if ( tag === 'u' ) next.underline = {};
    if ( tag === 's' || tag === 'strike' || tag === 'del' ) next.strike = true;
    if ( tag === 'a' && child.getAttribute( 'href' ) ) {
      runs.push( new ExternalHyperlink( {
        link: child.getAttribute( 'href' )!,
        children: [new TextRun( { text: child.textContent || '', ...next, style: 'Hyperlink' } )],
      } ) );
      return;
    }
    runs.push( ...runsOf( child, next ) );
  } );
  return runs;
}

/** The document's block elements as Word paragraphs. */
export function paragraphsFromHtml ( html: string ): Paragraph[] {
  const root = new DOMParser().parseFromString( `<div>${ html || '' }</div>`, 'text/html' ).body.firstElementChild!;
  const out: Paragraph[] = [];
  const walk = ( node: Element, list: { ordered: boolean; level: number } | null ) => {
    let loose: ChildNode[] = [];
    const flushLoose = () => {
      const holder = document.createElement( 'span' );
      loose.forEach( ( n ) => holder.appendChild( n.cloneNode( true ) ) );
      loose = [];
      if ( ( holder.textContent || '' ).trim() ) out.push( new Paragraph( { children: runsOf( holder ) } ) );
    };
    for ( const child of Array.from( node.childNodes ) ) {
      if ( !( child instanceof HTMLElement ) ) {
        loose.push( child );
        continue;
      }
      const tag = child.tagName.toLowerCase();
      if ( ['b', 'strong', 'i', 'em', 'u', 's', 'a', 'span', 'br', 'mark', 'code'].includes( tag ) ) {
        loose.push( child );
        continue;
      }
      flushLoose();
      if ( HEADINGS[tag] ) out.push( new Paragraph( { heading: HEADINGS[tag], children: runsOf( child ) } ) );
      else if ( tag === 'ul' || tag === 'ol' ) walk( child, { ordered: tag === 'ol', level: list ? list.level + 1 : 0 } );
      else if ( tag === 'li' ) {
        // Text of the item; nested lists inside it become their own items.
        const own = child.cloneNode( true ) as HTMLElement;
        own.querySelectorAll( 'ul, ol' ).forEach( ( l ) => l.remove() );
        const level = list?.level ?? 0;
        out.push( new Paragraph( {
          children: runsOf( own ),
          ...( list?.ordered ? { numbering: { reference: 'dk-numbered', level } } : { bullet: { level } } ),
        } ) );
        child.querySelectorAll( ':scope > ul, :scope > ol' ).forEach( ( l ) => walk( l, { ordered: l.tagName === 'OL', level: level + 1 } ) );
      } else if ( tag === 'p' ) out.push( new Paragraph( { children: runsOf( child ) } ) );
      else if ( tag === 'blockquote' ) out.push( new Paragraph( { children: runsOf( child ), indent: { left: 720 } } ) );
      else if ( tag === 'hr' ) out.push( new Paragraph( { children: [], border: { bottom: { style: 'single', size: 6, color: 'auto', space: 1 } } } ) );
      else walk( child, list );
    }
    flushLoose();
  };
  walk( root, null );
  return out;
}

export async function buildDocx ( html: string, options: { title?: string; author?: string } = {} ): Promise<Blob> {
  const doc = new Document( {
    title: options.title || 'Document',
    creator: options.author || 'TODD Docs',
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    numbering: {
      config: [{
        reference: 'dk-numbered',
        levels: [0, 1, 2, 3].map( ( level ) => ( {
          level,
          format: 'decimal' as const,
          text: `%${ level + 1 }.`,
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 720 * ( level + 1 ), hanging: 360 } } },
        } ) ),
      }],
    },
    sections: [{ children: paragraphsFromHtml( html ) }],
  } );
  return Packer.toBlob( doc );
}
