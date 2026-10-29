import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Requirement, Requirements } from '../../models/opportunity';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';
import { WriteActionDirective } from '../../shared/write-access/write-action.directive';

export type RequirementFilter = 'all' | 'not_answered' | 'answered';

/** The rows a filter shows: in the RFP's order. */
export function filterRequirements ( items: Requirement[], filter: RequirementFilter ): Requirement[] {
  return filter === 'all' ? items : items.filter( ( r ) => r.status === filter );
}

/** "Recently matched" (1d): the newest answered ones, newest first. */
export function recentlyMatched ( items: Requirement[], count = 2 ): Requirement[] {
  return items.filter( ( r ) => r.status === 'answered' && r.matchedAt )
      .sort( ( a, b ) => b.matchedAt.localeCompare( a.matchedAt ) )
      .slice( 0, count );
}

/**
 * The compliance matrix (design_handoff_todd_docs_lifecycle 1d panel, 1e
 * table, 1q iPhone): "41 of 44 requirements answered", filters, and a row per
 * shall/must/will. Unanswered rows offer Write this; answered rows link to
 * the paragraph. In the table a selected row shows the RFP's words and
 * 16Ahead's draft. The editor owns the data and the calls.
 */
@Component( {
  selector: 'app-requirements-matrix',
  standalone: true,
  imports: [CommonModule, FormsModule, DkIconComponent, WriteActionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './requirements-matrix.component.html',
  styleUrl: './requirements-matrix.component.css',
} )
export class RequirementsMatrixComponent {
  private readonly data = signal<Requirements | null>( null );
  @Input( { required: true } ) set requirements ( value: Requirements | null ) { this.data.set( value ); }
  get requirements (): Requirements | null { return this.data(); }
  @Input() mode: 'panel' | 'table' = 'panel';
  /** The requirement 16Ahead is writing for, or whose suggestion is being saved. */
  @Input() busyId = '';
  @Input() sectionTitle: ( key: string ) => string = () => '';

  @Output() readonly write = new EventEmitter<Requirement>();
  @Output() readonly jump = new EventEmitter<Requirement>();
  @Output() readonly accept = new EventEmitter<{ requirement: Requirement; text: string }>();
  @Output() readonly discard = new EventEmitter<Requirement>();
  @Output() readonly mark = new EventEmitter<{ requirement: Requirement; answered: boolean }>();
  @Output() readonly exportAs = new EventEmitter<'pdf' | 'docx'>();
  @Output() readonly retry = new EventEmitter<void>();

  /** Unset until the person picks one: Not answered while there are any, else All. */
  private readonly picked = signal<RequirementFilter | null>( null );
  readonly expanded = signal( '' );
  readonly editing = signal( '' );
  readonly exportOpen = signal( false );
  editText = '';

  readonly filter = computed<RequirementFilter>( () => this.picked() || ( this.data()?.summary.notAnswered ? 'not_answered' : 'all' ) );
  readonly rows = computed( () => filterRequirements( this.data()?.items || [], this.filter() ) );
  readonly recent = computed( () => this.mode === 'panel' && this.filter() === 'not_answered' ? recentlyMatched( this.data()?.items || [] ) : [] );
  readonly percent = computed( () => {
    const s = this.data()?.summary;
    return s?.total ? Math.round( ( s.answered / s.total ) * 100 ) : 0;
  } );
  readonly filters = computed( () => {
    const s = this.data()?.summary || { total: 0, answered: 0, notAnswered: 0 };
    return [
      { key: 'all' as const, label: 'All', count: s.total },
      { key: 'not_answered' as const, label: 'Not answered', count: s.notAnswered },
      { key: 'answered' as const, label: 'Answered', count: s.answered },
    ];
  } );

  pick ( filter: RequirementFilter ): void {
    this.picked.set( filter );
  }

  toggle ( r: Requirement ): void {
    if ( this.mode !== 'table' ) return;
    this.expanded.set( this.expanded() === r.id ? '' : r.id );
    this.editing.set( '' );
  }

  where ( r: Requirement ): string {
    if ( r.answeredIn?.label ) return r.answeredIn.label;
    if ( r.manual ) return 'Marked answered';
    return this.sectionTitle( r.answeredIn?.sectionKey || '' ) || 'Answered';
  }

  startEdit ( r: Requirement ): void {
    this.editing.set( r.id );
    this.editText = r.suggestion?.text || '';
  }

  acceptSuggestion ( r: Requirement ): void {
    const text = this.editing() === r.id ? this.editText.trim() : r.suggestion?.text || '';
    if ( !text ) return;
    this.accept.emit( { requirement: r, text } );
    this.editing.set( '' );
  }
}
