import { Component, OnInit, OnDestroy, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocsAuthService } from '../../services/docs-auth.service';
import { LoggerService } from '../../services/logger.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, Observable, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, startWith } from 'rxjs/operators';
import { DocsAssistantSignalService } from '../../services/docs-assistant-signal.service';

import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';

import { TruncatePipe } from '../../pipes/truncate.pipe';
import { ResourceWhyPipe } from '../../pipes/resource-why.pipe';
import { DomainPipe } from '../../pipes/domain.pipe';
import { FaviconPipe } from '../../pipes/favicon.pipe';

import { Answer } from '../response-flow/response-flow.component';
import { ToddTipComponent } from '../../shared/todd-tip/todd-tip.component';
import { DocsTipService } from '../../services/docs-tip.service';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { DocsPageActionsService } from '../../services/docs-page-actions.service';
import { DocsEntitlementService } from '../../services/docs-entitlement.service';
import { buildDocumentPageActions } from '../../shared/utils/page-action-presets';
import { ClickSoundDirective } from '../../shared/directives/click-sound.directive';
import { ModuleInstallCtaComponent } from '../../shared/module-install-cta/module-install-cta.component';
import { getModuleInstallConfig } from '../../shared/utils/module-install-config.util';
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';
import { ResponseFlowService } from '../../services/response-flow.service';

export interface RepoDocument { name: string; src: string; type?: string; }
export interface Recommendation { text: string; link: string; type: string; document?: RepoDocument; }
export interface Resource { link: string; }
export interface ResponseFlowRecord {
  id?: string;
  userId?: string;
  question: string;
  category?: string;
  type?: string;
  answers: Answer[];
  recommendations: Recommendation[];
  resources: Resource[];
  keywords: string[];
}

/**
 * Ported from features/knowledge/repository/repository.component.ts - the
 * Knowledge Base browse/search list (the `/knowledge` route, guarded in
 * the monorepo by `featureGateGuard('knowledge')`; this app doesn't carry
 * that route-guard infra, entitlement gating instead happens the same way
 * every other page here handles it - via `entitlements$` in the template).
 *
 * Drops TopDogComponent inheritance for the same auth-context-watching
 * pattern used throughout this app (`restrictedUser` hardcoded to false,
 * matching what TopDogComponent's own checkUserMore() always resolved to
 * for a non-SayIt app like this one anyway). ToddAssistantBusService's
 * signalState$ subscription is dropped; emitAssistantActivity/
 * setPageContext calls are kept as harmless no-ops through
 * DocsAssistantSignalService, same as ContactHomeComponent's precedent.
 *
 * `DataService.getRealtimeData('RESPONSE_FLOW', userId)` (a live Firestore
 * listener) is replaced with `ResponseFlowService.getResponseFlows()` (a
 * one-shot REST call, same as every other Docs/Knowledge page here) fed
 * through a BehaviorSubject that's re-fetched after a successful delete -
 * so the list still refreshes on data changes made through this page,
 * just not from changes made elsewhere while it's open.
 */
@Component( {
  selector: 'app-repository',
  imports: [CommonModule, FormsModule, PreloaderComponent,
    BackToTopComponent,
    TruncatePipe,
    ResourceWhyPipe,
    DomainPipe,
    ToddTipComponent,
    FaviconPipe,
    RouterLink, ClickSoundDirective, ModuleInstallCtaComponent, CockpitBrowseModeBannerComponent],
  templateUrl: './repository.component.html',
  styleUrl: './repository.component.css'
} )
export class RepositoryComponent implements OnInit, OnDestroy, AfterViewInit {
  readonly installConfig = getModuleInstallConfig( 'knowledge' );
  private readonly pageActionsService = inject( DocsPageActionsService );
  readonly entitlements$ = inject( DocsEntitlementService ).getEntitlements();

  private readonly knowledgeBaseSubject = new BehaviorSubject<ResponseFlowRecord[]>( [] );
  knowledgeBase$: Observable<ResponseFlowRecord[]> = this.knowledgeBaseSubject.asObservable();
  clickedResults = new Set<string>();
  today = new Date();

  docTipText: string = '';
  isEmbedded = false;
  isLoading = false;
  restrictedUser = false;

  userId: string | null = null;
  tenantId = '';
  isLoggedIn = false;
  private authContextSubscription!: Subscription;

  searchText = '';
  private searchTerm$ = new BehaviorSubject<string>( '' );
  private categoryFilter$ = new BehaviorSubject<string | null>( null );
  filtered$!: Observable<ResponseFlowRecord[]>;

  constructor (
    private authService: DocsAuthService,
    private logger: LoggerService,
    private router: Router,
    private tipService: DocsTipService,
    private route: ActivatedRoute,
    private notificationService: DocsNotificationService,
    private assistantBus: DocsAssistantSignalService,
    private responseFlowService: ResponseFlowService,
  ) { }

