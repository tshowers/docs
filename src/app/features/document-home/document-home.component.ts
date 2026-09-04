import { CommonModule } from '@angular/common';
import { Component, inject, AfterViewInit, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Router, RouterModule } from '@angular/router';

import { DocsAssistantSignalService } from '../../services/docs-assistant-signal.service';
import { DocsEntitlementService } from '../../services/docs-entitlement.service';
import { DocsAuthService } from '../../services/docs-auth.service';
import { DocsPageActionsService } from '../../services/docs-page-actions.service';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { getModuleInstallConfig } from '../../shared/utils/module-install-config.util';
import { DocService } from '../../services/doc.service';
import { Document } from '../../models/document.model';
import { ArcGaugeComponent, ArcGaugeTone } from '../../shared/arc-gauge/arc-gauge.component';
import { BusinessSymptom } from '../../models/business-symptom.model';
import { CockpitCommandDeckComponent, CockpitCommandDeckLink } from '../../shared/cockpit-command-deck/cockpit-command-deck.component';
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';
import { PageAction } from '../../models/page-actions.models';
import { StatusLedComponent } from '../../shared/status-led/status-led.component';
import { buildCockpitDiagnosisRows, CockpitDiagnosisRowVm } from '../../shared/utils/cockpit-diagnosis-board.util';

/**
 * Ported from features/document/document-home/document-home.component.ts -
 * this is the real /docs home page (DocumentHomeComponent), the same way
 * web-products/network's ContactHomeComponent is the real /app home for
 * that app. Route targets are rewritten for this app's own route tree
 * (`/knowledge-base` -> `/knowledge`, `/documents` -> `/docs/documents`,
 * `/document` -> `/docs/upload`, `/response-flow` -> `/knowledge/response-flow`,
 * `/proposal-history` -> `/docs/proposal-history`, `/document-editor` ->
 * `/docs/editor`). What's dropped: ToddAssistantBusService's signalState$
 * subscription (this app doesn't carry TODD's assistant bus - see
 * DocsAssistantSignalService), same as every other cockpit page ported
 * from web-products/network.
 */
@Component( {
  selector: 'app-document-home',
  standalone: true,
  imports: [CommonModule, RouterModule, BackToTopComponent, ArcGaugeComponent, CockpitCommandDeckComponent, CockpitBrowseModeBannerComponent, StatusLedComponent],
  templateUrl: './document-home.component.html',
  styleUrl: './document-home.component.css'
} )
export class DocumentHomeComponent implements OnInit, AfterViewInit, OnDestroy {
  documents: Document[] = [];
  isLoggedIn = false;
  totalDocumentCount = 0;
  proposalCount = 0;
  draftCount = 0;
  duplicateTitleCount = 0;
  staleDocumentCount = 0;
  responseReadyCount = 0;
  knowledgeMetersVm: Array<{ id: string; label: string; value: number; tone: ArcGaugeTone; detail: string; }> = [];
  knowledgeSymptomsVm: BusinessSymptom[] = [];
  diagnosisRowsVm: CockpitDiagnosisRowVm[] = [];
  knowledgeScoreVm = 0;
  knowledgeStatusVm = 'TODD is standing by. Connect Docs to light up knowledge diagnosis, treatment, relief, and proof.';
  readonly knowledgeCommandDeckLinks: CockpitCommandDeckLink[] = [
    { label: 'Knowledge Base', icon: 'book', routerLink: '/knowledge' },
    { label: 'Documents', icon: 'file-lines', routerLink: '/docs/documents' },
    { label: 'Add Document', icon: 'file-circle-plus', routerLink: '/docs/upload' },
    { label: 'Response Flows', icon: 'route', routerLink: '/knowledge/response-flow' },
    { label: 'Proposal History', icon: 'clock-rotate-left', routerLink: '/docs/proposal-history' }
  ];

