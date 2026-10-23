import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { debriefDraft, postHistory, postOf, stageTiles } from '../../models/after-submittal';
import { buildIcs, longDate, whenOf } from '../../models/key-dates';
import { DocsInbox, LOSS_REASONS, Opportunity, ProposalSection } from '../../models/opportunity';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { OpportunitiesService } from '../../services/opportunities.service';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';
import { WriteActionDirective } from '../../shared/write-access/write-action.directive';

function download ( blob: Blob, name: string ): void {
  const url = URL.createObjectURL( blob );
  const link = document.createElement( 'a' );
  link.href = url;
  link.download = name.replace( /[\\/:*?"<>|]+/g, '' );
  document.body.appendChild( link );
  link.click();
  link.remove();
  setTimeout( () => URL.revokeObjectURL( url ), 1000 );
}

/**
 * After submittal on the opportunity page (design_handoff_todd_docs_lifecycle
 * 1k/1l/1s): the stages with the current one open, the oral presentation
 * and TODD's prep sheet, the award (won, lost and why, cancelled), the
 * debrief request sent from the person's own inbox with a reminder, saving
 * the winning sections to Knowledge, and the history newest first.
 * Clarification questions are in the rail (clarifications.component).
 */
@Component( {
  selector: 'app-after-submittal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DkIconComponent, WriteActionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './after-submittal.component.html',
  styleUrl: './after-submittal.component.css',
} )
export class AfterSubmittalComponent implements OnChanges {
  private readonly service = inject( OpportunitiesService );
  private readonly notifications = inject( DocsNotificationService );

  private readonly current = signal<Opportunity | null>( null );
  @Input( { required: true } ) set opportunity ( value: Opportunity ) { this.current.set( value ); }
  get opportunity (): Opportunity { return this.current()!; }
  @Input() sender: DocsInbox | null = null;
  @Input() signer = '';
  @Input() company = '';
  @Output() readonly changed = new EventEmitter<Opportunity>();

  readonly busy = signal( '' );
  readonly editingOrals = signal( false );
  readonly sections = signal<ProposalSection[]>( [] );
  readonly picked = signal<string[]>( [] );
  readonly lossReasons = LOSS_REASONS;
  oralsDate = '';
  oralsTime = '';
  oralsPeople = '';
  oralsPlace = '';
  oralsMinutes = 45;
  debriefTo = '';
  debriefSubject = '';
  debriefBody = '';
  remind = true;
  private draftedFor = '';

  readonly post = computed( () => postOf( this.current()! ) );
  readonly tiles = computed( () => stageTiles( this.current()! ) );
  readonly history = computed( () => postHistory( this.current()! ) );
  readonly oralsAhead = computed( () => {
    const at = this.post().orals ? whenOf( this.post().orals!.date ) : null;
    return !!at && at.getTime() >= Date.now();
  } );
  /** Lost and no debrief asked yet: the draft to edit and send. */
  readonly askDebrief = computed( () => this.post().outcome?.result === 'lost' && !this.post().debrief?.sentAt );
  /** "Tyrone Showers, Dana Lee · 45 minutes · Everett City Hall, Room 3". */
  readonly oralsMeta = computed( () => {
    const orals = this.post().orals;
    if ( !orals ) return '';
    return [orals.attendees.join( ', ' ), orals.minutes ? `${ orals.minutes } minutes` : '', orals.place].filter( Boolean ).join( ' · ' );
  } );
  readonly unsaved = computed( () => this.sections().filter( ( s ) => s.blocks.length && !this.post().savedSections.includes( s.key ) ) );

  readonly longDate = longDate;

  ngOnChanges ( changes: SimpleChanges ): void {
    const o = this.current();
    if ( !changes['opportunity'] || !o ) return;
    if ( this.draftedFor !== o.id ) {
      this.draftedFor = o.id;
      const d = debriefDraft( o, this.company );
      this.debriefTo = d.to;
      this.debriefSubject = d.subject;
      this.debriefBody = d.body;
    }
    if ( o.status === 'won' && !this.sections().length && o.proposalDocumentId ) {
      this.service.getProposal( o.id ).subscribe( { next: ( draft ) => {
        this.sections.set( draft?.sections || [] );
        this.picked.set( this.unsaved().map( ( s ) => s.key ) );
      }, error: () => null } );
    }
  }

  editOrals (): void {
    const orals = this.post().orals;
    const at = orals ? whenOf( orals.date ) : null;
    const pad = ( n: number ) => String( n ).padStart( 2, '0' );
    this.oralsDate = at ? `${ at.getFullYear() }-${ pad( at.getMonth() + 1 ) }-${ pad( at.getDate() ) }` : '';
    this.oralsTime = at ? `${ pad( at.getHours() ) }:${ pad( at.getMinutes() ) }` : '10:00';
    this.oralsPeople = orals?.attendees.join( ', ' ) || this.signer.split( ',' )[0] || '';
    this.oralsPlace = orals?.place || '';
    this.oralsMinutes = orals?.minutes || 45;
    this.editingOrals.set( true );
  }

  saveOrals (): void {
    const o = this.current();
    if ( !o || !this.oralsDate ) return;
    const date = new Date( `${ this.oralsDate }T${ this.oralsTime || '10:00' }` ).toISOString();
    this.run( 'orals', this.service.scheduleOrals( o.id, { date, attendees: this.oralsPeople.split( ',' ).map( ( p ) => p.trim() ).filter( Boolean ), place: this.oralsPlace, minutes: Number( this.oralsMinutes ) || 0 } ), () => this.editingOrals.set( false ) );
  }

  prep (): void {
    const o = this.current();
    if ( o ) this.run( 'prep', this.service.prepOrals( o.id ) );
  }

  oralsToCalendar (): void {
    const o = this.current();
    const orals = this.post().orals;
    if ( !o || !orals ) return;
    download( new Blob( [buildIcs( { uid: `${ o.id }-orals`, title: `Oral presentation: ${ o.title }`, date: orals.date, where: orals.place, description: orals.attendees.join( ', ' ) } )], { type: 'text/calendar' } ), `Oral presentation - ${ o.title }.ics` );
  }

  async downloadPrep (): Promise<void> {
    const o = this.current();
    const orals = this.post().orals;
    if ( !o || !orals?.prep ) return;
    const { buildPrepSheetPdf } = await import( '../../shared/prep-sheet-pdf' );
    const bytes = await buildPrepSheetPdf( {
      title: `${ o.title }: oral presentation`,
      when: [longDate( orals.date ), orals.place, orals.minutes ? `${ orals.minutes } minutes` : ''].filter( Boolean ).join( ' · ' ),
      who: orals.attendees.join( ', ' ),
      ...orals.prep,
    } );
    download( new Blob( [bytes as BlobPart], { type: 'application/pdf' } ), `Prep sheet - ${ o.title }.pdf` );
  }

  outcome ( result: 'won' | 'lost' | 'cancelled', reason = '' ): void {
    const o = this.current();
    if ( o ) this.run( 'outcome', this.service.recordOutcome( o.id, { result, reason: reason || undefined } ) );
  }

  sendDebrief (): void {
    const o = this.current();
    if ( !o || !this.sender ) return;
    this.run( 'debrief', this.service.sendDebrief( o.id, { mailboxId: this.sender.id, to: this.debriefTo.trim(), subject: this.debriefSubject.trim(), body: this.debriefBody.trim(), remind: this.remind, signer: this.signer } ), () => this.notifications.show( 'Debrief request sent', `Sent to ${ this.debriefTo.trim() } from ${ this.sender?.emailAddress }.`, 'success' ) );
  }

  replied (): void {
    const o = this.current();
    if ( o ) this.run( 'replied', this.service.debriefReplied( o.id ) );
  }

  togglePick ( key: string ): void {
    this.picked.update( ( list ) => list.includes( key ) ? list.filter( ( k ) => k !== key ) : [...list, key] );
  }

  saveSections (): void {
    const o = this.current();
    if ( !o || !this.picked().length || this.busy() ) return;
    this.busy.set( 'save' );
    this.service.saveWinningSections( o.id, this.picked() ).subscribe( {
      next: ( { opportunity, saved, reason } ) => {
        this.busy.set( '' );
        this.picked.set( [] );
        this.emit( opportunity );
        this.notifications.show( saved ? 'Saved to Knowledge' : 'Not saved', reason || `${ saved } ${ saved === 1 ? 'section' : 'sections' } will come up the next time an RFP asks.`, reason ? 'warning' : 'success' );
      },
      error: ( error: unknown ) => {
        this.busy.set( '' );
        this.notifications.show( 'Couldn\'t save them', this.message( error ), 'warning' );
      },
    } );
  }

  private run ( key: string, call: ReturnType<OpportunitiesService['prepOrals']>, done?: () => void ): void {
    if ( this.busy() ) return;
    this.busy.set( key );
    call.subscribe( {
      next: ( updated ) => {
        this.busy.set( '' );
        this.emit( updated );
        done?.();
      },
      error: ( error: unknown ) => {
        this.busy.set( '' );
        this.notifications.show( 'That didn\'t work', this.message( error ), 'warning' );
      },
    } );
  }

  private emit ( o: Opportunity ): void {
    this.current.set( o );
    this.changed.emit( o );
  }

  private message ( error: unknown ): string {
    return error instanceof HttpErrorResponse && error.error?.message ? error.error.message : 'Please try again.';
  }
}
