/**
 * Where Home's ask box sends what you typed (design_handoff_todd_docs,
 * "Home box: TODD routes the input"): a link goes to Opportunities, a
 * question to Knowledge, anything else is a search of Documents.
 */
export interface AskRoute {
  kind: 'rfp-link' | 'question' | 'search';
  path: string;
  queryParams: Record<string, string>;
}

const QUESTION_START = /^(how|what|why|when|where|which|who|whom|whose|do|does|did|can|could|should|would|will|is|are|was|were|have|has|tell me|explain)\b/i;

export function routeAsk ( input: string ): AskRoute | null {
  const text = String( input || '' ).trim();
  if ( !text ) return null;
  if ( /^https?:\/\/\S+$/i.test( text ) ) {
    return { kind: 'rfp-link', path: '/upload', queryParams: { rfp: '1', link: text } };
  }
  if ( text.endsWith( '?' ) || QUESTION_START.test( text ) ) {
    return { kind: 'question', path: '/knowledge', queryParams: { q: text.replace( /\?+$/, '' ) } };
  }
  return { kind: 'search', path: '/documents', queryParams: { q: text } };
}
