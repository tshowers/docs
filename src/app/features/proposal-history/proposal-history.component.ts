import { Component, OnInit, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocService } from '../../services/doc.service';

import { Router } from '@angular/router';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { LoggerService } from '../../services/logger.service';
import { Subscription } from 'rxjs';
import { DocsAuthService } from '../../services/docs-auth.service';
import { Document } from '../../models/document.model';
import { ToddTipComponent } from '../../shared/todd-tip/todd-tip.component';
import { DocsTipService } from '../../services/docs-tip.service';
import { DocsPageActionsService } from '../../services/docs-page-actions.service';
import { PageAction } from '../../models/page-actions.models';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';

interface ProposalEntry {
  id?: string;
  title: string;
  agency: string;
  dueDate: string;
  draftPath?: string;
  status?: string;
  proposal?: Document;
}

/**
 * Ported from features/document/proposal-history-component/proposal-history-component.component.ts.
 *
 * The monorepo original reads via `DataService.getCollectionData('DOCUMENTS', userId)` /
 * `addDocument('DOCUMENTS', ...)` - a direct Firestore path that bypasses
 * DocService entirely. Every other Docs page ported into this app
 * (document-home, document-list, general-document-upload, document-editor)
 * goes through DocService's `${backendURL}/docs` REST endpoints instead,
 * and porting the monorepo's full multi-thousand-line DataService just for
 * this one page's collection read isn't worth it. This is rewritten to use
 * DocService.getDocuments()/.createDocument() - same underlying tenant
 * document set, same filtering logic (type === 'rfp' / 'proposal'), just a
 * consistent data path with the rest of this app.
 */
@Component( {
  selector: 'app-proposal-history',
  standalone: true,
  imports: [CommonModule, PreloaderComponent, BackToTopComponent, ToddTipComponent, CockpitBrowseModeBannerComponent],
  templateUrl: './proposal-history.component.html',
  styleUrl: './proposal-history.component.css'
} )
export class ProposalHistoryComponent implements OnInit, OnDestroy {

  proposalList: ProposalEntry[] = [];

  isMobile: boolean = window.innerWidth < 768;
  isSmallScreen: boolean = window.innerWidth < 992;
  isProcessing: boolean = true;

  userId: string | null = null;

  docTipText: string = '';

  private userSubscription!: Subscription;

  constructor (
    private router: Router,
    private tipService: DocsTipService,
    private logger: LoggerService,
    private authService: DocsAuthService,
    private docService: DocService,
    private pageActionsService: DocsPageActionsService,
    private notificationService: DocsNotificationService
  ) { }

  ngOnInit (): void {
    this.setUpUserID();
    this.docTipText = this.tipService.getRandomTipText( 'documents' );
    this.publishPageActions();

  }

  ngOnDestroy (): void {
    if ( this.userSubscription ) this.userSubscription.unsubscribe();
    this.pageActionsService.clearPageActions( 'proposal-history' );
  }

  setUpUserID (): void {
    this.userSubscription = this.authService.getUserId().subscribe( userId => {
      this.userId = userId || null;
      this.loadRfpList();
    } );
  }

  loadRfpList () {
    if ( !this.userId ) {
      this.proposalList = [];
      this.isProcessing = false;
      return;
    }

    this.docService.getDocuments( this.userId ).subscribe( {
      next: ( docs: any[] ) => {
        const rfps = ( docs || [] ).filter( doc => doc.type === 'rfp' );
        const proposals = ( docs || [] ).filter( doc => doc.type === 'proposal' );

        this.proposalList = rfps.map( rfp => {
          const linkedProposal = proposals.find( p => p.rfpId === rfp.id );
          return {
            id: rfp.id,
            title: rfp.title || 'Untitled',
            agency: rfp.author || 'Unknown Agency',
            dueDate: rfp.dueDate || '',
            draftPath: linkedProposal?.src || '',
            status: linkedProposal?.status || 'Not Started',
            proposal: linkedProposal
          };
        } );

        this.isProcessing = false;
      },
      error: ( error ) => {
        this.logger.error( 'Error loading proposal history:', error );
        this.proposalList = [];
        this.isProcessing = false;
      }
    } );

  }

  async generateProposal ( proposal: ProposalEntry ) {
    if ( !this.userId ) {
      this.notificationService.show( 'Sign In Required', 'Sign in to generate proposals from your documents.', 'warning' );
      return;
    }

    const newProposal = {
      rfpId: proposal.id,
      title: proposal.title,
      agency: proposal.agency,
      dueDate: proposal.dueDate,
      type: 'proposal',
      sections: [],
      status: 'Draft',
      created: new Date().toISOString()
    };

    this.docService.createDocument( newProposal, this.userId ).subscribe( {
      next: ( created: any ) => {
        this.logger.log( 'Proposal created with ID:', created?.id );
      },
      error: ( error ) => {
        this.logger.error( 'Failed to create proposal:', error );
      }
    } );
  }

  @HostListener( 'window:resize', ['$event'] )
  onResize ( event: any ) {
    this.isSmallScreen = window.innerWidth < 992;
    this.isMobile = window.innerWidth < 768;
  }

  onClickRoute ( goto: string ) {
    const [path, fragment] = goto.split( '#' );
    this.router.navigate( [path], { fragment } );
  }

  private publishPageActions (): void {
    this.pageActionsService.setPageActions( {
      pageId: 'proposal-history',
      context: {
        pageId: 'proposal-history',
        feature: 'documents',
        entityType: 'proposal'
      },
      actions: this.buildPageActions()
    } );
  }

  private buildPageActions (): PageAction[] {
    return [
      {
        id: 'proposal-history-response-flow',
        label: 'Response Flow',
        icon: 'fa-solid fa-layer-group',
        kind: 'route',
        route: '/knowledge/response-flow',
        order: 10,
        group: 'context'
      },
      {
        id: 'proposal-history-editor',
        label: 'Editor',
        icon: 'fa-solid fa-file-lines',
        kind: 'route',
        route: '/docs/editor',
        order: 20,
        group: 'context'
      },
      {
        id: 'proposal-history-rfp-upload',
        label: 'RFP Upload',
        icon: 'fa-solid fa-upload',
        kind: 'route',
        route: '/docs/rfp-upload',
        order: 30,
        group: 'context'
      },
      {
        id: 'proposal-history-rfps',
        label: 'RFPs',
        icon: 'fa-solid fa-folder-open',
        kind: 'route',
        route: '/docs/rfp-list',
        order: 40,
        group: 'context'
      },
    ];
  }
}
