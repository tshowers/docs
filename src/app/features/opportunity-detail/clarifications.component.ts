import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { postOf } from '../../models/after-submittal';
import { shortDate } from '../../models/key-dates';
import { Clarification, DocsInbox, Opportunity } from '../../models/opportunity';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { OpportunitiesService } from '../../services/opportunities.service';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';
import { WriteActionDirective } from '../../shared/write-access/write-action.directive';

/**
 * The buyer's clarification questions after sending (design_handoff_todd_
 * docs_lifecycle 1k rail): each question with 16Ahead's drafted answer to edit
 * and send from the person's own inbox, the ones already answered, and Log a
 * question for one that came another way.
 */
@Component( {
  selector: 'app-clarifications',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DkIconComponent, WriteActionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clarifications.component.html',
  styleUrl: './clarifications.component.css',
} )
export class ClarificationsComponent {
  private readonly service = inject( OpportunitiesService );
  private readonly notifications = inject( DocsNotificationService );

  private readonly current = signal<Opportunity | null>( null );
  @Input( { required: true } ) set opportunity ( value: Opportunity ) { this.current.set( value ); }
  @Input() sender: DocsInbox | null = null;
  @Input() signer = '';
  @Output() readonly changed = new EventEmitter<Opportunity>();

  readonly busy = signal( '' );
  readonly logging = signal( false );
  newQuestion = '';
  answers: Record<string, string> = {};

  readonly items = computed( () => postOf( this.current()! ).clarifications );
  readonly asker = computed( () => ( this.current()?.agency || 'They' ).replace( /^City of /, '' ) );
  readonly to = computed( () => {
    const o = this.current();
    return o?.submission.email || o?.keyDates?.questionsTo || o?.submissionRecord?.to || '';
  } );
  readonly shortDate = shortDate;

  answerOf ( c: Clarification ): string {
    return this.answers[c.id] ?? c.answer;
  }

  log (): void {
    const o = this.current();
    const question = this.newQuestion.trim();
    if ( !o || !question || this.busy() ) return;
    this.run( 'log', this.service.logClarification( o.id, question ), () => {
      this.newQuestion = '';
      this.logging.set( false );
    } );
  }

  redraft ( c: Clarification ): void {
    const o = this.current();
    if ( !o ) return;
    this.run( c.id, this.service.redraftClarification( o.id, c.id ), () => delete this.answers[c.id] );
  }

  send ( c: Clarification ): void {
    const o = this.current();
    const answer = this.answerOf( c ).trim();
    if ( !o || !this.sender || !answer ) return;
    this.run( c.id, this.service.sendClarification( o.id, c.id, { mailboxId: this.sender.id, to: this.to(), answer, signer: this.signer } ), () => {
      delete this.answers[c.id];
      this.notifications.show( 'Answer sent', `Sent to ${ this.to() } from ${ this.sender?.emailAddress }.`, 'success' );
    } );
  }

  private run ( key: string, call: ReturnType<OpportunitiesService['prepOrals']>, done?: () => void ): void {
    if ( this.busy() ) return;
    this.busy.set( key );
    call.subscribe( {
      next: ( updated ) => {
        this.busy.set( '' );
        this.current.set( updated );
        this.changed.emit( updated );
        done?.();
      },
      error: ( error: unknown ) => {
        this.busy.set( '' );
        this.notifications.show( 'That didn\'t work', error instanceof HttpErrorResponse && error.error?.message ? error.error.message : 'Please try again.', 'warning' );
      },
    } );
  }
}
