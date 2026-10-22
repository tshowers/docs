import { dueLabel, fitTint, isOpen, mustHavesLine, mustHavesOf, stageOf } from './opportunity';
import { gateIntro } from '../features/opportunity-detail/opportunity-detail.component';

describe( 'opportunity helpers', () => {
  const now = new Date( 2026, 9, 10, 9 );

  it( 'tints match scores like the design', () => {
    expect( fitTint( 92 ) ).toBe( 'green' );
    expect( fitTint( 86 ) ).toBe( 'green' );
    expect( fitTint( 80 ) ).toBe( 'blue' );
    expect( fitTint( 71 ) ).toBe( 'yellow' );
  } );

  it( 'labels due dates in days, treating a bare date as that whole day', () => {
    expect( dueLabel( { dueDate: '2026-10-24' }, now ) ).toBe( 'Due Oct 24 · 14 days' );
    expect( dueLabel( { dueDate: '2026-10-11' }, now ) ).toBe( 'Due Oct 11 · 1 day' );
    expect( dueLabel( { dueDate: '2026-10-10' }, now ) ).toBe( 'Due today' );
    expect( dueLabel( { dueDate: '2026-10-02' }, now ) ).toBe( 'Closed Oct 2' );
    expect( dueLabel( { dueDate: '' }, now ) ).toBe( '' );
    expect( isOpen( { dueDate: '2026-10-10' } as any, now ) ).toBeTrue();
    expect( isOpen( { dueDate: '2026-10-02' } as any, now ) ).toBeFalse();
  } );

  it( 'falls back to a stage from the status when the API has none', () => {
    expect( stageOf( { status: 'new', stage: 'qualifying' } ) ).toBe( 'qualifying' );
    expect( stageOf( { status: 'new' } ) ).toBe( 'found' );
    expect( stageOf( { status: 'dismissed' } ) ).toBe( 'no_bid' );
    expect( stageOf( { status: 'submitted' } ) ).toBe( 'submitted' );
    expect( mustHavesOf( { rfpDocumentId: '' } ).status ).toBe( 'no_rfp' );
    expect( mustHavesOf( { rfpDocumentId: 'r1' } ).status ).toBe( 'unchecked' );
  } );

  it( 'sums up the must-haves on a card', () => {
    const card = ( status: string, summary = { total: 0, met: 0, notMet: 0, unknown: 0 } ) => ( { rfpDocumentId: 'r1', mustHaves: { status, items: [], checkedAt: '', summary } } as any );
    expect( mustHavesLine( card( 'checking' ) ) ).toEqual( { text: 'Checking must-haves…', state: 'waiting' } );
    expect( mustHavesLine( card( 'done', { total: 6, met: 3, notMet: 2, unknown: 1 } ) ) ).toEqual( { text: '2 must-haves missing', state: 'not_met' } );
    expect( mustHavesLine( card( 'done', { total: 6, met: 5, notMet: 0, unknown: 1 } ) ) ).toEqual( { text: '1 must-have to confirm', state: 'unknown' } );
    expect( mustHavesLine( card( 'done', { total: 6, met: 6, notMet: 0, unknown: 0 } ) ) ).toEqual( { text: 'All must-haves met', state: 'met' } );
    expect( mustHavesLine( card( 'done' ) ) ).toBeNull();
    expect( mustHavesLine( card( 'failed' ) ) ).toBeNull();
  } );

  it( 'says what would disqualify you, like the design', () => {
    expect( gateIntro( { total: 6, notMet: 2, unknown: 1 } ) ).toBe( 'Two of these would get you disqualified, whatever the score. One I can\'t tell yet.' );
    expect( gateIntro( { total: 1, notMet: 1, unknown: 0 } ) ).toBe( 'This one would get you disqualified, whatever the score.' );
    expect( gateIntro( { total: 4, notMet: 0, unknown: 2 } ) ).toBe( 'Nothing here disqualifies you so far. Two I can\'t tell yet.' );
    expect( gateIntro( { total: 6, notMet: 0, unknown: 0 } ) ).toBe( 'All 6 met. Nothing here would disqualify you.' );
  } );
} );