  readonly installConfig = getModuleInstallConfig( 'docs' );
  readonly entitlements$ = inject( DocsEntitlementService ).getEntitlements();
  userId: string | null = null;
  private userIdSubscription!: Subscription;
  private documentSubscription?: Subscription;

  constructor (
    private assistantBus: DocsAssistantSignalService,
    private authService: DocsAuthService,
    private docService: DocService,
    private router: Router,
    private pageActionsService: DocsPageActionsService
  ) { }

  ngOnInit (): void {
    this.trace( 'init' );
    this.userIdSubscription = this.authService.getUserId().subscribe( id => {
      this.userId = id || null;
      this.trace( 'auth:userId', { userIdPresent: !!this.userId } );
      this.loadDocuments();
      this.refreshDiagnosticsVm();
    } );
    this.refreshDiagnosticsVm();
    this.publishPageActions();
  }

  ngAfterViewInit (): void {
    window.scrollTo( 0, 0 );
  }

  ngOnDestroy (): void {
    if ( this.userIdSubscription ) this.userIdSubscription.unsubscribe();
    this.documentSubscription?.unsubscribe();
    this.pageActionsService.clearPageActions( 'document-home-cockpit' );
    this.assistantBus.clearPageContext();
  }

  private publishPageActions (): void {
    this.pageActionsService.setPageActions( {
      pageId: 'document-home-cockpit',
      context: {
        pageId: 'document-home-cockpit',
        feature: 'documents',
        entityType: 'document',
        mode: 'dashboard'
      },
      actions: this.buildPageActions()
    } );
  }

  private buildPageActions (): PageAction[] {
    return [
      {
        id: 'document-cockpit-knowledge-base',
        label: 'Knowledge Base',
        icon: 'fa-solid fa-brain',
        kind: 'route',
        route: '/knowledge',
        order: 10,
        group: 'context'
      },
      {
        id: 'document-cockpit-documents',
        label: 'Documents',
        icon: 'fa-solid fa-folder-open',
        kind: 'route',
        route: '/docs/documents',
        order: 20,
        group: 'context'
      },
      {
        id: 'document-cockpit-add-document',
        label: 'Add Document',
        icon: 'fa-solid fa-file-circle-plus',
        kind: 'route',
        route: '/docs/upload',
        order: 30,
        group: 'context'
      },
      {
        id: 'document-cockpit-response-flows',
        label: 'Response Flows',
        icon: 'fa-solid fa-diagram-project',
        kind: 'route',
        route: '/knowledge/response-flow',
        order: 40,
        group: 'context'
      },
      {
        id: 'document-cockpit-proposal-history',
        label: 'Proposal History',
        icon: 'fa-solid fa-clock-rotate-left',
        kind: 'route',
        route: '/docs/proposal-history',
        order: 50,
        group: 'context'
      }
    ];
  }

