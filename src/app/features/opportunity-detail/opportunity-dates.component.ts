import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { buildIcs, deadlineHeadline, keyDatesOf, longDate, nextDeadline, shortDate, timeline, whenOf } from '../../models/key-dates';
import { BuyerQuestion, BuyerUpdate, DocsInbox, KeyDateKind, Opportunity } from '../../models/opportunity';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { OpportunitiesService } from '../../services/opportunities.service';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';
import { WriteActionDirective } from '../../shared/write-access/write-action.directive';

const CHANGE_ICON: Record<string, string> = { due_date: 'calendar', date: 'calendar', requirement: 'refresh', form: 'file', other: 'info' };

/** The questions as one block to paste into a portal's Q&A form. */
export function questionsForPortal ( questions: Pick<BuyerQuestion, 'text' | 'ref'>[] ): string {
  return questions.map( ( q, i ) => `${ i + 1 }. ${ q.ref ? `(Section ${ q.ref }) ` : '' }${ q.text }` ).join( '\n' );
}

/**
 * Key dates and the buyer's Q&A on an opportunity (design_handoff_todd_docs_
 * lifecycle 1f/1g): an addendum that just arrived and what it changed, the
 * next deadline with Add to calendar, the dates in order, and the questions
 * 16Ahead would ask, sent from the person's own inbox or copied for the portal.
 * 16Ahead reads the RFP for them the first time the page opens.
 */
@Component( {
  selector: 'app-opportunity-dates',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DkIconComponent, WriteActionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './opportunity-dates.component.html',
  styleUrl: './opportunity-dates.component.css',
} )
export class OpportunityDatesComponent implements OnChanges {
  private readonly service = inject( OpportunitiesService );
  private readonly notifications = inject( DocsNotificationService );

  private readonly current = signal<Opportunity | null>( null );
  @Input( { required: true } ) set opportunity ( value: Opportunity ) { this.current.set( value ); }
  get opportunity (): Opportunity { return this.current()!; }
  private readonly updateList = signal<BuyerUpdate[]>( [] );
  @Input() set updates ( value: BuyerUpdate[] ) { this.updateList.set( value || [] ); }
  /** The inbox questions go out from, and who signs them. */
  @Input() sender: DocsInbox | null = null;
  @Input() signer = '';
  @Output() readonly changed = new EventEmitter<Opportunity>();
  @Output() readonly updatesChanged = new EventEmitter<BuyerUpdate[]>();

  readonly busy = signal( '' );
  readonly adding = signal( false );
  newKind: KeyDateKind = 'questions_due';
  newLabel = '';
  newDate = '';
  newTime = '';
  questionsTo = '';
  private readId = '';

  readonly dates = computed( () => keyDatesOf( this.current()! ) );
  readonly line = computed( () => timeline( this.current()! ) );
  readonly next = computed( () => nextDeadline( this.current()! ) );
  readonly questions = computed( () => this.current()?.buyerQuestions || { items: [], sent: null } );
  readonly picked = computed( () => this.questions().items.filter( ( q ) => q.picked ) );
  readonly questionsDue = computed( () => this.dates().items.find( ( d ) => d.kind === 'questions_due' ) || null );
  readonly questionsClosed = computed( () => {
    const due = whenOf( this.questionsDue()?.date || '' );
    return !!due && due.getTime() < Date.now();
  } );
  readonly missingQuestionsDate = computed( () => this.dates().status === 'done' && !this.questionsDue() );

