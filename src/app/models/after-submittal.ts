import { keyDatesOf, shortDate, whenOf } from './key-dates';
import { Opportunity, PostSubmittal } from './opportunity';

/**
 * After submittal (design_handoff_todd_docs_lifecycle E, 1k/1l/1s): the five
 * stage tiles, the history newest first, and what needs the owner.
 */
export function postOf ( o: Pick<Opportunity, 'post'> ): PostSubmittal {
  return o.post || { clarifications: [], orals: null, outcome: null, debrief: null, savedSections: [] };
}

export interface StageTile {
  key: 'submitted' | 'clarification' | 'orals' | 'award' | 'outcome';
  label: string;
  detail: string;
  state: 'done' | 'current' | 'next';
}

/** "Oct 24". */
function day ( iso: string ): string {
  return whenOf( iso )?.toLocaleDateString( 'en-US', { month: 'short', day: 'numeric' } ) || '';
}

/** Submitted → Clarification → Oral presentation → Award → Won / Lost, with the current one open. */
export function stageTiles ( o: Opportunity, now = new Date() ): StageTile[] {
  const post = postOf( o );
  const submittedAt = o.submissionRecord?.submittedAt || '';
  const clar = post.clarifications;
  const oralsAt = post.orals ? whenOf( post.orals.date ) : null;
  const award = keyDatesOf( o ).items.find( ( d ) => d.kind === 'expected_award' );
  const outcome = post.outcome;
  const clarOpen = clar.some( ( c ) => !c.sentAt );
  const oralsAhead = !!oralsAt && oralsAt.getTime() >= now.getTime();

  let current: StageTile['key'] = 'submitted';
  if ( outcome ) current = 'outcome';
  else if ( clarOpen ) current = 'clarification';
  else if ( oralsAhead ) current = 'orals';
  else if ( oralsAt || clar.length ) current = 'award';
  const order: StageTile['key'][] = ['submitted', 'clarification', 'orals', 'award', 'outcome'];
  const at = order.indexOf( current );
  const state = ( key: StageTile['key'] ): StageTile['state'] => {
    const i = order.indexOf( key );
    if ( key === 'outcome' && outcome ) return 'current';
    return i < at ? 'done' : i === at ? 'current' : 'next';
  };
  const outcomeLabel = outcome ? ( outcome.result === 'won' ? 'Won' : outcome.result === 'lost' ? 'Lost' : 'Cancelled' ) : 'Won / Lost';
  return [
    { key: 'submitted', label: 'Submitted', detail: day( submittedAt ), state: state( 'submitted' ) },
    { key: 'clarification', label: 'Clarification', detail: clar.length ? day( clar[0].askedAt ) : ( at > 1 ? 'None asked' : '' ), state: state( 'clarification' ) },
    { key: 'orals', label: 'Oral presentation', detail: post.orals ? day( post.orals.date ) : ( at > 2 ? 'None' : '' ), state: state( 'orals' ) },
    { key: 'award', label: 'Award', detail: outcome ? day( outcome.at ) : award ? `Expected ${ day( award.date ) }` : '', state: state( 'award' ) },
    { key: 'outcome', label: outcomeLabel, detail: outcome?.reason || ( outcome ? '' : '—' ), state: state( 'outcome' ) },
  ];
}

export interface HistoryItem {
  key: string;
  title: string;
  when: string;
  detail: string;
}

