/**
 * A Knowledge answer as the response-flows API returns it (kb.service.js
 * mapResponseFlowRecord). The redesign's Knowledge grid (1g) and answer
 * view (2d) read these fields directly.
 */
export interface KnowledgeAnswer {
  answer: string;
  source?: string;
  document?: { name?: string; src?: string; type?: string } | null;
}

export interface KnowledgeRecommendation {
  text: string;
  link?: string;
  type?: string;
  document?: { name?: string; src?: string; type?: string } | null;
}

export interface KnowledgeItem {
  id: string;
  question: string;
  /** Older entries carry a single response/answer string instead of answers[]. */
  response?: string;
  answer?: string;
  answers: KnowledgeAnswer[];
  category?: string;
  /** 'bookmark' when saved from Find. */
  type?: string;
  /** 'draft' when the question or answer is missing. */
  status?: string;
  keywords: string[];
  recommendations: KnowledgeRecommendation[];
  resources: { link: string }[];
  relatedDocumentIds?: string[];
  summary?: string;
  /** Set when TODD asked this while drafting a proposal. */
  origin?: { kind: string; opportunityId?: string; proposalDocumentId?: string; proposalTitle?: string; agency?: string; askedAt?: string } | null;
  /** Proposal documents that used this answer. */
  usedInProposals?: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

const DAY = 24 * 60 * 60 * 1000;

/** TODD asks again once an answer hasn't been confirmed for a year. */
export const STALE_AFTER_DAYS = 365;

function toDate ( value: string | null | undefined ): Date | null {
  if ( !value ) return null;
  const date = new Date( value );
  return isNaN( date.getTime() ) ? null : date;
}

/** The first answer's text, falling back to the legacy single-answer fields. */
export function primaryAnswer ( item: Partial<KnowledgeItem> | null | undefined ): string {
  const first = ( item?.answers || [] ).find( ( a ) => a?.answer?.trim() );
  return String( first?.answer || item?.response || item?.answer || item?.summary || '' ).trim();
}

export function isStale ( item: Partial<KnowledgeItem>, now = new Date() ): boolean {
  const confirmed = toDate( item.updatedAt || item.createdAt );
  return !!confirmed && now.getTime() - confirmed.getTime() > STALE_AFTER_DAYS * DAY;
}

export function isNew ( item: Partial<KnowledgeItem>, now = new Date() ): boolean {
  const created = toDate( item.createdAt );
  return !!created && now.getTime() - created.getTime() < 7 * DAY;
}

/** "Added today", "Confirmed Aug 2026", "14 months old". */
export function freshnessLabel ( item: Partial<KnowledgeItem>, now = new Date() ): string {
  const created = toDate( item.createdAt );
  const confirmed = toDate( item.updatedAt || item.createdAt );
  if ( !confirmed ) return '';
  if ( created && created.toDateString() === now.toDateString() ) return 'Added today';
  if ( isStale( item, now ) ) {
    const months = Math.floor( ( now.getTime() - confirmed.getTime() ) / ( 30.44 * DAY ) );
    return `${ months } months old`;
  }
  return `Confirmed ${ confirmed.toLocaleDateString( 'en-US', { month: 'short', year: 'numeric' } ) }`;
}

/** "Used in 3 proposals", or '' when none have. */
export function usedInLabel ( item: Partial<KnowledgeItem> ): string {
  const n = ( item.usedInProposals || [] ).length;
  return n ? `Used in ${ n } ${ n === 1 ? 'proposal' : 'proposals' }` : '';
}

/** The small tag on a card: New, Still true?, Draft, or via Find. */
export function knowledgeTag ( item: Partial<KnowledgeItem>, now = new Date() ): { label: string; tint: string } | null {
  if ( item.status === 'draft' ) return { label: 'Draft', tint: 'yellow' };
  if ( isStale( item, now ) ) return { label: 'Still true?', tint: 'yellow' };
  if ( isNew( item, now ) ) return { label: item.origin?.proposalTitle ? `New · from the ${ item.origin.agency || item.origin.proposalTitle } draft` : 'New', tint: 'blue' };
  if ( item.type === 'bookmark' ) return { label: 'via Find', tint: 'cyan' };
  return null;
}

export function knowledgeMatches ( item: Partial<KnowledgeItem>, term: string ): boolean {
  const q = String( term || '' ).trim().toLowerCase();
  if ( !q ) return true;
  const has = ( value?: string | null ) => String( value || '' ).toLowerCase().includes( q );
  return has( item.question ) || has( primaryAnswer( item ) ) || has( item.category )
    || ( item.answers || [] ).some( ( a ) => has( a.answer ) || has( a.source ) )
    || ( item.recommendations || [] ).some( ( r ) => has( r.text ) || has( r.type ) )
    || ( item.keywords || [] ).some( has );
}

export function domainOf ( url: string | null | undefined ): string {
  try { return new URL( String( url ) ).hostname.replace( /^www\./, '' ); } catch { return String( url || '' ); }
}

/** "w3.org/TR/WCAG21": the link without scheme or www. */
export function shortLink ( url: string | null | undefined ): string {
  return String( url || '' ).replace( /^https?:\/\/(www\.)?/, '' ).replace( /\/$/, '' );
}

export function recommendationTint ( type: string | null | undefined ): string {
  const value = String( type || '' ).toLowerCase();
  if ( value === 'practice' ) return 'green';
  if ( value === 'policy' ) return 'violet';
  if ( value === 'resource' ) return 'cyan';
  return 'grey';
}

/** Coerces an API record so templates never trip over a missing array. */
export function normalizeKnowledge ( raw: any ): KnowledgeItem {
  return {
    ...raw,
    id: String( raw?.id || '' ),
    question: String( raw?.question || raw?.title || '' ),
    answers: Array.isArray( raw?.answers ) ? raw.answers : [],
    keywords: Array.isArray( raw?.keywords ) ? raw.keywords : [],
    recommendations: Array.isArray( raw?.recommendations ) ? raw.recommendations : [],
    resources: Array.isArray( raw?.resources ) ? raw.resources.filter( ( r: any ) => r?.link ) : [],
    usedInProposals: Array.isArray( raw?.usedInProposals ) ? raw.usedInProposals : [],
  };
}