  ngOnInit (): void {
    this.isEmbedded = this.route.snapshot.queryParamMap.get( 'embedded' ) === 'true';
    this.docTipText = this.tipService.getRandomTipText( 'documents' );

    this.authContextSubscription = combineLatest( [
      this.authService.getTenantId(),
      this.authService.getUserId(),
      this.authService.isLoggedIn(),
    ] ).subscribe( ( [tenantId, userId, isLoggedIn] ) => {
      this.tenantId = tenantId || '';
      this.userId = userId || null;
      this.isLoggedIn = isLoggedIn;
      this.setupPage();
    } );
  }

  ngAfterViewInit (): void {
    window.scrollTo( 0, 0 );

  }

  toggleSelection () {
  }

  onClickRoute ( goto: string ): void {
    const [path, fragment] = goto.split( '#' );
    this.router.navigate( [path], { fragment } );
  }


  setupPage () {
    this.publishPageActions();
    this.refreshKnowledgeBase();
    this.publishPageContext();
    this.emitAssistantActivity( 'knowledge_base_opened', {
      source: 'repository'
    } );

    const term$ = this.searchTerm$.pipe(
      debounceTime( 200 ),
      distinctUntilChanged(),
      startWith( '' )
    );

    this.filtered$ = combineLatest( [this.knowledgeBase$, term$, this.categoryFilter$] ).pipe(
      map( ( [items, term, category] ) => {
        const q = ( term || '' ).trim().toLowerCase();
        const cat = ( category || '' ).trim().toLowerCase();

        let filtered = items || [];

        // First filter by category if one is set
        if ( cat ) {
          filtered = filtered.filter( ( it: any ) => {
            const itemCategory = ( it.category || '' ).toLowerCase();
            return itemCategory === cat;
          } );
        }

        // Then apply the existing text filter
        if ( !q ) return filtered;
        const includes = ( s?: string ) => ( s || '' ).toLowerCase().includes( q );

        return filtered.filter( ( it ) => {
          if ( includes( it.question ) ) return true;
          if ( it.answers?.some( a => includes( a.answer ) || includes( a.source ) ) ) return true;
          if ( it.recommendations?.some( r => includes( r.text ) || includes( r.type ) || includes( r.link ) ) ) return true;
          if ( it.resources?.some( r => includes( r.link ) ) ) return true;
          if ( includes( it.userId || '' ) ) return true;
          return false;
        } );
      } )
    );

    // Watch for category passed via query param (e.g., /knowledge?category=email)
    this.route.queryParams.subscribe( params => {
      const cat = params['category'];
      if ( cat ) {
        this.logger.info( 'Repository category filter from route:', cat );
        this.categoryFilter$.next( cat );
        this.publishPageContext();
        this.emitAssistantActivity( 'knowledge_base_category_changed', {
          category: cat,
          source: 'route'
        } );
      }
    } );
  }

  private refreshKnowledgeBase (): void {
    if ( !this.userId ) {
      this.knowledgeBaseSubject.next( [] );
      return;
    }

    this.isLoading = true;
    this.responseFlowService.getResponseFlows().subscribe( {
      next: ( items ) => {
        this.knowledgeBaseSubject.next( ( items || [] ) as ResponseFlowRecord[] );
        this.isLoading = false;
      },
      error: ( error ) => {
        this.logger.error( 'Failed to load knowledge base', error );
        this.knowledgeBaseSubject.next( [] );
        this.isLoading = false;
      }
    } );
  }

  private publishPageContext (): void {
    this.assistantBus.setPageContext( {
      feature: 'documents',
      page: 'knowledge-base',
      route: this.router.url,
      mode: 'list',
      title: 'Knowledge Base',
      description: 'Browse saved response flows, knowledge entries, citations, and recommendations.',
      allowedActions: [
        'search_knowledge',
        'filter_knowledge',
        'copy_citation',
        'open_response_flow',
        'delete_response_flow'
      ],
      selectedEntityType: 'response-flow',
      selectedEntityId: '',
      summary: {
        isAuthenticated: this.isLoggedIn,
        interactionMode: this.isLoggedIn ? 'member' : 'guest',
        hasSearchTerm: !!this.searchText,
        searchText: this.searchText || '',
        categoryFilter: this.categoryFilter$.value || '',
        clickedResultCount: this.clickedResults.size
      },
      dataPreview: {
        searchText: this.searchText || '',
        category: this.categoryFilter$.value || ''
      }
    } );
  }

  private emitAssistantActivity ( action: string, meta?: Record<string, any> ): void {
    this.assistantBus.emitAssistantActivity( {
      feature: 'knowledge-base',
      page: 'repository',
      route: this.router.url,
      mode: 'list',
      action,
      summary: {
        isAuthenticated: this.isLoggedIn,
        interactionMode: this.isLoggedIn ? 'member' : 'guest',
        hasSearchTerm: !!this.searchText,
        searchText: this.searchText || '',
        categoryFilter: this.categoryFilter$.value || '',
        clickedResultCount: this.clickedResults.size
      },
      meta
    } );
  }

  onSearch ( term: string ) {
    this.searchText = term;
    this.searchTerm$.next( term );
    this.publishPageContext();
    this.emitAssistantActivity( 'knowledge_base_search_changed', {
      searchText: term || ''
    } );
  }