  private buildKnowledgeHealthMeters (): Array<{ id: string; label: string; value: number; tone: ArcGaugeTone; detail: string; }> {
    const docBase = this.totalDocumentCount || 1;
    const duplicatePressure = Math.round( ( this.duplicateTitleCount / docBase ) * 100 );
    const stalePressure = Math.round( ( this.staleDocumentCount / docBase ) * 100 );
    const proposalCoverage = Math.round( ( this.proposalCount / docBase ) * 100 );
    const draftPressure = Math.round( ( this.draftCount / docBase ) * 100 );

    return [
      {
        id: 'findability-health',
        label: 'Findability health',
        value: this.isLoggedIn ? Math.max( 0, 100 - duplicatePressure ) : 0,
        tone: this.isLoggedIn ? this.toneFromPercent( duplicatePressure, true ) : 'info',
        detail: this.isLoggedIn
          ? `${this.duplicateTitleCount} document${this.duplicateTitleCount === 1 ? '' : 's'} appear to share duplicate titles.`
          : 'Findability health appears after sign-in.'
      },
      {
        id: 'knowledge-freshness',
        label: 'Knowledge freshness',
        value: this.isLoggedIn ? Math.max( 0, 100 - stalePressure ) : 0,
        tone: this.isLoggedIn ? this.toneFromPercent( stalePressure, true ) : 'info',
        detail: this.isLoggedIn
          ? `${this.staleDocumentCount} document${this.staleDocumentCount === 1 ? '' : 's'} have not been updated in at least 90 days.`
          : 'Knowledge freshness appears after sign-in.'
      },
      {
        id: 'proposal-reuse',
        label: 'Proposal reuse',
        value: this.isLoggedIn ? proposalCoverage : 0,
        tone: this.isLoggedIn ? this.toneFromPercent( proposalCoverage, false ) : 'info',
        detail: this.isLoggedIn
          ? `${this.proposalCount} proposal document${this.proposalCount === 1 ? '' : 's'} are available for reuse.`
          : 'Proposal reuse appears after sign-in.'
      },
      {
        id: 'capture-readiness',
        label: 'Capture readiness',
        value: this.isLoggedIn ? Math.max( 0, 100 - draftPressure ) : 0,
        tone: this.isLoggedIn ? this.toneFromPercent( draftPressure, true ) : 'info',
        detail: this.isLoggedIn
          ? `${this.draftCount} draft knowledge asset${this.draftCount === 1 ? '' : 's'} still need to be finalized or organized.`
          : 'Capture readiness appears after sign-in.'
      }
    ];
  }

  private buildKnowledgeScore ( meters: Array<{ id: string; label: string; value: number; tone: ArcGaugeTone; detail: string; }> ): number {
    if ( meters.length === 0 ) return 0;
    return Math.round( meters.reduce( ( sum, meter ) => sum + meter.value, 0 ) / meters.length );
  }

  private buildKnowledgeAppStatus (): string {
    if ( !this.isLoggedIn ) {
      return 'TODD is standing by. Connect Docs to light up knowledge diagnosis, treatment, relief, and proof.';
    }

    if ( this.totalDocumentCount > 0 ) {
      return `TODD is watching ${this.totalDocumentCount} knowledge asset${this.totalDocumentCount === 1 ? '' : 's'} for findability, freshness, and reuse leverage.`;
    }

    return 'TODD is ready to capture the next document so business knowledge stops living in scattered files.';
  }

