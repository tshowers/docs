import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import {
  BuyerUpdate, DocsInbox, MustHave, NO_BID_REASONS, NoBidReason, Opportunity, PROPOSAL_STATUS_LABEL, STAGE_LABEL, STAGE_STEPS,
  dueLabel, dueLong, fitTint, mustHavesOf, stageOf, submitByLabel,
} from '../../models/opportunity';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { OpportunitiesService } from '../../services/opportunities.service';
import { ProfileApiService } from '../../services/profile-api.service';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';
import { WriteActionDirective } from '../../shared/write-access/write-action.directive';
import { defaultSender } from '../review-send/review-send.helpers';
import { AfterSubmittalComponent } from './after-submittal.component';
import { BuyerUpdatesComponent } from './buyer-updates.component';
import { ClarificationsComponent } from './clarifications.component';
import { OpportunityDatesComponent } from './opportunity-dates.component';

/** While another tab or device is reading the RFP, check back this often. */
const CHECKING_POLL_MS = 5000;

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const countWord = ( n: number ) => COUNT_WORDS[n] || String( n );

/** What the must-haves card shows (lifecycle 1a and 1c's states). */
export type GateView = 'checking' | 'no_rfp' | 'failed' | 'none' | 'list';

/** 16Ahead's line over the must-haves: what would disqualify you, and what it can't tell yet. */
export function gateIntro ( summary: { total: number; notMet: number; unknown: number } ): string {
  const { total, notMet, unknown } = summary;
  const unsure = unknown ? ` ${ countWord( unknown ) } I can't tell yet.` : '';
  if ( notMet ) return `${ notMet === total ? ( total === 1 ? 'This one' : `All ${ total }` ) : `${ countWord( notMet ) } of these` } would get you disqualified, whatever the score.${ unsure }`;
  if ( unknown ) return `Nothing here disqualifies you so far.${ unsure }`;
  return `All ${ total } met. Nothing here would disqualify you.`;
}

/**
 * One opportunity (design_handoff_todd_docs 1d, lifecycle 1a/1c): the
 * status line, what the agency wants, the facts that decide whether to bid,
 * 16Ahead's fit, and what they'll score. On the right, the Bid / No-Bid gate:
 * 16Ahead reads the RFP for its pass/fail must-haves before any drafting. Any
 * not met turns Draft proposal into "We can't meet this"; Draft anyway asks
 * why and keeps the reason; Not for us takes one tap.
 */
@Component( {
  selector: 'app-opportunity-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DkIconComponent, WriteActionDirective, OpportunityDatesComponent, BuyerUpdatesComponent, AfterSubmittalComponent, ClarificationsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './opportunity-detail.component.html',
  styleUrl: './opportunity-detail.component.css',
} )
export class OpportunityDetailComponent implements OnInit {
  private readonly route = inject( ActivatedRoute );
  private readonly router = inject( Router );
  private readonly service = inject( OpportunitiesService );
  private readonly notifications = inject( DocsNotificationService );
  private readonly destroyRef = inject( DestroyRef );
  private readonly profileApi = inject( ProfileApiService );

  readonly opportunity = signal<Opportunity | null>( null );
  /** Addenda and the buyer's answers (lifecycle 1g). */
  readonly updates = signal<BuyerUpdate[]>( [] );
  /** Questions for the buyer go out from this inbox, signed by the owner. */
  readonly sender = signal<DocsInbox | null>( null );
  readonly signer = signal( '' );
  readonly company = signal( '' );
  readonly notFound = signal( false );
  readonly busy = signal( '' );
  /** This page asked 16Ahead to read the RFP and is waiting on it. */
  readonly checking = signal( false );
  /** The must-have whose answer is being saved. */
  readonly answering = signal( '' );
  /** The card's actions, or the Draft anyway reason, or the Not for us reasons. */
  readonly panel = signal<'actions' | 'draft_anyway' | 'not_for_us'>( 'actions' );
  readonly otherPicked = signal( false );
  draftReason = '';
  otherDetail = '';

  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  readonly noBidReasons = NO_BID_REASONS;
  readonly tint = computed( () => fitTint( this.opportunity()?.fit.score || 0 ) );
  readonly fitHeading = computed( () => {
    const o = this.opportunity();
    if ( !o ) return '';
    if ( o.fit.headline ) return o.fit.headline;
    return o.fit.score >= 85 ? 'Strong fit' : o.fit.score >= 75 ? 'Good fit' : 'Weak fit';
  } );

  readonly mustHaves = computed( () => {
    const o = this.opportunity();
    return o ? mustHavesOf( o ) : null;
  } );

  /** "Fit is a judgment; must-haves are pass/fail" once there are must-haves to compare. */
  readonly fitLine = computed( () => {
    const o = this.opportunity();
    if ( !o ) return '';
    const why = o.fit.reasons.slice( 0, 2 ).map( ( r ) => r.replace( /\.$/, '' ) ).join( '. ' );
    const judged = this.mustHaves()?.summary.total ? 'Fit is a judgment; must-haves are pass/fail.' : '';
    return [why ? `${ why }.` : '', judged].filter( Boolean ).join( ' ' );
  } );

