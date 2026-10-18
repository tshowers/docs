/**
 * Approval before sending (design_handoff_todd_docs round 4), as
 * todd-backend docs/approvals/approval.service.js returns it. Approvers
 * review through a private link the owner shares however they like; no
 * TODD account or sign-in.
 */
export type ApprovalRule = 'all' | 'any';
export type ApprovalStatus = 'waiting' | 'changes' | 'approved' | 'bypassed' | 'sent';
/** `recheck`: approved an older version, so it doesn't count for this one. */
export type ApproverState = 'waiting' | 'reviewing' | 'approved' | 'changes' | 'recheck';

export interface ApprovalEvent { type: string; actor: string; at: string; meta: Record<string, any>; }

export interface ApprovalComment {
  id: string;
  approverId?: string;
  authorName?: string;
  sectionTitle: string;
  quote: string;
  text: string;
  /** Set for a suggested edit: what the quote becomes. */
  replacement: string | null;
  status: 'open' | 'accepted' | 'rejected';
  version: number;
  replies: { by: string; text: string; at: string }[];
  createdAt: string;
}

export interface Approver {
  id: string;
  name: string;
  email: string;
  token: string;
  state: ApproverState;
  approvedVersion: number;
  message: string;
  openedAt: string;
  decidedAt: string;
  sharedAt: string;
}

export interface ApprovalEmail { to: string; subject: string; body: string; mailboxId?: string; }

