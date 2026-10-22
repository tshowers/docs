/**
 * The evaluator score-check (design_handoff_todd_docs_lifecycle D) as the
 * API returns it (todd-backend docs/proposals/scoreCheck.service.js), and
 * the small rules the screens share: bar colours, fixes ranked by points.
 */
export interface ScoreRevision {
  sectionKey: string;
  /** The paragraph it rewrites, or -1 when it adds one. */
  blockIndex: number;
  oldText: string;
  text: string;
  gain: number;
  at: string;
}

export interface ScoreCriterion {
  id: string;
  name: string;
  points: number;
  max: number;
  why: string;
  fix: string;
  gain: number;
  sectionKey: string;
  revision: ScoreRevision | null;
  fixed?: boolean;
}

export interface ScoreOpening {
  ok: boolean;
  note: string;
  fix: string;
  sectionKey: string;
  revision: ScoreRevision | null;
  fixed?: boolean;
}

export interface ScoreCheck {
  status: 'none' | 'done' | 'no_criteria';
  total: number;
  max: number;
  criteria: ScoreCriterion[];
  opening: ScoreOpening | null;
  ranAt: string;
  /** The draft changed since it ran. */
  stale: boolean;
}

/** One thing to fix, from a criterion or the opening check. */
export interface ScoreFix {
  id: string;
  title: string;
  fix: string;
  gain: number;
  sectionKey: string;
  revision: ScoreRevision | null;
}

/** Bars: green at 80% or more, yellow at 65-79%, pink below. */
export function scoreTint ( points: number, max: number ): 'green' | 'yellow' | 'pink' {
  const share = max ? points / max : 0;
  if ( share >= 0.8 ) return 'green';
  if ( share >= 0.65 ) return 'yellow';
  return 'pink';
}

/** Biggest gains first (1j); the opening check, which has no points of its own, last. */
export function rankedFixes ( check: ScoreCheck | null ): ScoreFix[] {
  if ( !check || check.status !== 'done' ) return [];
  const fixes: ScoreFix[] = check.criteria
      .filter( ( c ) => c.fix && !c.fixed )
      .map( ( c ) => ( { id: c.id, title: c.fix, fix: c.fix, gain: c.gain, sectionKey: c.sectionKey, revision: c.revision } ) )
      .sort( ( a, b ) => b.gain - a.gain );
  const o = check.opening;
  if ( o && !o.ok && o.fix && !o.fixed ) fixes.push( { id: 'opening', title: o.fix, fix: o.fix, gain: 0, sectionKey: o.sectionKey, revision: o.revision } );
  return fixes;
}

/** "Doing all four brings it to about 85." */
export function projectedTotal ( check: ScoreCheck | null ): number {
  if ( !check ) return 0;
  return Math.min( check.max, check.total + rankedFixes( check ).reduce( ( sum, f ) => sum + f.gain, 0 ) );
}

/** Points by section for the editor's list: "6/10", summed when a section answers several criteria. */
export function pointsBySection ( check: ScoreCheck | null ): Map<string, { points: number; max: number }> {
  const map = new Map<string, { points: number; max: number }>();
  for ( const c of check?.status === 'done' ? check.criteria : [] ) {
    if ( !c.sectionKey ) continue;
    const before = map.get( c.sectionKey ) || { points: 0, max: 0 };
    map.set( c.sectionKey, { points: before.points + c.points, max: before.max + c.max } );
  }
  return map;
}

/** "4 min ago", "just now", "Oct 21". */
export function ranAgo ( iso: string, now = new Date() ): string {
  const at = new Date( iso );
  if ( !iso || isNaN( at.getTime() ) ) return '';
  const minutes = Math.round( ( now.getTime() - at.getTime() ) / 60000 );
  if ( minutes < 1 ) return 'just now';
  if ( minutes < 60 ) return `${ minutes } min ago`;
  if ( minutes < 24 * 60 ) return `${ Math.round( minutes / 60 ) } h ago`;
  return at.toLocaleDateString( 'en-US', { month: 'short', day: 'numeric' } );
}
