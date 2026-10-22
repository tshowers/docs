import { ScoreCheck, pointsBySection, projectedTotal, ranAgo, rankedFixes, scoreTint } from './score-check';

const check = ( changes: Partial<ScoreCheck> = {} ): ScoreCheck => ( {
  status: 'done', total: 71, max: 100, ranAt: '2026-10-22T18:00:00Z', stale: false,
  criteria: [
    { id: 'c1', name: 'Technical approach', points: 18, max: 30, why: '', fix: 'Add a migration plan to section 4.', gain: 6, sectionKey: 'migration', revision: null },
    { id: 'c2', name: 'Experience', points: 20, max: 25, why: '', fix: 'Add a second public project.', gain: 3, sectionKey: 'references', revision: null },
    { id: 'c3', name: 'Price', points: 15, max: 20, why: '', fix: 'Add a year-2 support line.', gain: 2, sectionKey: 'pricing', revision: null },
    { id: 'c4', name: 'Project management', points: 12, max: 15, why: '', fix: '', gain: 0, sectionKey: 'pricing', revision: null },
    { id: 'c5', name: 'Executive summary', points: 6, max: 10, why: '', fix: 'Lead with their problem.', gain: 3, sectionKey: 'summary', revision: null, fixed: true },
  ],
  opening: { ok: false, note: 'Opens with your history.', fix: 'Lead with King County\'s problem.', sectionKey: 'summary', revision: null },
  ...changes,
} );

describe( 'score-check', () => {
  it( 'colours bars like the design', () => {
    expect( scoreTint( 26, 30 ) ).toBe( 'green' );
    expect( scoreTint( 15, 20 ) ).toBe( 'yellow' );
    expect( scoreTint( 18, 30 ) ).toBe( 'pink' );
    expect( scoreTint( 0, 0 ) ).toBe( 'pink' );
  } );

  it( 'ranks fixes by points gained, skips fixed ones, and puts the opening last', () => {
    expect( rankedFixes( check() ).map( ( f ) => [f.id, f.gain] ) ).toEqual( [['c1', 6], ['c2', 3], ['c3', 2], ['opening', 0]] );
    expect( rankedFixes( check( { status: 'no_criteria' } ) ) ).toEqual( [] );
    expect( projectedTotal( check() ) ).toBe( 82 );
    expect( projectedTotal( check( { total: 98 } ) ) ).toBe( 100 );
  } );

  it( "adds up points by section for the editor's list", () => {
    const map = pointsBySection( check() );
    expect( map.get( 'pricing' ) ).toEqual( { points: 27, max: 35 } );
    expect( map.get( 'migration' ) ).toEqual( { points: 18, max: 30 } );
  } );

  it( 'says when it ran', () => {
    const now = new Date( '2026-10-22T18:04:00Z' );
    expect( ranAgo( '2026-10-22T18:00:00Z', now ) ).toBe( '4 min ago' );
    expect( ranAgo( '2026-10-22T18:03:50Z', now ) ).toBe( 'just now' );
    expect( ranAgo( '', now ) ).toBe( '' );
  } );
} );