  readonly longDate = longDate;
  readonly shortDate = shortDate;
  readonly headline = deadlineHeadline;
  readonly changeIcon = ( kind: string ) => CHANGE_ICON[kind] || 'info';

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( !changes['opportunity'] ) return;
    const o = this.current();
    if ( !o ) return;
    if ( !this.questionsTo || changes['opportunity'].previousValue?.id !== o.id ) this.questionsTo = keyDatesOf( o ).questionsTo;
    // The first visit reads the RFP for its dates and questions.
    if ( o.status !== 'dismissed' && keyDatesOf( o ).status === 'unchecked' && this.readId !== o.id ) {
      this.readId = o.id;
      this.check();
    }
  }

  check ( force = false ): void {
    const o = this.current();
    if ( !o || this.busy() ) return;
    this.busy.set( 'check' );
    this.current.set( { ...o, keyDates: { ...keyDatesOf( o ), status: 'checking' } } );
    this.service.checkKeyDates( o.id, force ).subscribe( {
      next: ( updated ) => {
        this.busy.set( '' );
        this.questionsTo = this.questionsTo || keyDatesOf( updated ).questionsTo;
        this.emit( updated );
      },
      error: () => {
        this.busy.set( '' );
        this.current.set( { ...o, keyDates: { ...keyDatesOf( o ), status: 'failed' } } );
      },
    } );
  }

  /** Addenda not read yet, newest first (1g). */
  readonly unread = computed( () => this.updateList().filter( ( u ) => u.kind === 'addendum' && !u.read ) );

  checkCount ( u: BuyerUpdate ): number {
    return u.changes.filter( ( c ) => c.checkAgain ).length;
  }

  markRead ( u: BuyerUpdate ): void {
    const o = this.current();
    if ( !o ) return;
    this.service.markUpdateRead( o.id, u.id ).subscribe( {
      next: ( list ) => {
        this.updatesChanged.emit( list );
        this.emit( { ...o, unreadUpdates: list.filter( ( x ) => !x.read ).length } );
      },
      error: () => this.notifications.show( 'Couldn\'t mark it read', 'Please try again.', 'warning' ),
    } );
  }

  addToCalendar (): void {
    const o = this.current();
    const d = this.next();
    if ( !o || !d ) return;
    const ics = buildIcs( {
      uid: `${ o.id }-${ d.item.id }`,
      title: `${ d.item.label }: ${ o.title }`,
      date: d.item.date,
      where: d.item.where,
      description: [o.solicitationNumber, o.agency].filter( Boolean ).join( ' · ' ) + ( d.item.kind === 'questions_due' && this.questionsTo ? `\nSend questions to ${ this.questionsTo }` : '' ),
    } );
    const url = URL.createObjectURL( new Blob( [ics], { type: 'text/calendar' } ) );
    const link = document.createElement( 'a' );
    link.href = url;
    link.download = `${ d.item.label } - ${ o.title }.ics`.replace( /[\\/:*?"<>|]+/g, '' );
    document.body.appendChild( link );
    link.click();
    link.remove();
    setTimeout( () => URL.revokeObjectURL( url ), 1000 );
  }

  addDate (): void {
    const o = this.current();
    if ( !o || !this.newDate || this.busy() ) return;
    const date = this.newTime ? new Date( `${ this.newDate }T${ this.newTime }` ).toISOString() : this.newDate;
    this.busy.set( 'date' );
    this.service.addKeyDate( o.id, { kind: this.newKind, label: this.newKind === 'other' ? this.newLabel : undefined, date } ).subscribe( {
      next: ( updated ) => {
        this.busy.set( '' );
        this.adding.set( false );
        this.newDate = '';
        this.newTime = '';
        this.newLabel = '';
        this.emit( updated );
      },
      error: ( error: unknown ) => {
        this.busy.set( '' );
        this.notifications.show( 'Couldn\'t add that date', this.message( error ), 'warning' );
      },
    } );
  }

  togglePick ( q: BuyerQuestion ): void {
    this.saveQuestion( q, { picked: !q.picked } );
  }

  editQuestion ( q: BuyerQuestion, text: string ): void {
    const clean = text.trim();
    if ( clean && clean !== q.text ) this.saveQuestion( q, { text: clean } );
  }

  private saveQuestion ( q: BuyerQuestion, change: { text?: string; picked?: boolean } ): void {
    const o = this.current();
    if ( !o ) return;
    // Show it at once; the server's copy replaces it.
    this.current.set( { ...o, buyerQuestions: { ...this.questions(), items: this.questions().items.map( ( x ) => x.id === q.id ? { ...x, ...change } : x ) } } );
    this.service.saveBuyerQuestions( o.id, [{ id: q.id, ...change }] ).subscribe( {
      next: ( updated ) => this.emit( updated ),
      error: () => {
        this.current.set( o );
        this.notifications.show( 'Couldn\'t save that', 'Please try again.', 'warning' );
      },
    } );
  }

  sendQuestions (): void {
    const o = this.current();
    if ( !o || !this.sender || !this.picked().length || this.busy() ) return;
    this.busy.set( 'send' );
    this.service.sendBuyerQuestions( o.id, { mailboxId: this.sender.id, to: this.questionsTo.trim(), signer: this.signer } ).subscribe( {
      next: ( updated ) => {
        this.busy.set( '' );
        this.notifications.show( 'Questions sent', `Sent to ${ updated.buyerQuestions?.sent?.to || this.questionsTo } from ${ this.sender?.emailAddress }.`, 'success' );
        this.emit( updated );
      },
      error: ( error: unknown ) => {
        this.busy.set( '' );
        this.notifications.show( 'Not sent', this.message( error ), 'warning' );
      },
    } );
  }

  async copyForPortal (): Promise<void> {
    const o = this.current();
    if ( !o || !this.picked().length ) return;
    try {
      await navigator.clipboard.writeText( questionsForPortal( this.picked() ) );
    } catch {
      this.notifications.show( 'Couldn\'t copy', 'Select the questions and copy them yourself.', 'warning' );
      return;
    }
    this.notifications.show( 'Copied', 'Paste them into the portal\'s Q&A form.', 'success' );
    this.service.questionsCopied( o.id ).subscribe( { next: ( updated ) => this.emit( updated ), error: () => null } );
  }

  private emit ( o: Opportunity ): void {
    this.current.set( o );
    this.changed.emit( o );
  }

  private message ( error: unknown ): string {
    return error instanceof HttpErrorResponse && error.error?.message ? error.error.message : 'Please try again.';
  }
}
