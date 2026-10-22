import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';

import { ScoreCheck, pointsBySection, projectedTotal, ranAgo, rankedFixes, scoreTint } from '../../models/score-check';
import { DkIconComponent } from '../dk-icon/dk-icon.component';
import { WriteActionDirective } from '../write-access/write-action.directive';

/**
 * TODD's score-check card (design_handoff_todd_docs_lifecycle 1i, 1j, 1r):
 * "About 71 of 100", an estimate against the RFP's own points. On Review &
 * send each criterion shows its bar, why and the fix; in the editor the
 * fixes are ranked by points gained with the projected total. Fix this and
 * Run again go to whoever hosts it.
 */
@Component( {
  selector: 'app-score-check',
  standalone: true,
  imports: [CommonModule, DkIconComponent, WriteActionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './score-check.component.html',
  styleUrl: './score-check.component.css',
} )
export class ScoreCheckComponent {
  private readonly data = signal<ScoreCheck | null>( null );
  @Input( { required: true } ) set check ( value: ScoreCheck | null ) { this.data.set( value ); }
  get check (): ScoreCheck | null { return this.data(); }
  @Input() mode: 'review' | 'editor' = 'review';
  /** Scoring now. */
  @Input() running = false;
  /** The fix TODD is writing, or whose revision is open in the editor. */
  @Input() activeFix = '';
  @Output() readonly run = new EventEmitter<void>();
  @Output() readonly fix = new EventEmitter<string>();

  readonly fixes = computed( () => rankedFixes( this.data() ) );
  readonly projected = computed( () => projectedTotal( this.data() ) );
  readonly bySection = computed( () => pointsBySection( this.data() ) );
  readonly opening = computed( () => {
    const o = this.data()?.opening;
    return o && !o.ok && o.fix && !o.fixed ? o : null;
  } );

  readonly tint = scoreTint;
  readonly ago = ranAgo;
  readonly percent = ( points: number, max: number ) => max ? Math.round( ( points / max ) * 100 ) : 0;
  readonly countWord = ( n: number ) => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'][n] || String( n );
}
