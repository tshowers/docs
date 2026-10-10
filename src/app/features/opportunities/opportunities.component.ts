import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { DocsInbox, FIT_THRESHOLD, Opportunity, PROPOSAL_STATUS_LABEL, dueLabel, fitTint, isOpen } from '../../models/opportunity';
import { DocsAuthService } from '../../services/docs-auth.service';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { OpportunitiesService } from '../../services/opportunities.service';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';
import { WriteActionDirective } from '../../shared/write-access/write-action.directive';

/** "OpenGov, King County and Bonfire" from a sender list. */
export function senderNames ( senders: string[] ): string {
  const names = [...new Set( senders.map( ( sender ) => {
    const domain = sender.split( '@' )[1] || sender;
    if ( domain.endsWith( 'opengov.com' ) ) return 'OpenGov';
    if ( domain.endsWith( 'gobonfire.com' ) ) return 'Bonfire';
    if ( domain.endsWith( 'kingcounty.gov' ) ) return 'King County';
    if ( domain.endsWith( 'bidnet.com' ) || domain.endsWith( 'bidnetdirect.com' ) ) return 'BidNet';
    return domain;
  } ) )];
  if ( names.length <= 1 ) return names[0] || '';
  return `${ names.slice( 0, -1 ).join( ', ' ) } and ${ names[names.length - 1] }`;
}

/** "just now", "5 min ago", "2 hours ago", "Oct 9". */
export function checkedAgo ( iso: string, now = new Date() ): string {
  const at = new Date( iso );
  if ( !iso || isNaN( at.getTime() ) ) return '';
  const minutes = Math.round( ( now.getTime() - at.getTime() ) / 60000 );
  if ( minutes < 1 ) return 'just now';
  if ( minutes < 60 ) return `${ minutes } min ago`;
  if ( minutes < 24 * 60 ) return `${ Math.round( minutes / 60 ) } ${ Math.round( minutes / 60 ) === 1 ? 'hour' : 'hours' } ago`;
  return at.toLocaleDateString( 'en-US', { month: 'short', day: 'numeric' } );
}

/**
 * Opportunities (design_handoff_todd_docs 1a): the RFPs TODD found in the
 * inbox it watches (or that were added by hand), the ones that fit first,
 * each with why it fits and what's missing; the proposals made from them;
 * and the inbox Docs is watching. Replaces RFP list, RFP upload and
 * Proposal History.
 */
@Component( {
  selector: 'app-opportunities',
  standalone: true,
  imports: [CommonModule, RouterModule, DkIconComponent, WriteActionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './opportunities.component.html',
  styleUrl: './opportunities.component.css',
} )
export class OpportunitiesComponent implements OnInit {
  private readonly service = inject( OpportunitiesService );
  private readonly auth = inject( DocsAuthService );
  private readonly router = inject( Router );
  private readonly route = inject( ActivatedRoute );
  private readonly notifications = inject( DocsNotificationService );
  private readonly destroyRef = inject( DestroyRef );

  readonly signedIn = signal<boolean | null>( null );
  readonly inboxes = signal<DocsInbox[] | null>( null );
  readonly showSetAside = signal( false );
  readonly drafting = signal( '' );
  readonly loaded = this.service.loaded;
  readonly today = new Date();

  private readonly open = computed( () => this.service.opportunities().filter( ( o ) => o.status === 'new' && isOpen( o ) ) );
  readonly fits = computed( () => this.open().filter( ( o ) => o.fit.score >= FIT_THRESHOLD ).sort( ( a, b ) => b.fit.score - a.fit.score ) );
  readonly setAside = computed( () => this.open().filter( ( o ) => o.fit.score < FIT_THRESHOLD ).sort( ( a, b ) => b.fit.score - a.fit.score ) );
  readonly proposals = computed( () => this.service.opportunities().filter( ( o ) => ['drafting', 'submitted', 'won', 'lost'].includes( o.status ) ) );
  readonly watched = computed( () => ( this.inboxes() || [] ).filter( ( inbox ) => inbox.purposes.includes( 'rfp' ) ) );
  readonly failing = computed( () => this.watched().find( ( inbox ) => inbox.rfpLastSyncStatus === 'failed' ) || null );

  readonly headline = computed( () => {
    const n = this.fits().length;
    if ( n === 0 ) return 'No new RFPs fit right now.';
    return `${ n === 1 ? 'One new RFP fits' : `${ n } new RFPs fit` } what you do.`;
  } );

  readonly toddLine = computed( () => {
    const read = this.open().length;
    const aside = this.setAside().length;
    if ( !this.watched().length && !read ) return 'Connect the inbox where your RFP alerts arrive and I\'ll read each one, score it against your profile and tell you which are worth answering.';
    if ( !read ) return 'I check your inbox every 10 minutes. New RFP alerts show up here, scored against your profile.';
    if ( !aside ) return `I read ${ read } open ${ read === 1 ? 'RFP' : 'RFPs' } and every one fits your profile.`;
    return `I read ${ read } open ${ read === 1 ? 'RFP' : 'RFPs' } and set aside ${ aside } that ${ aside === 1 ? 'doesn\'t' : 'don\'t' } match your profile.`;
  } );

  readonly visibleCards = computed( () => this.showSetAside() ? [...this.fits(), ...this.setAside()] : this.fits() );

  readonly fitTint = fitTint;
  readonly dueLabel = dueLabel;
  readonly statusLabel = PROPOSAL_STATUS_LABEL;
  readonly senderNames = senderNames;
  readonly checkedAgo = checkedAgo;

  ngOnInit (): void {
    this.auth.isLoggedIn().pipe( takeUntilDestroyed( this.destroyRef ) ).subscribe( ( signedIn ) => {
      this.signedIn.set( !!signedIn );
      if ( !signedIn ) return;
      this.service.load( true ).pipe( takeUntilDestroyed( this.destroyRef ) ).subscribe();
      this.service.listInboxes().pipe( takeUntilDestroyed( this.destroyRef ) ).subscribe( {
        next: ( inboxes ) => this.inboxes.set( inboxes ),
        error: () => this.inboxes.set( [] ),
      } );
    } );
    // Back from Google's sign-in (mailbox-oauth.service buildReturnUrl, client "docs").
    const params = this.route.snapshot.queryParamMap;
    const status = params.get( 'inboxConnect' );
    if ( status ) {
      if ( status === 'success' ) this.notifications.show( 'Inbox connected', 'TODD will check it for RFP alerts every 10 minutes.', 'success' );
      else this.notifications.show( 'Inbox not connected', params.get( 'inboxMessage' ) || 'Google sign-in didn\'t finish. Try again.', 'warning' );
      void this.router.navigate( [], { relativeTo: this.route, queryParams: { inboxConnect: null, inboxMessage: null }, queryParamsHandling: 'merge', replaceUrl: true } );
      if ( status === 'success' ) void this.router.navigate( ['/opportunities/inbox'] );
    }
  }

  draft ( opportunity: Opportunity ): void {
    if ( this.drafting() ) return;
    this.drafting.set( opportunity.id );
    this.service.startProposal( opportunity ).subscribe( {
      next: ( proposalId ) => {
        this.drafting.set( '' );
        void this.router.navigate( ['/docs/editor', proposalId] );
      },
      error: () => {
        this.drafting.set( '' );
        this.notifications.show( 'Couldn\'t start the proposal', 'TODD couldn\'t create the draft. Please try again.', 'warning' );
      },
    } );
  }

  trackById ( _index: number, item: Opportunity ): string {
    return item.id;
  }
}