  private buildVisibleKnowledgeSymptoms (): BusinessSymptom[] {
    if ( !this.isLoggedIn ) {
      return this.guestKnowledgeSymptoms;
    }

    return [
      {
        id: 'knowledge-hard-to-find',
        title: 'Information is hard to find',
        description: 'When documents share the same titles or lack a clear retrieval pattern, useful knowledge disappears into the library.',
        severity: this.duplicateTitleCount >= 4 ? 'high' : this.duplicateTitleCount >= 1 ? 'medium' : 'low',
        reliefStatus: this.duplicateTitleCount > 0 ? 'todd-working' : 'relief-delivered',
        evidence: [
          {
            label: 'Duplicate titles',
            value: String( this.duplicateTitleCount ),
            detail: this.duplicateTitleCount > 0
              ? `${this.duplicateTitleCount} document${this.duplicateTitleCount === 1 ? '' : 's'} appear to collide on title naming.`
              : 'No duplicate title pressure is visible right now.'
          }
        ],
        toddActions: [
          {
            label: 'Keep the library navigable',
            detail: 'TODD uses the knowledge library, editor, and response-flow surfaces together so repeated assets are easier to identify and reuse.'
          }
        ],
        progress: {
          summary: this.responseReadyCount > 0
            ? `${this.responseReadyCount} knowledge asset${this.responseReadyCount === 1 ? '' : 's'} are already available to support proposals or reusable answers.`
            : 'No reusable knowledge assets are visible yet.'
        },
        outcome: {
          label: 'Reusable assets',
          value: String( this.responseReadyCount ),
          detail: this.responseReadyCount > 0
            ? 'These assets are the base TODD can pull from instead of starting from a blank page.'
            : 'Proof begins when documents are captured.',
          observed: this.responseReadyCount > 0
        },
        trend: this.duplicateTitleCount > 0 ? 'stable' : 'improving',
        module: 'docs'
      },
      {
        id: 'knowledge-going-stale',
        title: 'Knowledge is going stale',
        description: 'Old documents stop helping when no one can tell whether the language still reflects the current business.',
        severity: this.staleDocumentCount >= 6 ? 'high' : this.staleDocumentCount >= 1 ? 'medium' : 'low',
        reliefStatus: this.staleDocumentCount > 0 ? 'watching' : 'relief-delivered',
        evidence: [
          {
            label: 'Stale assets',
            value: String( this.staleDocumentCount ),
            detail: this.staleDocumentCount > 0
              ? `${this.staleDocumentCount} document${this.staleDocumentCount === 1 ? '' : 's'} have not been updated in at least 90 days.`
              : 'No aging document pressure is currently visible.'
          }
        ],
        toddActions: [
          {
            label: 'Surface old business memory',
            detail: 'TODD keeps older assets visible in the knowledge system so they can be reviewed before outdated language silently spreads.'
          }
        ],
        progress: {
          summary: this.proposalCount > 0
            ? `${this.proposalCount} proposal asset${this.proposalCount === 1 ? '' : 's'} are already stored as reusable business proof.`
            : 'No proposal assets are yet available as proof of reusable knowledge.'
        },
        outcome: {
          label: 'Proposal assets',
          value: String( this.proposalCount ),
          detail: this.proposalCount > 0
            ? 'Stored proposal work gives TODD something concrete to reuse and compare.'
            : 'Proof appears after proposals are added to the system.',
          observed: this.proposalCount > 0
        },
        trend: this.staleDocumentCount > 0 ? 'declining' : 'stable',
        module: 'docs'
      },
      {
        id: 'knowledge-stuck-in-draft',
        title: 'Knowledge is stuck in draft mode',
        description: 'Drafts capture useful thinking, but they do not relieve business friction until they become reusable assets.',
        severity: this.draftCount >= 5 ? 'high' : this.draftCount >= 1 ? 'medium' : 'low',
        reliefStatus: this.draftCount > 0 ? 'needs-user-decision' : 'watching',
        evidence: [
          {
            label: 'Draft assets',
            value: String( this.draftCount ),
            detail: this.draftCount > 0
              ? `${this.draftCount} draft document${this.draftCount === 1 ? '' : 's'} still need to be completed or organized.`
              : 'No draft knowledge assets are waiting right now.'
          }
        ],
        toddActions: [
          {
            label: 'Prepare assets for reuse',
            detail: 'TODD keeps drafts, editor work, and response flows close together so unfinished knowledge can be turned into reusable answers faster.'
          }
        ],
        progress: {
          summary: this.totalDocumentCount > 0
            ? `${this.totalDocumentCount} total knowledge asset${this.totalDocumentCount === 1 ? '' : 's'} are already in the system and can be organized into stronger reuse patterns.`
            : 'No knowledge assets exist yet, so there is nothing to operationalize.'
        },
        outcome: {
          label: 'Knowledge inventory',
          value: String( this.totalDocumentCount ),
          detail: this.totalDocumentCount > 0
            ? 'Saved inventory is the starting point for compounding business memory.'
            : 'Proof begins after the first document is saved.',
          observed: this.totalDocumentCount > 0
        },
        trend: this.draftCount > 0 ? 'stable' : 'improving',
        module: 'docs',
        requiresUserAction: this.draftCount > 0,
        userActionLabel: this.draftCount > 0 ? 'Open Document Editor' : undefined,
        userActionRoute: this.draftCount > 0 ? '/docs/editor' : null
      }
    ];
  }

