/**
 * Studio's first draft (design_handoff_todd_docs 3a): the passages TODD wrote
 * from New, tinted by where their facts came from until the first save, and
 * the "Written from" list kept with the document.
 */
export type DraftSourceKind = 'profile' | 'knowledge' | 'opportunity';

export interface DraftBlock {
  type: 'heading' | 'paragraph';
  text: string;
  source: DraftSourceKind | '';
}

export interface DocSource {
  kind: DraftSourceKind;
  label: string;
  detail: string;
}

export const SOURCE_TINT: Record<DraftSourceKind, { tint: string; icon: string }> = {
  profile: { tint: 'blue', icon: 'user' },
  knowledge: { tint: 'cyan', icon: 'book' },
  opportunity: { tint: 'violet', icon: 'inbox' },
};

function escapeHtml ( text: string ): string {
  return String( text || '' ).replace( /&/g, '&amp;' ).replace( /</g, '&lt;' ).replace( />/g, '&gt;' ).replace( /"/g, '&quot;' );
}

/** "From your profile · Company description, value proposition". */
export function sourceLabel ( kind: DraftSourceKind, sources: DocSource[] ): string {
  const source = sources.find( ( s ) => s.kind === kind );
  if ( kind === 'profile' ) return `From your profile${ source?.detail ? ` · ${ source.detail }` : '' }`;
  if ( kind === 'knowledge' ) return `From Knowledge${ source?.label ? ` · ${ source.label }` : '' }`;
  const rfp = ( source?.label || 'opportunity' ).replace( /\s*RFP$/i, '' );
  return `Matched to the ${ rfp } RFP${ source?.detail ? ` · ${ source.detail }` : '' }`;
}

/** The first draft as HTML, consecutive passages from one source in one tinted block. */
export function tintedDraftHtml ( title: string, blocks: DraftBlock[], sources: DocSource[] ): string {
  const out: string[] = title ? [`<h1>${ escapeHtml( title ) }</h1>`] : [];
  let open: DraftSourceKind | '' = '';
  const close = () => {
    if ( open ) out.push( '</div>' );
    open = '';
  };
  for ( const block of blocks || [] ) {
    const text = escapeHtml( block.text ).replace( /\n/g, '<br>' );
    if ( block.type === 'heading' ) {
      close();
      out.push( `<h2>${ text }</h2>` );
      continue;
    }
    const kind = block.source && SOURCE_TINT[block.source] ? block.source : '';
    if ( kind !== open ) {
      close();
      if ( kind ) out.push( `<div class="dk-src" data-src="${ kind }" data-label="${ escapeHtml( sourceLabel( kind, sources ) ) }">` );
      open = kind;
    }
    out.push( `<p>${ text }</p>` );
  }
  close();
  return out.join( '' );
}

/** The document without the first-draft tints: what gets saved, copied and exported. */
export function stripSourceTints ( html: string ): string {
  if ( !html || !html.includes( 'dk-src' ) ) return html || '';
  const holder = document.createElement( 'div' );
  holder.innerHTML = html;
  holder.querySelectorAll( '.dk-src' ).forEach( ( el ) => el.replaceWith( ...Array.from( el.childNodes ) ) );
  return holder.innerHTML;
}

/** True when the page has words on it, not just empty tags. */
export function hasText ( html: string ): boolean {
  return !!String( html || '' ).replace( /<[^>]*>/g, '' ).replace( /&nbsp;/g, ' ' ).trim();
}

/** The sources as saved on the document, dropping anything malformed. */
export function normalizeSources ( raw: unknown ): DocSource[] {
  return ( Array.isArray( raw ) ? raw : [] )
    .filter( ( s: any ) => s && SOURCE_TINT[s.kind as DraftSourceKind] && s.label )
    .map( ( s: any ) => ( { kind: s.kind, label: String( s.label ), detail: String( s.detail || '' ) } ) );
}

/** "saved just now", "saved 2 min ago", "saved Oct 9". */
export function savedAgo ( iso: string | undefined, now = new Date() ): string {
  const at = new Date( iso || '' );
  if ( !iso || isNaN( at.getTime() ) ) return '';
  const minutes = Math.round( ( now.getTime() - at.getTime() ) / 60000 );
  if ( minutes < 1 ) return 'saved just now';
  if ( minutes < 60 ) return `saved ${ minutes } min ago`;
  const hours = Math.round( minutes / 60 );
  if ( minutes < 24 * 60 ) return `saved ${ hours } ${ hours === 1 ? 'hour' : 'hours' } ago`;
  return `saved ${ at.toLocaleDateString( 'en-US', { month: 'short', day: 'numeric' } ) }`;
}
