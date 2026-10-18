import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApprovalRequest, ApprovalRule, firstName, initials, parseApprover, personTint, shortWhen, suggestedApproveBy } from '../../models/approval';
import { ApproverShareComponent, ShareVia } from '../../shared/approver-share/approver-share.component';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';

export interface ApprovalForm {
  approvers: { id?: string; name: string; email: string }[];
  rule: ApprovalRule;
  dueAt: string;
  note: string;
  onApproved: 'notify' | 'autoSend';
  allowSuggestions: boolean;
}

interface Person { id?: string; name: string; email: string; }

function toLocalInput ( d: Date ): string {
  const pad = ( n: number ) => String( n ).padStart( 2, '0' );
  return `${ d.getFullYear() }-${ pad( d.getMonth() + 1 ) }-${ pad( d.getDate() ) }T${ pad( d.getHours() ) }:${ pad( d.getMinutes() ) }`;
}

/**
 * Get approval before sending (design_handoff_todd_docs 4a). Opened from
 * Review & send, and again for Change approvers. Approvers are anyone: a
 * name or an email. Once asked, the dialog turns into each person's link
 * to send them, since TODD doesn't email them itself.
 */
@Component( {
  selector: 'app-get-approval-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DkIconComponent, ApproverShareComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './get-approval-dialog.component.html',
  styleUrl: './get-approval-dialog.component.css',
} )
export class GetApprovalDialogComponent implements OnInit {
  private readonly host = inject( ElementRef<HTMLElement> );

  readonly buyer = input( '' );
  readonly submissionAddress = input( '' );
  readonly portalOnly = input( false );
  readonly rfpDue = input<Date | null>( null );
  readonly ownerName = input( '' );
  /** Change approvers: the request to start from. */
  readonly initial = input<ApprovalRequest | null>( null );
  /** Set once saved: the dialog shows each person's link. */
  readonly saved = input<ApprovalRequest | null>( null );
  readonly busy = input( false );
  readonly error = input( '' );

  readonly closed = output<void>();
  readonly submitted = output<ApprovalForm>();
  readonly shared = output<{ approverId: string; via: ShareVia }>();

  readonly people = signal<Person[]>( [] );
  readonly entry = signal( '' );
  readonly entryProblem = signal( '' );
  readonly rule = signal<ApprovalRule>( 'all' );
  readonly dueAt = signal( '' );
  readonly picking = signal( false );
  readonly onApproved = signal<'notify' | 'autoSend'>( 'notify' );
  readonly allowSuggestions = signal( true );
  note = '';

  readonly initials = initials;
  readonly tint = ( p: Person ) => personTint( p.email || p.name );
  readonly first = firstName;

  readonly suggestions = computed( () => suggestedApproveBy( this.rfpDue() ).map( ( d ) => ( { value: d.toISOString(), label: shortWhen( d ) } ) ) );
  readonly pickedLabel = computed( () => {
    const value = this.dueAt();
    if ( !value || this.suggestions().some( ( s ) => s.value === value ) ) return '';
    return shortWhen( value );
  } );
  readonly maxPick = computed( () => {
    const due = this.rfpDue();
    return due ? toLocalInput( due ) : '';
  } );
  readonly minPick = toLocalInput( new Date() );
  readonly dueProblem = computed( () => {
    const value = this.dueAt();
    const due = this.rfpDue();
    if ( !value ) return '';
    const at = new Date( value ).getTime();
    if ( at < Date.now() ) return 'Pick a time that hasn\'t passed.';
    if ( due && at > due.getTime() ) return 'Approval has to come before the RFP is due.';
    return '';
  } );
  readonly canSubmit = computed( () => this.people().length > 0 && !this.dueProblem() && !this.busy() );
  readonly whenLabel = computed( () => this.rule() === 'any' ? 'When one approves' : 'When everyone approves' );

  ngOnInit (): void {
    const start = this.initial();
    if ( start ) {
      this.people.set( start.approvers.map( ( a ) => ( { id: a.id, name: a.name, email: a.email } ) ) );
      this.rule.set( start.rule );
      this.dueAt.set( start.dueAt );
      this.note = start.note;
      this.onApproved.set( this.portalOnly() ? 'notify' : start.onApproved );
      this.allowSuggestions.set( start.allowSuggestions );
    } else {
      this.dueAt.set( this.suggestions()[0]?.value || '' );
    }
    setTimeout( () => ( this.host.nativeElement as HTMLElement ).querySelector<HTMLInputElement>( '.ga__entry' )?.focus() );
  }

  /** Enter, comma or Tab adds what was typed; pasting several emails adds each. */
  addEntry (): boolean {
    const parts = this.entry().split( /[,;\n]+/ ).map( ( p ) => p.trim() ).filter( Boolean );
    if ( !parts.length ) return false;
    const bad: string[] = [];
    const next = [...this.people()];
    for ( const part of parts ) {
      const person = parseApprover( part );
      if ( !person ) { bad.push( part ); continue; }
      const dup = next.some( ( p ) => ( person.email && p.email === person.email ) || ( !person.email && !p.email && p.name.toLowerCase() === person.name.toLowerCase() ) );
      if ( !dup ) next.push( person );
    }
    this.people.set( next.slice( 0, 10 ) );
    this.entry.set( bad.join( ', ' ) );
    this.entryProblem.set( bad.length ? `${ bad.join( ', ' ) } isn't an email address. Type a name, or a full email.` : '' );
    return true;
  }

  onKey ( event: KeyboardEvent ): void {
    if ( event.key === 'Enter' || event.key === ',' || ( event.key === 'Tab' && this.entry().trim() ) ) {
      if ( this.addEntry() ) event.preventDefault();
    } else if ( event.key === 'Backspace' && !this.entry() && this.people().length ) {
      this.people.update( ( list ) => list.slice( 0, -1 ) );
    }
  }

  remove ( person: Person ): void {
    this.people.update( ( list ) => list.filter( ( p ) => p !== person ) );
  }

  pick ( value: string ): void {
    this.dueAt.set( value ? new Date( value ).toISOString() : '' );
  }

  pickedInput (): string {
    const value = this.dueAt();
    return value ? toLocalInput( new Date( value ) ) : '';
  }

  submit (): void {
    this.addEntry();
    if ( !this.canSubmit() ) return;
    this.submitted.emit( {
      approvers: this.people().map( ( p ) => ( { id: p.id, name: p.name, email: p.email } ) ),
      rule: this.rule(),
      dueAt: this.dueAt(),
      note: this.note.trim(),
      onApproved: this.portalOnly() ? 'notify' : this.onApproved(),
      allowSuggestions: this.allowSuggestions(),
    } );
  }

  onBackdrop ( event: MouseEvent ): void {
    if ( event.target === event.currentTarget && !this.busy() ) this.closed.emit();
  }
}