/** Every stage with its date and a note, newest first (1l). */
export function postHistory ( o: Opportunity ): HistoryItem[] {
  const post = postOf( o );
  const items: ( HistoryItem & { at: string } )[] = [];
  const s = o.submissionRecord;
  if ( s?.submittedAt ) {
    items.push( { key: 'submitted', title: 'Submitted', at: s.submittedAt, when: shortDate( s.submittedAt ), detail: s.method === 'portal' ? 'Submitted on the portal.' : `Sent as PDF${ s.from ? ` from ${ s.from }` : '' }${ s.to ? ` to ${ s.to }` : '' }.` } );
  }
  for ( const c of post.clarifications ) {
    items.push( { key: c.id, title: 'Clarification', at: c.askedAt, when: `${ shortDate( c.askedAt ) }${ c.sentAt ? ` → answered ${ shortDate( c.sentAt ) }` : '' }`, detail: c.sentAt ? c.answer : `Asked: ${ c.question }` } );
  }
  if ( post.orals ) {
    const people = post.orals.attendees.length ? `${ post.orals.attendees.join( ' and ' ) }${ whenOf( post.orals.date )!.getTime() < Date.now() ? ' presented.' : ' presenting.' }` : '';
    items.push( { key: 'orals', title: 'Oral presentation', at: post.orals.date, when: shortDate( post.orals.date ), detail: [people, post.orals.prep ? 'Prep sheet ready.' : ''].filter( Boolean ).join( ' ' ) } );
  }
  if ( post.outcome ) {
    const r = post.outcome;
    items.push( { key: 'outcome', title: r.result === 'won' ? 'Won' : r.result === 'lost' ? 'Lost' : 'Cancelled', at: r.at, when: shortDate( r.at ), detail: r.reason ? `Why: ${ r.reason }.` : '' } );
  }
  if ( post.debrief?.sentAt ) {
    const d = post.debrief;
    items.push( { key: 'debrief', title: 'Debrief requested', at: d.sentAt, when: shortDate( d.sentAt ), detail: d.repliedAt ? 'They replied.' : `Sent to ${ d.to }.` } );
  }
  return items.sort( ( a, b ) => b.at.localeCompare( a.at ) ).map( ( { at: _at, ...item } ) => item );
}

/** For Home's Needs you: a question to answer, orals coming up, a debrief with no reply. */
export function postNeeds ( o: Opportunity, now = new Date() ): { key: string; text: string; action: string; urgency: number }[] {
  if ( !['submitted', 'won', 'lost'].includes( o.status ) ) return [];
  const post = postOf( o );
  const name = o.agency || o.title;
  const out: { key: string; text: string; action: string; urgency: number }[] = [];
  const open = post.clarifications.filter( ( c ) => !c.sentAt ).length;
  if ( open ) out.push( { key: `cl-${ o.id }`, text: `${ name } asked ${ open === 1 ? 'a clarification question' : `${ open } clarification questions` }`, action: 'Answer', urgency: 0 } );
  const oralsAt = post.orals ? whenOf( post.orals.date ) : null;
  if ( oralsAt && !post.outcome ) {
    const days = Math.round( ( oralsAt.getTime() - now.getTime() ) / 86400000 );
    if ( days >= 0 && days <= 3 ) out.push( { key: `or-${ o.id }`, text: `Oral presentation for ${ name } ${ days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${ days } days` }`, action: 'Prep', urgency: days } );
  }
  const d = post.debrief;
  if ( d?.sentAt && !d.repliedAt && d.remindAt && new Date( d.remindAt ).getTime() <= now.getTime() ) {
    out.push( { key: `db-${ o.id }`, text: `No reply yet to your debrief request for ${ name }`, action: 'Follow up', urgency: 5 } );
  }
  return out;
}

/** What the debrief request says before the owner edits it. */
export function debriefDraft ( o: Pick<Opportunity, 'solicitationNumber' | 'title' | 'submission' | 'keyDates' | 'rfpDocumentId' | 'submissionRecord'>, company: string ): { to: string; subject: string; body: string } {
  const title = [o.solicitationNumber, o.title].filter( Boolean ).join( ' ' );
  const to = [o.submission.email, keyDatesOf( o ).questionsTo, o.submissionRecord?.to].find( ( x ) => !!x && /@/.test( x ) ) || '';
  return {
    to,
    subject: `Debrief request: ${ title }`,
    body: `Thank you for considering ${ company || 'our proposal' }. Could we schedule a 20-minute debrief on how our proposal was evaluated? We'd value your feedback on where it fell short.`,
  };
}
