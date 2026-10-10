/** Search-term highlighting for card titles (the red `--hl` marks in 1h and 1g). */
export interface HighlightPart { text: string; hit: boolean; }

/** Splits text around every case-insensitive match of the search term. */
export function highlightParts ( value: string, term: string ): HighlightPart[] {
  const text = String( value || '' );
  const query = String( term || '' ).trim();
  if ( !query ) return [{ text, hit: false }];
  const parts: HighlightPart[] = [];
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  let from = 0;
  let at = lower.indexOf( needle );
  while ( at >= 0 ) {
    if ( at > from ) parts.push( { text: text.slice( from, at ), hit: false } );
    parts.push( { text: text.slice( at, at + needle.length ), hit: true } );
    from = at + needle.length;
    at = lower.indexOf( needle, from );
  }
  if ( from < text.length ) parts.push( { text: text.slice( from ), hit: false } );
  return parts;
}
