import { buildIcs, dateChip, deadlineHeadline, nextDeadline, shortDate, timeline } from './key-dates';
import { questionsForPortal } from '../features/opportunity-detail/opportunity-dates.component';
import { needsYou } from '../features/home/home.component';

const NOW = new Date( 2026, 9, 14, 9 );

const opp = ( changes: any = {} ): any => ( {
  id: 'o1', title: 'Permit Portal Modernization', agency: 'King County', status: 'drafting', rfpDocumentId: 'rfp',
  dueDate: '2026-10-24', dueDateBefore: '',
  keyDates: { status: 'done', questionsTo: 'procurement@kingcounty.gov', questionsVia: 'email', checkedAt: '', items: [
    { id: 'd1', kind: 'addendum', label: 'Addendum 1', date: '2026-10-08', where: '', source: 'addendum', previousDate: '' },
    { id: 'd2', kind: 'prebid', label: 'Pre-bid meeting', date: '2026-10-13', where: 'online', source: 'rfp', previousDate: '' },
    { id: 'd3', kind: 'questions_due', label: 'Questions due', date: '2026-10-16', where: '', source: 'rfp', previousDate: '' },
    { id: 'd4', kind: 'expected_award', label: 'Expected award', date: '2026-11-20', where: '', source: 'rfp', previousDate: '' },
  ] },
  ...changes,
} );

describe( 'key dates', () => {
  it( 'puts the dates and the proposal due date in order: past, next, later', () => {
    expect( timeline( opp(), NOW ).map( ( d ) => [d.label, d.state] ) ).toEqual( [
      ['Addendum 1', 'past'], ['Pre-bid meeting', 'past'], ['Questions due', 'next'], ['Proposal due', 'later'], ['Expected award', 'later'],
    ] );
  } );

  it( 'finds the next deadline to act on, and says it like the design', () => {
    const d = nextDeadline( opp(), NOW )!;
    expect( d.item.label ).toBe( 'Questions due' );
    expect( d.days ).toBe( 2 );
    expect( deadlineHeadline( d ) ).toBe( 'Questions due in 2 days' );
    expect( deadlineHeadline( { ...d, days: 1 } ) ).toBe( 'Questions due tomorrow' );
    // After questions close, the proposal is next; an award date isn't a deadline.
    expect( nextDeadline( opp(), new Date( 2026, 9, 20 ) )!.item.label ).toBe( 'Proposal due' );
    expect( nextDeadline( opp(), new Date( 2026, 10, 1 ) ) ).toBeNull();
  } );

  it( "colours the cards' chip by how soon it is", () => {
    expect( dateChip( opp(), NOW ) ).toEqual( { text: 'Questions due in 2 days', tint: 'yellow' } );
    expect( dateChip( opp(), new Date( 2026, 9, 17 ) ) ).toEqual( { text: 'Due Oct 24', tint: 'plain' } );
    expect( dateChip( opp(), new Date( 2026, 9, 23 ) ) ).toEqual( { text: 'Due Oct 24', tint: 'pink' } );
    expect( dateChip( opp( { status: 'submitted' } ), NOW ) ).toBeNull();
  } );

  it( 'shows a moved due date with the old one', () => {
    const moved = timeline( opp( { dueDate: '2026-10-31', dueDateBefore: '2026-10-24' } ), NOW ).find( ( d ) => d.id === 'proposal_due' )!;
    expect( moved.previousDate ).toBe( '2026-10-24' );
    expect( shortDate( '2026-10-31' ) ).toBe( 'Oct 31' );
  } );

  it( 'builds a calendar file: timed for a time, all-day for a date', () => {
    const timed = buildIcs( { uid: 'o1-d3', title: 'Questions due: Permit Portal', date: '2026-10-16T17:00:00-07:00', description: 'Send to a@b.gov; c' }, new Date( '2026-10-14T00:00:00Z' ) );
    expect( timed ).toContain( 'DTSTART:20261017T000000Z' );
    expect( timed ).toContain( 'DTEND:20261017T003000Z' );
    expect( timed ).toContain( 'DESCRIPTION:Send to a@b.gov\\; c' );
    expect( timed ).toContain( 'TRIGGER:-P1D' );
    const allDay = buildIcs( { uid: 'x', title: 'Award', date: '2026-11-20' } );
    expect( allDay ).toContain( 'DTSTART;VALUE=DATE:20261120' );
    expect( allDay ).toContain( 'DTEND;VALUE=DATE:20261121' );
  } );

  it( 'copies the picked questions for a portal', () => {
    expect( questionsForPortal( [{ text: 'How many records?', ref: '4.1' }, { text: 'Budget?', ref: '' }] ) ).toBe( '1. (Section 4.1) How many records?\n2. Budget?' );
  } );

  it( "puts a new addendum and closing questions in Home's Needs you", () => {
    const items = needsYou( { opportunities: [opp( { unreadUpdates: 1, buyerQuestions: { items: [], sent: null } } )], openQuestions: {}, documents: [], staleKnowledge: 0, failingInbox: null, now: NOW } );
    expect( items.map( ( i ) => i.text ).slice( 0, 2 ) ).toEqual( ['New addendum for King County', 'Questions for King County are due in 2 days'] );
    const sent = needsYou( { opportunities: [opp( { buyerQuestions: { items: [], sent: { at: '', to: 'x', from: '', count: 1, messageId: '' } } } )], openQuestions: {}, documents: [], staleKnowledge: 0, failingInbox: null, now: NOW } );
    expect( sent.some( ( i ) => i.key.startsWith( 'qd-' ) ) ).toBeFalse();
  } );
} );