  private readonly guestKnowledgeSymptoms: BusinessSymptom[] = [
    {
      id: 'guest-knowledge-hard-to-find',
      title: 'Information is hard to find',
      description: 'Knowledge only compounds when prior proposals, notes, and reusable language can be found at the moment they are needed.',
      severity: 'medium',
      reliefStatus: 'insufficient-information',
      evidence: [
        {
          label: 'Duplicate titles',
          value: '0',
          detail: 'Findability pressure appears once real documents are connected.'
        }
      ],
      toddActions: [
        {
          label: 'Stand by for knowledge retrieval',
          detail: 'TODD will monitor the document library once the knowledge system is connected to live assets.'
        }
      ],
      progress: { summary: 'Preview mode shows the same knowledge cockpit, but live inventory and duplicate pressure stay dark.' },
      outcome: {
        label: 'Reusable assets',
        value: '0',
        detail: 'Proof appears after documents are saved.',
        observed: false
      },
      trend: 'unknown',
      module: 'docs'
    },
    {
      id: 'guest-knowledge-going-stale',
      title: 'Knowledge is going stale',
      description: 'Old content creates hidden risk when nobody can see which assets still represent the business accurately.',
      severity: 'low',
      reliefStatus: 'watching',
      evidence: [
        {
          label: 'Stale assets',
          value: '0',
          detail: 'Freshness pressure appears after live documents are connected.'
        }
      ],
      toddActions: [
        {
          label: 'Watch business memory age',
          detail: 'TODD will track which saved assets are aging so stale language does not silently become default language.'
        }
      ],
      progress: { summary: 'Guests see the same customer-style cockpit grammar, but freshness values stay at zero until sign-in.' },
      outcome: {
        label: 'Proposal assets',
        value: '0',
        detail: 'Proof begins after proposals enter the system.',
        observed: false
      },
      trend: 'unknown',
      module: 'docs'
    },
    {
      id: 'guest-knowledge-stuck-in-draft',
      title: 'Knowledge is stuck in draft mode',
      description: 'Draft knowledge is not yet helping sales, delivery, or follow-up until it becomes reusable business memory.',
      severity: 'low',
      reliefStatus: 'insufficient-information',
      evidence: [
        {
          label: 'Draft assets',
          value: '0',
          detail: 'Draft pressure appears after live documents are connected.'
        }
      ],
      toddActions: [
        {
          label: 'Prepare the next reusable asset',
          detail: 'TODD will connect drafts, proposals, and response flows once the system has live knowledge to work with.'
        }
      ],
      progress: { summary: 'Guests see the same knowledge board, but inventory and proof stay dark until sign-in.' },
      outcome: {
        label: 'Knowledge inventory',
        value: '0',
        detail: 'Inventory turns on with live data.',
        observed: false
      },
      trend: 'unknown',
      module: 'docs'
    }
  ];

  private loadDocuments (): void {
    this.documentSubscription?.unsubscribe();

    if ( !this.userId ) {
      this.documents = [];
      this.trace( 'documents:guest-mode' );
      this.refreshDiagnosticsVm();
      return;
    }

    this.trace( 'documents:load:start' );
    this.documentSubscription = this.docService.getDocuments( this.userId ).subscribe( {
      next: documents => {
        this.documents = Array.isArray( documents ) ? documents as Document[] : [];
        this.trace( 'documents:load:next', { count: this.documents.length } );
        this.refreshDiagnosticsVm();
      },
      error: () => {
        this.documents = [];
        this.trace( 'documents:load:error' );
        this.refreshDiagnosticsVm();
      }
    } );
  }

  trackById ( _index: number, item: { id: string; } ): string {
    return item.id;
  }

  private normalizedType ( document: Document ): string {
    return String( document?.type || '' ).trim().toLowerCase();
  }

  private isDraftStatus ( document: Document ): boolean {
    return String( document?.status || '' ).trim().toLowerCase() === 'draft';
  }

  private normalizedDocumentTitle ( document: Document ): string {
    return String( document?.title || document?.name || '' ).trim().toLowerCase();
  }

  private documentTimestamp ( document: Document ): number {
    const raw = document?.updatedAt || document?.createdAt || document?.uploadDate || '';
    const time = raw ? new Date( raw ).getTime() : Number.NaN;
    return Number.isFinite( time ) ? time : 0;
  }

