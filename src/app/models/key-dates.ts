import { KeyDate, KeyDates, Opportunity } from './opportunity';

/**
 * The opportunity's dates as one line (design_handoff_todd_docs_lifecycle
 * 1f/1g): the RFP's dates, addenda, and the proposal's own due date, in
 * order, with what's past, what's next and what's to come; the next
 * deadline for the banner and the cards; and a calendar file for it.
 */
export interface TimelineItem extends KeyDate {
  state: 'past' | 'next' | 'later';
}

/** The deadlines a bidder acts on: the banner and the cards show the next one. */
const DEADLINES = new Set( ['questions_due', 'prebid', 'site_visit', 'proposal_due'] );
const DAY = 86400000;

/** A bare date is that whole local day; a date-time is that moment. */
export function whenOf ( date: string, endOfDay = true ): Date | null {
  if ( !date ) return null;
  const at = /^\d{4}-\d{2}-\d{2}$/.test( date ) ? new Date( `${ date }T${ endOfDay ? '23:59:00' : '00:00:00' }` ) : new Date( date );
  return isNaN( at.getTime() ) ? null : at;
}

export function hasTime ( date: string ): boolean {
  return /T\d{2}:\d{2}/.test( date );
}

export function keyDatesOf ( o: Pick<Opportunity, 'keyDates' | 'rfpDocumentId'> ): KeyDates {
  return o.keyDates || { status: o.rfpDocumentId ? 'unchecked' : 'no_rfp', items: [], questionsTo: '', questionsVia: 'unknown', checkedAt: '' };
}

export function timeline ( o: Pick<Opportunity, 'keyDates' | 'rfpDocumentId' | 'dueDate' | 'dueDateBefore'>, now = new Date() ): TimelineItem[] {
  const items: KeyDate[] = [...keyDatesOf( o ).items];
  if ( o.dueDate ) items.push( { id: 'proposal_due', kind: 'other', label: 'Proposal due', date: o.dueDate, where: '', source: 'rfp', previousDate: o.dueDateBefore || '' } );
  const dated = items
      .map( ( item ) => ( { item, at: whenOf( item.date ) } ) )
      .filter( ( x ): x is { item: KeyDate; at: Date } => !!x.at )
      .sort( ( a, b ) => a.at.getTime() - b.at.getTime() );
  let nextFound = false;
  return dated.map( ( { item, at } ) => {
    // Addenda are things that happened; the next step is a date to act on.
    if ( at.getTime() < now.getTime() || item.kind === 'addendum' ) return { ...item, state: 'past' as const };
    if ( !nextFound ) {
      nextFound = true;
      return { ...item, state: 'next' as const };
    }
    return { ...item, state: 'later' as const };
  } );
}

export interface Deadline {
  item: KeyDate;
  at: Date;
  days: number;
}

/** The next deadline to act on: questions, a meeting, or the proposal itself. */
export function nextDeadline ( o: Pick<Opportunity, 'keyDates' | 'rfpDocumentId' | 'dueDate' | 'dueDateBefore'>, now = new Date() ): Deadline | null {
  for ( const item of timeline( o, now ) ) {
    if ( item.state === 'past' ) continue;
    const kind = item.id === 'proposal_due' ? 'proposal_due' : item.kind;
    if ( !DEADLINES.has( kind ) ) continue;
    const at = whenOf( item.date )!;
    const start = ( d: Date ) => new Date( d.getFullYear(), d.getMonth(), d.getDate() ).getTime();
    return { item, at, days: Math.round( ( start( at ) - start( now ) ) / DAY ) };
  }
  return null;
}

/** "Questions due in 2 days", "Pre-bid meeting tomorrow", "Proposal due today". */
export function deadlineHeadline ( d: Deadline ): string {
  const label = d.item.label;
  if ( d.days <= 0 ) return `${ label } today`;
  if ( d.days === 1 ) return `${ label } tomorrow`;
  return `${ label } in ${ d.days } days`;
}