  readonly gate = computed<GateView>( () => {
    const m = this.mustHaves();
    if ( !m ) return 'checking';
    if ( this.checking() || m.status === 'checking' || m.status === 'unchecked' ) return 'checking';
    if ( m.status === 'no_rfp' ) return 'no_rfp';
    if ( m.status === 'failed' ) return 'failed';
    return m.items.length ? 'list' : 'none';
  } );

  readonly blocked = computed( () => this.gate() === 'list' && !!this.mustHaves()?.summary.notMet );
  readonly intro = computed( () => gateIntro( this.mustHaves()?.summary || { total: 0, notMet: 0, unknown: 0 } ) );
  readonly missingLine = computed( () => ( this.mustHaves()?.items || [] ).filter( ( i ) => i.state === 'not_met' ).map( ( i ) => i.text ).join( ' and ' ) );

  /** The status line (1a): done steps, the current one, the rest. */
  readonly steps = computed( () => {
    const o = this.opportunity();
    if ( !o ) return [];
    const stage = stageOf( o );
    const current = STAGE_STEPS.findIndex( ( s ) => s.stages.includes( stage ) );
    return STAGE_STEPS.map( ( step, index ) => ( {
      label: step.key === 'outcome' && index === current ? STAGE_LABEL[stage].label : step.label,
      state: index < current ? 'done' : index === current ? 'current' : 'next',
    } ) );
  } );

  readonly facts = computed( () => {
    const o = this.opportunity();
    if ( !o ) return [];
    return [
      { label: 'Due', value: dueLong( o ) || 'Not stated' },
      { label: 'Value', value: o.estimatedValue || 'Not stated' },
      { label: 'Page limit', value: o.pageLimit || 'Not stated' },
      { label: 'Submit by', value: submitByLabel( o ) },
    ];
  } );

  readonly sourceLine = computed( () => {
    const o = this.opportunity();
    if ( !o ) return '';
    const received = o.source.receivedAt ? new Date( o.source.receivedAt ) : null;
    const when = received && !isNaN( received.getTime() ) ? ` · received ${ received.toLocaleDateString( 'en-US', { month: 'short', day: 'numeric' } ) }` : '';
    const from = o.source.kind === 'upload' ? 'added by you' : `from ${ o.source.from || o.source.label }`;
    return `${ o.agency ? o.agency + ' · ' : '' }${ from }${ when }`;
  } );

  readonly dueLabel = dueLabel;
  readonly submitBy = submitByLabel;
  readonly statusLabel = PROPOSAL_STATUS_LABEL;
  /** Sent: what happens next replaces the dates and questions (lifecycle E). */
  readonly sent = ( o: Opportunity ) => ['submitted', 'won', 'lost'].includes( o.status );

  ngOnInit (): void {
    this.destroyRef.onDestroy( () => this.stopPolling() );
    this.service.listInboxes().subscribe( { next: ( inboxes ) => this.sender.set( defaultSender( inboxes ) ), error: () => null } );
    this.profileApi.load().then( ( p ) => {
      const name = [p?.firstName, p?.lastName].filter( Boolean ).join( ' ' );
      this.signer.set( [name, p?.companyName].filter( Boolean ).join( ', ' ) );
      this.company.set( p?.companyName || '' );
    } ).catch( () => null );
    this.route.paramMap.pipe( takeUntilDestroyed( this.destroyRef ) ).subscribe( ( params ) => {
      const id = String( params.get( 'id' ) || '' );
      const cached = this.service.opportunities().find( ( o ) => o.id === id );
      this.stopPolling();
      this.opportunity.set( cached || null );
      this.notFound.set( false );
      this.panel.set( 'actions' );
      this.updates.set( [] );
      this.service.get( id ).subscribe( {
        next: ( o ) => {
          this.opportunity.set( o );
          this.afterLoad( o );
        },
        error: () => { if ( !cached ) this.notFound.set( true ); },
      } );
      this.service.listUpdates( id ).subscribe( { next: ( list ) => this.updates.set( list ), error: () => null } );
    } );
  }

  /** Reads the RFP for must-haves the first time, or waits for a read already under way. */
  private afterLoad ( o: Opportunity ): void {
    if ( o.status !== 'new' ) return;
    const status = mustHavesOf( o ).status;
    if ( status === 'unchecked' ) this.checkMustHaves();
    else if ( status === 'checking' ) this.poll( o.id );
  }

  checkMustHaves ( force = false ): void {
    const o = this.opportunity();
    if ( !o || this.checking() ) return;
    this.checking.set( true );
    this.service.checkMustHaves( o.id, force ).subscribe( {
      next: ( updated ) => {
        this.checking.set( false );
        this.opportunity.set( updated );
        if ( mustHavesOf( updated ).status === 'checking' ) this.poll( updated.id );
      },
      error: () => {
        this.checking.set( false );
        // The check may still have finished or failed on the server: show what it saved.
        this.service.get( o.id ).subscribe( { next: ( latest ) => this.opportunity.set( latest ), error: () => null } );
      },
    } );
  }

