import { needsYou } from './home.component';
import { routeAsk } from './home-ask';

describe( 'routeAsk', () => {
  it( 'sends links to Add an RFP, questions to Knowledge, the rest to Documents', () => {
    expect( routeAsk( 'https://portseattle.bonfirehub.com/opportunities/88213' ) ).toEqual( { kind: 'rfp-link', path: '/upload', queryParams: { rfp: '1', link: 'https://portseattle.bonfirehub.com/opportunities/88213' } } );
    expect( routeAsk( 'How do we test for accessibility?' ) ).toEqual( { kind: 'question', path: '/knowledge', queryParams: { q: 'How do we test for accessibility' } } );
    expect( routeAsk( 'insurance coverage?' )?.kind ).toBe( 'question' );
    expect( routeAsk( 'king county proposal' ) ).toEqual( { kind: 'search', path: '/documents', queryParams: { q: 'king county proposal' } } );
    expect( routeAsk( '   ' ) ).toBeNull();
  } );
} );


describe( 'needsYou', () => {
  const now = new Date( 2026, 9, 10, 9 );
  it( 'lists what needs the person, soonest first', () => {
    const items = needsYou( {
      now,
      opportunities: [
        { id: 'a', status: 'drafting', agency: 'Snohomish County', title: 'Records', dueDate: '2026-10-17' },
        { id: 'b', status: 'drafting', agency: 'King County', title: 'Permit', dueDate: '2026-10-24' },
        { id: 'c', status: 'new', agency: 'X', title: 'Y', dueDate: '2026-10-11' },
      ] as any,
      openQuestions: { b: 2 },
      documents: [{ id: 'd', type: 'document', title: 'Certificate of insurance 2026', dueDate: '2026-11-30', src: '' }],
      staleKnowledge: 1,
      failingInbox: null,
    } );
    expect( items.map( ( i ) => i.text ) ).toEqual( [
      'Snohomish County proposal is due in 7 days',
      'TODD has 2 questions for the King County draft',
      'Your Certificate of insurance 2026 expires Nov 30',
      '1 Knowledge answer is over a year old',
    ] );
  } );
} );
