import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';

import { keyDatesOf, shortDate } from '../../models/key-dates';
import { BuyerUpdate, Opportunity, mustHavesOf } from '../../models/opportunity';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';

/** How many of the buyer's answers show before "Show all". */
const ANSWERS_SHOWN = 2;

/**
 * The right rail under the next step (design_handoff_todd_docs_lifecycle
 * 1f/1g): the buyer's answers once posted (or when they're expected),
 * addenda already read, and the must-haves in one line.
 */
@Component( {
  selector: 'app-buyer-updates',
  standalone: true,
  imports: [CommonModule, DkIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './buyer-updates.component.html',
  styleUrl: './buyer-updates.component.css',
} )
export class BuyerUpdatesComponent {
  private readonly current = signal<Opportunity | null>( null );
  private readonly list = signal<BuyerUpdate[]>( [] );
  @Input( { required: true } ) set opportunity ( value: Opportunity ) { this.current.set( value ); }
  @Input() set updates ( value: BuyerUpdate[] ) { this.list.set( value || [] ); }

  readonly showAll = signal( false );
  readonly agency = computed( () => this.current()?.agency || 'this agency' );
  readonly answers = computed( () => this.list().find( ( u ) => u.kind === 'answers' && u.answers.length ) || null );
  readonly shownAnswers = computed( () => {
    const all = this.answers()?.answers || [];
    return this.showAll() ? all : all.slice( 0, ANSWERS_SHOWN );
  } );
  readonly readAddenda = computed( () => this.list().filter( ( u ) => u.kind === 'addendum' && u.read ) );
  /** "Not posted yet": shown once questions went, or a questions deadline is known. */
  readonly expecting = computed( () => {
    const o = this.current();
    if ( !o || this.answers() ) return null;
    const due = keyDatesOf( o ).items.find( ( d ) => d.kind === 'questions_due' );
    if ( !o.buyerQuestions?.sent && !due ) return null;
    return { agency: o.agency || 'The buyer', after: due ? shortDate( due.date ) : '' };
  } );
  readonly mustHaves = computed( () => {
    const o = this.current();
    if ( !o || o.status === 'new' ) return null;
    const m = mustHavesOf( o );
    if ( m.status !== 'done' || !m.summary.total ) return null;
    return m.summary.notMet ? { ok: false, text: `Must-haves: ${ m.summary.notMet } not met` } : { ok: true, text: 'Must-haves: all met' };
  } );

  readonly shortDate = shortDate;
}
