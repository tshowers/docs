import { debriefDraft, postHistory, postNeeds, stageTiles } from './after-submittal';

const NOW = new Date( '2026-11-03T17:00:00Z' );
const base = ( post: any = {}, changes: any = {} ): any => ( {
  id: 'o1', title: 'Parks Reservations App', agency: 'City of Everett', solicitationNumber: 'RFP 26-09', status: 'submitted', rfpDocumentId: 'r',
  submission: { method: 'email', email: 'purchasing@everettwa.gov' },
  submissionRecord: { method: 'email', to: 'purchasing@everettwa.gov', from: 'tyrone@taliferro.com', submittedAt: '2026-10-24T20:48:00Z' },
  keyDates: { status: 'done', items: [{ id: 'd1', kind: 'expected_award', label: 'Expected award', date: '2026-11-20', where: '', source: 'rfp', previousDate: '' }], questionsTo: '', questionsVia: 'email', checkedAt: '' },
  post: { clarifications: [], orals: null, outcome: null, debrief: null, savedSections: [], ...post },
  ...changes,
} );
const clar = { id: 'c1', question: 'Is hosting included?', askedAt: '2026-10-29T16:00:00Z', source: 'inbox', answer: 'Yes.', draftedAt: '', sentAt: '2026-10-30T16:00:00Z', sentTo: 'x', sentFrom: 'y' };
const orals = { date: '2026-11-06T18:00:00Z', attendees: ['Tyrone Showers', 'Dana Lee'], place: 'Everett City Hall', minutes: 45, prep: null };

describe( 'after submittal', () => {
  it( 'opens the current stage: orals ahead after an answered clarification', () => {
    const tiles = stageTiles( base( { clarifications: [clar], orals } ), NOW );
    expect( tiles.map( ( t ) => [t.label, t.state] ) ).toEqual( [['Submitted', 'done'], ['Clarification', 'done'], ['Oral presentation', 'current'], ['Award', 'next'], ['Won / Lost', 'next']] );
    expect( tiles[0].detail ).toBe( 'Oct 24' );
    expect( tiles[3].detail ).toBe( 'Expected Nov 20' );
  } );

  it( 'waits on an unanswered question, then the award, then shows the outcome', () => {
    expect( stageTiles( base( { clarifications: [{ ...clar, sentAt: '' }] } ), NOW ).find( ( t ) => t.state === 'current' )!.key ).toBe( 'clarification' );
    expect( stageTiles( base( { orals: { ...orals, date: '2026-11-01T18:00:00Z' } } ), NOW ).find( ( t ) => t.state === 'current' )!.key ).toBe( 'award' );
    const lost = stageTiles( base( { outcome: { result: 'lost', reason: 'Experience', at: '2026-11-20T18:00:00Z' } } ), NOW );
    expect( lost[4] ).toEqual( { key: 'outcome', label: 'Lost', detail: 'Experience', state: 'current' } );
  } );

  it( 'lists what happened, newest first', () => {
    const h = postHistory( base( { clarifications: [clar], orals, outcome: { result: 'lost', reason: 'Experience', at: '2026-11-20T18:00:00Z' } } ) );
    expect( h.map( ( x ) => x.title ) ).toEqual( ['Lost', 'Oral presentation', 'Clarification', 'Submitted'] );
    expect( h[3].detail ).toBe( 'Sent as PDF from tyrone@taliferro.com to purchasing@everettwa.gov.' );
    expect( h[2].detail ).toBe( 'Yes.' );
  } );

  it( 'tells Home what needs you', () => {
    expect( postNeeds( base( { clarifications: [{ ...clar, sentAt: '' }], orals } ), NOW ).map( ( n ) => n.text ) ).toEqual( ['City of Everett asked a clarification question', 'Oral presentation for City of Everett in 3 days'] );
    const waiting = base( { outcome: { result: 'lost', reason: '', at: '' }, debrief: { to: 'x', subject: '', sentAt: '2026-10-20T00:00:00Z', sentFrom: '', remindAt: '2026-10-27T00:00:00Z', repliedAt: '' } }, { status: 'lost' } );
    expect( postNeeds( waiting, NOW ).map( ( n ) => n.action ) ).toEqual( ['Follow up'] );
    expect( postNeeds( base( {}, { status: 'drafting' } ), NOW ) ).toEqual( [] );
  } );

  it( 'drafts the debrief request to the procurement contact', () => {
    expect( debriefDraft( base(), 'Taliferro Tech' ) ).toEqual( {
      to: 'purchasing@everettwa.gov',
      subject: 'Debrief request: RFP 26-09 Parks Reservations App',
      body: 'Thank you for considering Taliferro Tech. Could we schedule a 20-minute debrief on how our proposal was evaluated? We\'d value your feedback on where it fell short.',
    } );
  } );
} );
