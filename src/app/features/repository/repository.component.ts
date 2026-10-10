import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { freshnessLabel, isStale, knowledgeMatches, knowledgeTag, primaryAnswer, usedInLabel } from '../../models/knowledge';
import { DocsAssistantSignalService } from '../../services/docs-assistant-signal.service';
import { DocsPageActionsService } from '../../services/docs-page-actions.service';
import { KnowledgeStoreService } from '../../services/knowledge-store.service';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';
import { HighlightPart, highlightParts } from '../../shared/highlight';
import { buildDocumentPageActions } from '../../shared/utils/page-action-presets';

interface KnowledgeCard {
  id: string;
  question: HighlightPart[];
  answer: string;
  tag: { label: string; tint: string } | null;
  freshness: string;
}

/**
 * Knowledge (design_handoff_todd_docs 1g): a search pill, TODD's card with
 * how many answers there are and which need checking, and a 3-column grid
 * of answer cards. A card opens /knowledge/:id (2d), which steps through
 * the same result set. Replaces the horizontal card scroller; editing still
 * goes through Response Flow until the editor's TODD questions land.
 */
@Component( {
  selector: 'app-repository',
  standalone: true,
  imports: [CommonModule, RouterModule, DkIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './repository.component.html',
  styleUrl: './repository.component.css'
} )
export class RepositoryComponent implements OnInit, OnDestroy {
  private readonly route = inject( ActivatedRoute );
  private readonly router = inject( Router );
  private readonly store = inject( KnowledgeStoreService );
  private readonly pageActions = inject( DocsPageActionsService );
  private readonly assistantBus = inject( DocsAssistantSignalService );
  private readonly destroyRef = inject( DestroyRef );
  private readonly isBrowser = isPlatformBrowser( inject( PLATFORM_ID ) );

  readonly query = signal( '' );
  readonly category = signal( '' );
  /** "Review it" narrows the grid to answers over a year old. */
  readonly staleOnly = signal( false );
  readonly loading = computed( () => !this.store.loaded() );
  readonly signedIn = this.store.signedIn;
  readonly isEmbedded = this.route.snapshot.queryParamMap.get( 'embedded' ) === 'true';

  readonly total = computed( () => this.store.items().length );
  readonly staleCount = computed( () => this.store.items().filter( ( item ) => isStale( item ) ).length );

  readonly visible = computed( () => {
    const cat = this.category().toLowerCase();
    return this.store.items()
      .filter( ( item ) => !cat || String( item.category || '' ).toLowerCase() === cat )
      .filter( ( item ) => !this.staleOnly() || isStale( item ) )
      .filter( ( item ) => knowledgeMatches( item, this.query() ) );
  } );

  readonly cards = computed<KnowledgeCard[]>( () => this.visible().map( ( item ) => ( {
    id: item.id,
    question: highlightParts( item.question || 'Untitled question', this.query() ),
    answer: primaryAnswer( item ),
    tag: knowledgeTag( item ),
    freshness: [usedInLabel( item ), freshnessLabel( item )].filter( Boolean ).join( ' · ' ),
  } ) ) );

  /** TODD's line above the grid. */
  readonly toddLine = computed( () => {
    const n = this.total();
    const stale = this.staleCount();
    const base = `${ n } ${ n === 1 ? 'answer' : 'answers' } so far.`;
    if ( !stale ) return `${ base } Everything has been confirmed in the last year.`;
    return `${ base } ${ stale === 1 ? 'One is' : `${ stale } are` } over a year old. ${ stale === 1 ? 'Is it' : 'Are they' } still true?`;
  } );

  readonly countLabel = computed( () => `${ this.visible().length } ${ this.visible().length === 1 ? 'answer' : 'answers' }` );

  ngOnInit (): void {
    this.route.queryParamMap.pipe( takeUntilDestroyed( this.destroyRef ) ).subscribe( ( params ) => {
      this.query.set( params.get( 'q' ) || '' );
      this.category.set( params.get( 'category' ) || '' );
      this.staleOnly.set( params.get( 'review' ) === '1' );
    } );
    this.store.load().pipe( takeUntilDestroyed( this.destroyRef ) ).subscribe( () => {
      this.publishPageContext();
      this.restoreScroll();
    } );
    this.pageActions.setPageActions( {
      pageId: 'knowledge-repository',
      context: { pageId: 'knowledge-repository', feature: 'knowledge-base' },
      actions: buildDocumentPageActions( { includeMenuEditor: true } ),
    } );
  }

  ngOnDestroy (): void {
    this.pageActions.clearPageActions( 'knowledge-repository' );
  }

  onSearch ( value: string ): void {
    this.query.set( value );
    this.syncUrl();
  }

  toggleReview (): void {
    this.staleOnly.set( !this.staleOnly() );
    this.syncUrl();
  }

  clearFilters (): void {
    this.query.set( '' );
    this.staleOnly.set( false );
    this.category.set( '' );
    this.syncUrl();
  }

  open ( card: KnowledgeCard ): void {
    const q = this.query().trim();
    const n = this.visible().length;
    const params: Record<string, string> = {};
    if ( q ) params['q'] = q;
    if ( this.category() ) params['category'] = this.category();
    if ( this.staleOnly() ) params['review'] = '1';
    this.store.resultSet.set( {
      ids: this.visible().map( ( item ) => item.id ),
      label: q ? `${ n } ${ n === 1 ? 'answer' : 'answers' } for ${ q }` : `${ n } ${ n === 1 ? 'answer' : 'answers' }`,
      returnUrl: '/knowledge',
      returnQuery: params,
      scrollY: this.isBrowser ? window.scrollY : 0,
    } );
    void this.router.navigate( ['/knowledge', card.id] );
  }

  private syncUrl (): void {
    void this.router.navigate( [], {
      relativeTo: this.route,
      queryParams: { q: this.query() || null, category: this.category() || null, review: this.staleOnly() ? '1' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    } );
  }

  private restoreScroll (): void {
    const set = this.store.resultSet();
    if ( !this.isBrowser || !set || set.returnUrl !== '/knowledge' ) return;
    this.store.resultSet.set( null );
    setTimeout( () => window.scrollTo( 0, set.scrollY ), 0 );
  }

  private publishPageContext (): void {
    this.assistantBus.setPageContext( {
      feature: 'documents',
      page: 'knowledge-base',
      route: this.router.url,
      mode: 'list',
      title: 'Knowledge',
      description: 'Browse saved answers with their evidence, recommendations and resources.',
      allowedActions: ['search_knowledge', 'filter_knowledge', 'open_response_flow'],
      selectedEntityType: 'response-flow',
      selectedEntityId: '',
      summary: { isAuthenticated: this.signedIn(), answerCount: this.total(), staleCount: this.staleCount(), searchText: this.query() },
      dataPreview: { searchText: this.query(), category: this.category() },
    } );
  }

  /** Signed out: what Knowledge becomes (copy kept from the old guest preview). */
  readonly guestSteps = [
    { n: '01', tint: 'blue', title: 'Capture the question', copy: 'Write down the questions customers and RFPs ask most often so the answer does not have to be rebuilt every time.' },
    { n: '02', tint: 'green', title: 'Keep the proof attached', copy: 'Sourced answers, recommendations and resources stay together so the guidance stays trustworthy.' },
    { n: '03', tint: 'violet', title: 'Reuse it in the next proposal', copy: 'TODD pulls the right answer into your next draft and asks you only for what it doesn\'t know.' },
  ];

  trackCard ( _index: number, card: KnowledgeCard ): string {
    return card.id;
  }

  /** Exposed for the template's empty state. */
  get hasFilters (): boolean {
    return !!this.query().trim() || this.staleOnly() || !!this.category();
  }
}
