import { Component, OnInit, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DocService } from '../../services/doc.service';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';
import { LoggerService } from '../../services/logger.service';
import { Subscription } from 'rxjs';
import { DocsAuthService } from '../../services/docs-auth.service';
import { Document } from '../../models/document.model';

import { ToddTipComponent } from '../../shared/todd-tip/todd-tip.component';
import { DocsTipService } from '../../services/docs-tip.service';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { DocsPageActionsService } from '../../services/docs-page-actions.service';
import { PageAction } from '../../models/page-actions.models';


/**
 * Ported from features/document/rfp-list-component/rfp-list-component.component.ts,
 * rewritten to go through DocService rather than a direct DataService
 * Firestore read - same reasoning as ProposalHistoryComponent's port note.
 *
 * `generateProposal()` navigated to `/proposal-editor?rfpId=...` in the
 * monorepo, which is not a real route anywhere in that app either (grepped
 * the whole frontend - it only exists as this one dead reference) - a
 * pre-existing bug, not an intentional route this port needs to preserve.
 * Redirected here to `/docs/editor?rfpId=...`, the actual route that reads
 * that query param (DocumentEditorComponent.loadDraftFromOpenAI).
 */
@Component( {
  selector: 'app-rfp-list',
  standalone: true,
  imports: [CommonModule, PreloaderComponent, ToddTipComponent, BackToTopComponent, CockpitBrowseModeBannerComponent],
  templateUrl: './rfp-list.component.html',
  styleUrl: './rfp-list.component.css'
} )
export class RfpListComponent implements OnInit, OnDestroy {
  rfps: any[] = [];
  userId: string | null = null;
  isLoggedIn = false;

  private userSubscription!: Subscription;

  isMobile: boolean = window.innerWidth < 768; // Initialize based on current width
  isSmallScreen: boolean = window.innerWidth < 992;
  isProcessing: boolean = true;

  docTipText: string = '';


  constructor ( private docService: DocService,
    private notificationService: DocsNotificationService,
    private tipService: DocsTipService,
    private router: Router,
    private logger: LoggerService,
    private authService: DocsAuthService,
    private pageActionsService: DocsPageActionsService ) { }

  ngOnInit (): void {
    this.setUpUserID();
    this.docTipText = this.tipService.getRandomTipText( 'documents' );
    this.publishPageActions();

  }

  ngOnDestroy (): void {
    if ( this.userSubscription ) this.userSubscription.unsubscribe();
    this.pageActionsService.clearPageActions( 'rfp-list' );
  }

  setUpUserID (): void {
    this.userSubscription = this.authService.getUserId().subscribe( userId => {
      this.userId = userId || null;
      this.isLoggedIn = !!userId;
      this.loadRfps();
    } );
  }

  deleteRFP ( id: string ) {
    if ( !this.userId ) return;

    this.docService.removeDocument( id, this.userId ).subscribe( {
      next: () => {
        this.notificationService.show( 'SUCCESS', 'RFP ' + id + ' deleted', 'success' );
        this.loadRfps();
      },
      error: () => {
        this.notificationService.show( 'ERROR', 'RFP delete unsuccessful', 'error' );
      }
    } );
  }

  loadRfps (): void {
    if ( !this.userId ) {
      this.rfps = [];
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    this.docService.getDocuments( this.userId ).subscribe( {
      next: ( data: any[] ) => {
        this.rfps = ( data || [] )
          .filter( ( doc: any ) => doc.type === 'rfp' )
          .map( doc => doc as Document );
        this.isProcessing = false;
      },
      error: () => {
        this.isProcessing = false;
        this.logger.error( "Unable to load RFPs" );
      }
    } );
  }

  generateProposal ( rfp: any ): void {
    this.router.navigate( ['/docs/editor'], { queryParams: { rfpId: rfp.id } } );
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
      pageId: 'rfp-list',
      context: {
        pageId: 'rfp-list',
        feature: 'documents',
        entityType: 'rfp',
      },
      actions: this.buildPageActions(),
    } );
  }

  private buildPageActions (): PageAction[] {
    return [
      {
        id: 'rfp-list-response-flow',
        label: 'Response Flow',
        icon: 'fa-solid fa-layer-group',
        kind: 'route',
        route: '/knowledge/response-flow',
        order: 10,
        group: 'context',
      },
      {
        id: 'rfp-list-editor',
        label: 'Editor',
        icon: 'fa-solid fa-file-lines',
        kind: 'route',
        route: '/docs/editor',
        order: 20,
        group: 'context',
      },
      {
        id: 'rfp-list-proposal-history',
        label: 'History',
        icon: 'fa-solid fa-clock-rotate-left',
        kind: 'route',
        route: '/docs/proposal-history',
        order: 30,
        group: 'context',
      },
      {
        id: 'rfp-list-rfp-upload',
        label: 'RFP Upload',
        icon: 'fa-solid fa-upload',
        kind: 'route',
        route: '/docs/rfp-upload',
        order: 40,
        group: 'context',
      },
    ];
  }
}