  private toneFromPercent ( percent: number, inverse: boolean ): ArcGaugeTone {
    const score = inverse ? 100 - percent : percent;
    if ( score >= 75 ) return 'positive';
    if ( score >= 45 ) return 'attention';
    return 'warn';
  }

  private refreshDiagnosticsVm (): void {
    this.isLoggedIn = !!this.userId;
    this.totalDocumentCount = this.documents.length;
    this.proposalCount = this.documents.filter( document => this.normalizedType( document ) === 'proposal' ).length;
    this.draftCount = this.documents.filter( document => {
      const type = this.normalizedType( document );
      return type === 'draft' || this.isDraftStatus( document );
    } ).length;

    const titleCounts = new Map<string, number>();
    this.documents.forEach( document => {
      const title = this.normalizedDocumentTitle( document );
      if ( !title ) return;
      titleCounts.set( title, ( titleCounts.get( title ) || 0 ) + 1 );
    } );
    let duplicates = 0;
    titleCounts.forEach( count => {
      if ( count > 1 ) duplicates += count;
    } );
    this.duplicateTitleCount = duplicates;

    const staleThreshold = Date.now() - ( 1000 * 60 * 60 * 24 * 90 );
    this.staleDocumentCount = this.documents.filter( document => {
      const updatedAt = this.documentTimestamp( document );
      return updatedAt > 0 && updatedAt < staleThreshold;
    } ).length;

    this.responseReadyCount = this.documents.filter( document => {
      const type = this.normalizedType( document );
      return type === 'proposal' || type === 'document' || type === 'draft';
    } ).length;

    this.knowledgeMetersVm = this.buildKnowledgeHealthMeters();
    this.knowledgeScoreVm = this.buildKnowledgeScore( this.knowledgeMetersVm );
    this.knowledgeStatusVm = this.buildKnowledgeAppStatus();
    this.knowledgeSymptomsVm = this.buildVisibleKnowledgeSymptoms();
    this.diagnosisRowsVm = buildCockpitDiagnosisRows( this.knowledgeSymptomsVm );
    this.publishPageContext();
    this.trace( 'vm:refreshed', {
      loggedIn: this.isLoggedIn,
      documents: this.documents.length,
      meters: this.knowledgeMetersVm.length,
      symptoms: this.knowledgeSymptomsVm.length
    } );
  }

  private publishPageContext (): void {
    this.assistantBus.setPageContext( {
      feature: 'documents',
      page: 'document-home',
      route: this.router.url || '/docs',
      mode: 'dashboard',
      title: 'Knowledge',
      description: 'See what proof is missing, what TODD is organizing, what relief is visible, and what reusable knowledge is compounding.',
      allowedActions: [
        'open_documents_library',
        'add_document',
        'open_response_flow',
        'open_proposal_history'
      ],
      summary: {
        isAuthenticated: this.isLoggedIn,
        interactionMode: this.isLoggedIn ? 'member' : 'guest',
        totalDocumentCount: this.totalDocumentCount,
        proposalCount: this.proposalCount,
        draftCount: this.draftCount,
        duplicateTitleCount: this.duplicateTitleCount,
        staleDocumentCount: this.staleDocumentCount,
        responseReadyCount: this.responseReadyCount,
        knowledgeScore: this.knowledgeScoreVm
      },
      dataPreview: {
        appStatus: this.knowledgeStatusVm,
        documentsRoute: '/docs/documents',
        addDocumentRoute: '/docs/upload',
        documentEditorRoute: '/docs/editor',
        responseFlowRoute: '/knowledge/response-flow',
        proposalHistoryRoute: '/docs/proposal-history'
      }
    } );
  }

  private trace ( event: string, detail?: Record<string, unknown> ): void {
    if ( typeof console === 'undefined' ) return;
    console.debug( '[DocumentHome]', event, detail || {} );
  }

}