  trackByUserId = ( _: number, item: ResponseFlowRecord ) => item?.userId || _;

  ngOnDestroy (): void {
    this.authContextSubscription?.unsubscribe();
    this.clickedResults.clear();
    this.searchTerm$.complete();
    this.categoryFilter$.complete();
    this.pageActionsService.clearPageActions( 'knowledge-repository' );

  }

  private domainFrom ( url?: string ): string {
    if ( !url ) return '';
    try { return new URL( url ).hostname.replace( 'www.', '' ); } catch { return url || ''; }
  }

  formatCitation ( a: Answer ): string {
    const src = a?.source || '';
    const domain = this.domainFrom( src );
    const accessed = new Date().toISOString().slice( 0, 10 );
    return `${a.answer} Source: ${domain}. ${src} (accessed ${accessed}).`;
  }

  async copyCitation ( a: Answer ) {
    this.publishPageContext();
    this.emitAssistantActivity( 'knowledge_base_citation_copy_attempt', {
      source: a?.source || '',
      hasAnswer: !!a?.answer
    } );
    const text = this.formatCitation( a );
    try {
      await navigator.clipboard.writeText( text );
      this.emitAssistantActivity( 'knowledge_base_citation_copied', {
        source: a?.source || '',
        domain: this.domainFrom( a?.source || '' )
      } );
      this.notificationService.show( 'Copied', 'Citation copied to clipboard.', 'success' );
    } catch {
      this.emitAssistantActivity( 'knowledge_base_citation_copy_failed', {
        source: a?.source || ''
      } );
      this.notificationService.show( 'Copy failed', 'Could not copy citation.', 'warning' );
    }
  }

  onDelete ( item: any ) {
    this.publishPageContext();
    this.emitAssistantActivity( 'knowledge_base_delete_attempt', {
      responseFlowId: item?.id || '',
      question: item?.question || ''
    } );

    if ( !this.userId ) {
      this.emitAssistantActivity( 'knowledge_base_delete_blocked', {
        reason: 'guest'
      } );
      this.notificationService.show(
        'Delete Notice',
        'You can explore the Knowledge Base freely. Log in to delete an entry.',
        'warning'
      );
      return;
    }

    const userConfirmed = confirm( `Are you sure you want to delete this Question?` );
    if ( userConfirmed ) {
      if ( item && item.id ) {
        this.responseFlowService.removeResponseFlow( item.id ).subscribe( {
          next: () => {
            this.notificationService.show( 'Delete', 'Delete successful.', 'success' );
            this.emitAssistantActivity( 'knowledge_base_deleted', {
              responseFlowId: item?.id || '',
              question: item?.question || ''
            } );
            this.refreshKnowledgeBase();
            this.publishPageContext();
          },
          error: ( reason ) => {
            this.emitAssistantActivity( 'knowledge_base_delete_failed', {
              responseFlowId: item?.id || '',
              reason: String( reason || '' )
            } );
            this.notificationService.show( 'Delete Error', reason, 'error' );
          }
        } );
      }
    }

  }

  onOpenResponseFlow ( item: ResponseFlowRecord ): void {
    const key = String( item?.userId || item?.question || '' );
    if ( key ) {
      this.clickedResults.add( key );
    }
    this.publishPageContext();
    this.emitAssistantActivity( 'knowledge_base_result_opened', {
      question: item?.question || '',
      category: item?.category || '',
      answerCount: item?.answers?.length || 0,
      recommendationCount: item?.recommendations?.length || 0,
      resourceCount: item?.resources?.length || 0,
      keywordCount: item?.keywords?.length || 0
    } );
  }

  onEdit ( item: any ) {
    this.publishPageContext();
    this.emitAssistantActivity( 'knowledge_base_edit_requested', {
      responseFlowId: item?.id || '',
      question: item?.question || ''
    } );

    if ( !this.userId ) {
      this.emitAssistantActivity( 'knowledge_base_edit_blocked', {
        reason: 'guest'
      } );
      this.notificationService.show(
        'Edit Notice',
        'You can explore the Knowledge Base freely. Log in to edit an entry.',
        'warning'
      );
      return;
    }

    if ( !item || !item.id ) {
      this.emitAssistantActivity( 'knowledge_base_edit_missing', {
        responseFlowId: item?.id || ''
      } );
      this.logger.warn( 'Repository onEdit: item has no id', item );
      return;
    }
    this.router.navigate( ['/knowledge/response-flow'], {
      queryParams: { id: item.id }
    } );
  }

  turnIntoPost ( item: any ): void {
    if ( !item?.id ) return;
    const params = new URLSearchParams( {
      sourceType: 'response-flow',
      sourceId: item.id,
      title: item.question || ''
    } );
    window.location.href = `https://todd.taliferro.tech/outreach/social?${params.toString()}`;
  }

  private publishPageActions (): void {
    this.pageActionsService.setPageActions( {
      pageId: 'knowledge-repository',
      context: {
        pageId: 'knowledge-repository',
        feature: 'knowledge-base',
      },
      actions: buildDocumentPageActions( {
        includeMenuEditor: true,
      } ),
    } );
  }

}