  private poll ( id: string ): void {
    this.stopPolling();
    this.pollTimer = setTimeout( () => {
      this.service.get( id ).subscribe( {
        next: ( latest ) => {
          if ( this.opportunity()?.id !== id ) return;
          this.opportunity.set( latest );
          if ( mustHavesOf( latest ).status === 'checking' ) this.poll( id );
        },
        error: () => this.poll( id ),
      } );
    }, CHECKING_POLL_MS );
  }

  private stopPolling (): void {
    if ( this.pollTimer ) clearTimeout( this.pollTimer );
    this.pollTimer = null;
  }

  answer ( item: MustHave, choice: 'yes' | 'no' | 'unsure' ): void {
    const o = this.opportunity();
    if ( !o || this.answering() ) return;
    this.answering.set( item.id );
    this.service.answerMustHave( o.id, item.id, choice ).subscribe( {
      next: ( { opportunity, knowledge } ) => {
        this.answering.set( '' );
        this.opportunity.set( opportunity );
        if ( choice !== 'unsure' && !knowledge.saved && knowledge.reason ) this.notifications.show( 'Not saved to Knowledge', knowledge.reason, 'warning' );
      },
      error: () => {
        this.answering.set( '' );
        this.notifications.show( 'Couldn\'t save that', 'Please try again.', 'warning' );
      },
    } );
  }

  draft (): void {
    const o = this.opportunity();
    if ( !o || this.busy() ) return;
    this.busy.set( 'draft' );
    this.service.startProposal( o ).subscribe( {
      next: () => {
        this.busy.set( '' );
        void this.router.navigate( ['/opportunities', o.id, 'proposal'] );
      },
      error: () => {
        this.busy.set( '' );
        this.notifications.show( 'Couldn\'t start the proposal', '16Ahead couldn\'t create the draft. Please try again.', 'warning' );
      },
    } );
  }

  /** Draft anyway: the reason is kept with the opportunity, then drafting starts. */
  draftAnyway (): void {
    const o = this.opportunity();
    const reason = this.draftReason.trim();
    if ( !o || !reason || this.busy() ) return;
    this.busy.set( 'draft' );
    this.service.decide( o.id, { action: 'draft_anyway', reason } ).subscribe( {
      next: ( updated ) => {
        this.busy.set( '' );
        this.opportunity.set( updated );
        this.draftReason = '';
        this.draft();
      },
      error: ( error: unknown ) => {
        this.busy.set( '' );
        this.notifications.show( 'Couldn\'t save the reason', error instanceof HttpErrorResponse && error.error?.message ? error.error.message : 'Please try again.', 'warning' );
      },
    } );
  }

  /** Not for us, or We can't meet this (Missing must-have). */
  noBid ( reason: NoBidReason ): void {
    const o = this.opportunity();
    if ( !o || this.busy() ) return;
    if ( reason === 'Other' && !this.otherPicked() ) {
      this.otherPicked.set( true );
      return;
    }
    const detail = reason === 'Other' ? this.otherDetail.trim() : '';
    if ( reason === 'Other' && !detail ) return;
    this.busy.set( 'no_bid' );
    this.service.decide( o.id, { action: 'no_bid', reason, detail } ).subscribe( {
      next: ( updated ) => {
        this.busy.set( '' );
        this.opportunity.set( updated );
        this.notifications.show( 'Set aside', '16Ahead won\'t show this one again. You can bring it back from here.', 'success' );
        void this.router.navigate( ['/opportunities'] );
      },
      error: () => {
        this.busy.set( '' );
        this.notifications.show( 'Couldn\'t set it aside', 'Please try again.', 'warning' );
      },
    } );
  }

  openPanel ( panel: 'actions' | 'draft_anyway' | 'not_for_us' ): void {
    this.panel.set( panel );
    this.otherPicked.set( false );
  }

  attachRfp (): void {
    const o = this.opportunity();
    if ( o ) void this.router.navigate( ['/upload'], { queryParams: { rfp: 1, opportunity: o.id, back: 'opportunity' } } );
  }

  readRfp (): void {
    const o = this.opportunity();
    if ( !o ) return;
    if ( o.rfpDocumentId ) void this.router.navigate( ['/documents', o.rfpDocumentId] );
    else if ( o.portalUrl ) window.open( o.portalUrl, '_blank', 'noopener' );
  }

  setStatus ( status: Opportunity['status'] ): void {
    const o = this.opportunity();
    if ( !o || this.busy() ) return;
    this.busy.set( status );
    this.service.update( o.id, { status } ).subscribe( {
      next: ( updated ) => {
        this.busy.set( '' );
        this.opportunity.set( updated );
        this.panel.set( 'actions' );
        this.afterLoad( updated );
      },
      error: () => {
        this.busy.set( '' );
        this.notifications.show( 'Couldn\'t update it', 'Please try again.', 'warning' );
      },
    } );
  }
}
