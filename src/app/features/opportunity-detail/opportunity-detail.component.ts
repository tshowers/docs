import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { Opportunity, PROPOSAL_STATUS_LABEL, dueLabel, dueLong, fitTint, submitByLabel } from '../../models/opportunity';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { OpportunitiesService } from '../../services/opportunities.service';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';
import { WriteActionDirective } from '../../shared/write-access/write-action.directive';

/**
 * One opportunity (design_handoff_todd_docs 1d): what the agency wants, the
 * facts that decide whether to bid (due, value, page limit, how to submit),
 * what they'll score, and on the right TODD's fit with reasons and gaps,
 * then Draft proposal / Read the RFP / Not for us.
 */
@Component( {
  selector: 'app-opportunity-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, DkIconComponent, WriteActionDirective],
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

  readonly opportunity = signal<Opportunity | null>( null );
  readonly notFound = signal( false );
  readonly busy = signal( '' );

  readonly tint = computed( () => fitTint( this.opportunity()?.fit.score || 0 ) );
  readonly fitHeading = computed( () => {
    const o = this.opportunity();
    if ( !o ) return '';
    if ( o.fit.headline ) return o.fit.headline;
    return o.fit.score >= 85 ? 'Strong fit' : o.fit.score >= 75 ? 'Good fit' : 'Weak fit';
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
  readonly statusLabel = PROPOSAL_STATUS_LABEL;

  ngOnInit (): void {
    this.route.paramMap.pipe( takeUntilDestroyed( this.destroyRef ) ).subscribe( ( params ) => {
      const id = String( params.get( 'id' ) || '' );
      const cached = this.service.opportunities().find( ( o ) => o.id === id );
      this.opportunity.set( cached || null );
      this.notFound.set( false );
      this.service.get( id ).subscribe( {
        next: ( o ) => this.opportunity.set( o ),
        error: () => { if ( !cached ) this.notFound.set( true ); },
      } );
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
        this.notifications.show( 'Couldn\'t start the proposal', 'TODD couldn\'t create the draft. Please try again.', 'warning' );
      },
    } );
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
        if ( status === 'dismissed' ) {
          this.notifications.show( 'Set aside', 'TODD won\'t show this one again.', 'success' );
          void this.router.navigate( ['/opportunities'] );
        }
      },
      error: () => {
        this.busy.set( '' );
        this.notifications.show( 'Couldn\'t update it', 'Please try again.', 'warning' );
      },
    } );
  }
}