/** "Thursday, Oct 16 at 5:00 PM PDT", or "Thursday, Oct 16". */
export function longDate ( date: string ): string {
  const at = whenOf( date );
  if ( !at ) return '';
  const day = at.toLocaleDateString( 'en-US', { weekday: 'long', month: 'short', day: 'numeric' } );
  if ( !hasTime( date ) ) return day;
  return `${ day } at ${ at.toLocaleTimeString( 'en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' } ) }`;
}

/** "Oct 16 · 5 PM", or "Oct 16". */
export function shortDate ( date: string ): string {
  const at = whenOf( date );
  if ( !at ) return '';
  const day = at.toLocaleDateString( 'en-US', { month: 'short', day: 'numeric' } );
  if ( !hasTime( date ) ) return day;
  const time = at.toLocaleTimeString( 'en-US', { hour: 'numeric', minute: '2-digit' } ).replace( ':00', '' );
  return `${ day } · ${ time }`;
}

/** The cards' date chip (1h): yellow inside 3 days, pink for a proposal due inside 2, else plain. */
export function dateChip ( o: Pick<Opportunity, 'keyDates' | 'rfpDocumentId' | 'dueDate' | 'dueDateBefore' | 'status'>, now = new Date() ): { text: string; tint: 'yellow' | 'pink' | 'plain' } | null {
  if ( !['new', 'drafting'].includes( o.status ) ) return null;
  const d = nextDeadline( o, now );
  if ( !d ) return null;
  const proposal = d.item.id === 'proposal_due';
  const short = proposal ? 'Due' : d.item.kind === 'prebid' ? 'Pre-bid' : d.item.kind === 'site_visit' ? 'Site visit' : d.item.label;
  const day = d.at.toLocaleDateString( 'en-US', { month: 'short', day: 'numeric' } );
  if ( proposal && d.days <= 2 ) return { text: d.days <= 0 ? 'Due today' : `Due ${ day }`, tint: 'pink' };
  if ( d.days <= 3 ) return { text: d.days <= 0 ? `${ short } today` : d.days === 1 ? `${ short } tomorrow` : `${ short } in ${ d.days } days`, tint: 'yellow' };
  return { text: `${ short } ${ day }`, tint: 'plain' };
}

function icsDate ( at: Date ): string {
  return at.toISOString().replace( /[-:]/g, '' ).replace( /\.\d{3}/, '' );
}

function icsText ( value: string ): string {
  return value.replace( /\\/g, '\\\\' ).replace( /\n/g, '\\n' ).replace( /([,;])/g, '\\$1' );
}

/** Add to calendar: a one-event .ics. Timed events last 30 minutes; a bare date is an all-day event. */
export function buildIcs ( event: { uid: string; title: string; date: string; where?: string; description?: string }, now = new Date() ): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TODD Docs//Key dates//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${ event.uid }@todd-docs`, `DTSTAMP:${ icsDate( now ) }`];
  if ( hasTime( event.date ) ) {
    const start = whenOf( event.date )!;
    lines.push( `DTSTART:${ icsDate( start ) }`, `DTEND:${ icsDate( new Date( start.getTime() + 30 * 60000 ) ) }` );
  } else {
    const day = event.date.replace( /-/g, '' );
    const next = new Date( `${ event.date }T12:00:00Z` );
    next.setUTCDate( next.getUTCDate() + 1 );
    lines.push( `DTSTART;VALUE=DATE:${ day }`, `DTEND;VALUE=DATE:${ next.toISOString().slice( 0, 10 ).replace( /-/g, '' ) }` );
  }
  lines.push( `SUMMARY:${ icsText( event.title ) }` );
  if ( event.where ) lines.push( `LOCATION:${ icsText( event.where ) }` );
  if ( event.description ) lines.push( `DESCRIPTION:${ icsText( event.description ) }` );
  lines.push( 'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${ icsText( event.title ) }`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR' );
  return lines.join( '\r\n' ) + '\r\n';
}