export interface ApprovalRequest {
  opportunityId: string;
  rule: ApprovalRule;
  dueAt: string;
  note: string;
  onApproved: 'notify' | 'autoSend';
  allowSuggestions: boolean;
  status: ApprovalStatus;
  version: number;
  email: ApprovalEmail;
  attachments: { documentId: string; name: string; detail: string }[];
  proposalPdfId: string;
  approvers: Approver[];
  events: ApprovalEvent[];
  bypassReason: string;
  linkExpiresAt: string;
  /** The proposal text differs from what approvers saw. */
  proposalChanged: boolean;
  comments: ApprovalComment[];
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalPayload {
  approvers: { id?: string; name: string; email: string }[];
  rule: ApprovalRule;
  dueAt: string;
  note: string;
  onApproved: 'notify' | 'autoSend';
  allowSuggestions: boolean;
  email: ApprovalEmail;
  attachments: { documentId: string; name: string; detail: string }[];
  proposalPdfId?: string;
  ownerName: string;
  company: string;
  checklist: { ok: number; total: number };
}

/** What an approver's link opens. */
export interface GuestApproval {
  readOnly: boolean;
  status: ApprovalStatus;
  ownerName: string;
  company: string;
  note: string;
  rule: ApprovalRule;
  dueAt: string;
  allowSuggestions: boolean;
  version: number;
  opportunity: { title: string; agency: string; solicitationNumber: string; dueDate: string; portalOnly: boolean };
  email: { to: string; subject: string; body: string };
  attachments: { name: string; detail: string }[];
  checklist: { ok: number; total: number };
  html: string;
  previousHtml: string;
  previousVersion: number;
  linkExpiresAt: string;
  me: { id: string; name: string; email: string; state: ApproverState; message: string; decidedAt: string };
  others: { name: string; state: ApproverState; decidedAt: string }[];
  comments: ApprovalComment[];
}

export const APPROVER_STATE: Record<ApproverState, { label: string; tint: string }> = {
  approved: { label: 'Approved', tint: 'green' },
  reviewing: { label: 'Reviewing', tint: 'blue' },
  waiting: { label: 'Waiting', tint: 'grey' },
  changes: { label: 'Changes', tint: 'pink' },
  recheck: { label: 'Will re-check', tint: 'yellow' },
};

const PERSON_TINTS = ['violet', 'pink', 'blue', 'cyan', 'green', 'yellow'];

/** A steady tint per person, so the same approver looks the same everywhere. */
export function personTint ( key: string ): string {
  let hash = 0;
  for ( const ch of String( key || '' ).toLowerCase() ) hash = ( hash * 31 + ch.charCodeAt( 0 ) ) >>> 0;
  return PERSON_TINTS[hash % PERSON_TINTS.length];
}

/** "ML" from Marcus Lee; "JP" from jordan.park@…; "J" from jordan@…. */
export function initials ( name: string, email = '' ): string {
  const words = String( name || '' ).trim().split( /\s+/ ).filter( Boolean );
  if ( words.length ) return ( words[0][0] + ( words.length > 1 ? words[words.length - 1][0] : '' ) ).toUpperCase();
  const local = String( email || '' ).split( '@' )[0].split( /[._-]+/ ).filter( Boolean );
  return ( ( local[0]?.[0] || '?' ) + ( local.length > 1 ? local[local.length - 1][0] : '' ) ).toUpperCase();
}

export function displayName ( person: { name?: string; email?: string } ): string {
  return person.name || person.email || 'Someone';
}

export function firstName ( person: { name?: string; email?: string } ): string {
  if ( person.name ) return person.name.trim().split( /\s+/ )[0];
  const local = String( person.email || '' ).split( '@' )[0];
  return local ? local.charAt( 0 ).toUpperCase() + local.slice( 1 ).split( /[._-]/ )[0] : 'them';
}

/**
 * What someone typed into "Who approves": an email, "Name <email>", or just
 * a name (for a link sent by text message).
 */
export function parseApprover ( raw: string ): { name: string; email: string } | null {
  const text = String( raw || '' ).trim().replace( /[,;]+$/, '' ).trim();
  if ( !text ) return null;
  const angled = text.match( /^(.*?)\s*<\s*([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)\s*>$/ );
  if ( angled ) return { name: angled[1].replace( /^"|"$/g, '' ).trim(), email: angled[2].toLowerCase() };
  if ( /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( text ) ) return { name: '', email: text.toLowerCase() };
  if ( text.includes( '@' ) ) return null;
  return { name: text.slice( 0, 120 ), email: '' };
}

/** The link an approver opens. */
export function approvalLink ( token: string, origin = typeof window !== 'undefined' ? window.location.origin : 'https://docs.taliferro.tech' ): string {
  return `${ origin }/approve/${ encodeURIComponent( token ) }`;
}

function atHour ( day: Date, hour: number ): Date {
  const d = new Date( day );
  d.setHours( hour, 0, 0, 0 );
  return d;
}

function previousWeekday ( day: Date, back: number ): Date {
  const d = new Date( day );
  let left = back;
  while ( left > 0 ) {
    d.setDate( d.getDate() - 1 );
    if ( d.getDay() !== 0 && d.getDay() !== 6 ) left--;
  }
  return d;
}

/**
 * Two approve-by times from the RFP due date: 5 PM three working days
 * before, and noon two working days before. Both are in the future and
 * before the deadline; without a due date, tomorrow 5 PM and the next day noon.
 */
export function suggestedApproveBy ( rfpDue: Date | null, now = new Date() ): Date[] {
  const candidates = rfpDue
    ? [atHour( previousWeekday( rfpDue, 3 ), 17 ), atHour( previousWeekday( rfpDue, 2 ), 12 ), atHour( previousWeekday( rfpDue, 1 ), 12 )]
    : [atHour( new Date( now.getTime() + 86400000 ), 17 ), atHour( new Date( now.getTime() + 2 * 86400000 ), 12 )];
  return candidates.filter( ( d ) => d.getTime() > now.getTime() && ( !rfpDue || d.getTime() < rfpDue.getTime() ) ).slice( 0, 2 );
}

/** "Wed, 5 PM", "Thu, noon". */
export function shortWhen ( value: Date | string ): string {
  const d = value instanceof Date ? value : new Date( value );
  if ( isNaN( d.getTime() ) ) return '';
  const day = d.toLocaleDateString( 'en-US', { weekday: 'short' } );
  if ( d.getHours() === 12 && d.getMinutes() === 0 ) return `${ day }, noon`;
  return `${ day }, ${ d.toLocaleTimeString( 'en-US', { hour: 'numeric', minute: d.getMinutes() ? '2-digit' : undefined } ) }`;
}

/** "Wed, Oct 21 at 5 PM". */
export function longWhen ( value: string ): string {
  const d = new Date( value );
  if ( !value || isNaN( d.getTime() ) ) return '';
  const day = d.toLocaleDateString( 'en-US', { weekday: 'short', month: 'short', day: 'numeric' } );
  return `${ day } at ${ d.toLocaleTimeString( 'en-US', { hour: 'numeric', minute: d.getMinutes() ? '2-digit' : undefined } ) }`;
}

/** "just now", "10 min ago", "2 h ago", "Oct 21". */
export function ago ( value: string, now = new Date() ): string {
  const d = new Date( value );
  if ( !value || isNaN( d.getTime() ) ) return '';
  const minutes = Math.round( ( now.getTime() - d.getTime() ) / 60000 );
  if ( minutes < 1 ) return 'just now';
  if ( minutes < 60 ) return `${ minutes } min ago`;
  if ( minutes < 24 * 60 ) return `${ Math.round( minutes / 60 ) } h ago`;
  return d.toLocaleDateString( 'en-US', { month: 'short', day: 'numeric' } );
}

function list ( names: string[] ): string {
  if ( names.length <= 1 ) return names[0] || '';
  return `${ names.slice( 0, -1 ).join( ', ' ) } and ${ names[names.length - 1] }`;
}

/** One Activity row: the sentence, an icon and a tint. */
export function describeEvent ( e: ApprovalEvent ): { text: string; icon: string; tint: string } {
  const who = e.actor || 'Someone';
  const names: string[] = Array.isArray( e.meta?.['names'] ) ? e.meta['names'] : [];
  const section = e.meta?.['section'] ? ` on ${ e.meta['section'] }` : '';
  switch ( e.type ) {
    case 'requested': return { text: `You asked ${ list( names ) } to approve`, icon: 'send', tint: 'blue' };
    case 'reasked': return { text: `You asked again for version ${ e.meta?.['version'] }${ names.length ? ` (${ list( names ) })` : '' }`, icon: 'send', tint: 'blue' };
    case 'approversAdded': return { text: `You added ${ list( names ) }`, icon: 'user', tint: 'blue' };
    case 'approversRemoved': return { text: `You removed ${ list( names ) }. Their link no longer works.`, icon: 'user', tint: 'grey' };
    case 'shared': return { text: `You sent ${ e.meta?.['name'] } their link${ e.meta?.['via'] === 'email' ? ' by email' : e.meta?.['via'] === 'message' ? ' by message' : '' }`, icon: 'link', tint: 'cyan' };
    case 'opened': return { text: `${ who } opened it`, icon: 'eye', tint: 'cyan' };
    case 'commented': return { text: `${ who } commented${ section }`, icon: 'message', tint: 'yellow' };
    case 'suggested': return { text: `${ who } suggested an edit${ section }`, icon: 'pen', tint: 'yellow' };
    case 'approved': return { text: `${ who } approved version ${ e.meta?.['version'] }`, icon: 'check', tint: 'green' };
    case 'changesRequested': return { text: `${ who } requested changes`, icon: 'alert-circle', tint: 'pink' };
    case 'editAccepted': return { text: `You accepted ${ e.meta?.['name'] || 'an' }'s edit${ section }`, icon: 'check', tint: 'green' };
    case 'editRejected': return { text: `You rejected ${ e.meta?.['name'] || 'an' }'s edit${ section }`, icon: 'x', tint: 'grey' };
    case 'replied': return { text: `You replied to ${ e.meta?.['name'] || 'a comment' }`, icon: 'message', tint: 'blue' };
    case 'bypassed': return { text: `You sent without approval: “${ e.meta?.['reason'] }”`, icon: 'alert-circle', tint: 'pink' };
    case 'autoSendFailed': return { text: `TODD couldn't send it automatically: ${ e.meta?.['message'] || 'try Send yourself' }`, icon: 'alert-circle', tint: 'pink' };
    case 'sent': return { text: e.meta?.['auto'] ? `TODD sent it to ${ e.meta?.['to'] }` : `Sent${ e.meta?.['to'] ? ` to ${ e.meta['to'] }` : '' }`, icon: 'send', tint: 'green' };
    default: return { text: `${ who }: ${ e.type }`, icon: 'info', tint: 'grey' };
  }
}

/** Headings in the proposal, for the section list. */
export function sectionsOf ( html: string ): string[] {
  const titles: string[] = [];
  const pattern = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let match: RegExpExecArray | null;
  while ( ( match = pattern.exec( String( html || '' ) ) ) ) {
    const text = match[1].replace( /<[^>]+>/g, '' ).replace( /&nbsp;/g, ' ' ).replace( /&amp;/g, '&' ).replace( /\s+/g, ' ' ).trim();
    if ( text ) titles.push( text );
  }
  return titles;
}

/** Normalized block text, so a re-check can tell which blocks changed. */
export function blockKey ( text: string ): string {
  return String( text || '' ).replace( /\s+/g, ' ' ).trim();
}

/**
 * What the owner sends with each link, from their own mail app or Messages.
 * TODD sends nothing itself.
 */
export function shareMessage ( ctx: { ownerName: string; buyer: string; dueAt: string; note: string }, approver: { name: string; email: string }, link: string ): { subject: string; body: string; sms: string } {
  const owner = ctx.ownerName || 'I';
  const buyer = ctx.buyer || 'the buyer';
  const by = ctx.dueAt ? ` by ${ longWhen( ctx.dueAt ) }` : '';
  const hi = approver.name ? `Hi ${ firstName( approver ) },` : 'Hi,';
  return {
    subject: `Can you approve our proposal to ${ buyer }?`,
    body: [
      hi,
      '',
      `Before I send our proposal to ${ buyer }, I'd like your OK${ by }.`,
      ...( ctx.note ? ['', ctx.note] : [] ),
      '',
      `Review it here: ${ link }`,
      '',
      'You don\'t need an account. The link opens only this proposal. You can approve it, request changes, or comment right there.',
      '',
      owner,
    ].join( '\n' ),
    sms: `Can you approve our proposal to ${ buyer } before I send it${ by }? ${ link }`,
  };
}
