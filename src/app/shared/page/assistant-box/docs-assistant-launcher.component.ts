import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { AssistantBoxComponent } from './assistant-box.component';
import { DocsAuthService } from '../../../services/docs-auth.service';
import { DocsAssistantPageContext, DocsAssistantSignalService } from '../../../services/docs-assistant-signal.service';

type GuidanceTone = 'neutral' | 'progress' | 'attention' | 'ready';

interface DocsGuidanceCard {
  eyebrow: string;
  title: string;
  message: string;
  whyItMatters: string;
  bullets: string[];
  stageLabel: string;
  tone: GuidanceTone;
  icon: string;
  nextStage?: string;
}

/**
 * Docs' launcher shell - same from-scratch equivalent of TODD's
 * todd-assistant.component.ts as web-products/network, web-products/pulse,
 * and web-products/moves' launcher components. Covers the four pages that
 * already publish rich page context under feature 'documents':
 * document-home, document-editor, knowledge-base (repository.component.ts),
 * and response-flow.
 */
@Component( {
  selector: 'app-docs-assistant-launcher',
  standalone: true,
  imports: [CommonModule, AssistantBoxComponent],
  templateUrl: './docs-assistant-launcher.component.html',
  styleUrls: ['./docs-assistant-launcher.component.css'],
} )
export class DocsAssistantLauncherComponent implements OnInit, OnDestroy {
  private readonly authService = inject( DocsAuthService );
  private readonly assistantBus = inject( DocsAssistantSignalService );
  private readonly router = inject( Router );

  private readonly launcherHotzoneSize = 180;
  private readonly launcherRevealDurationMs = 2400;
  private launcherHideTimer: ReturnType<typeof setTimeout> | null = null;

  showAssistant = false;
  launcherVisible = false;
  hasUnread = false;
  pageContext: DocsAssistantPageContext | null = null;
  isLoggedIn = false;

  userId: string | null = null;
  tenantId: string | null = null;

  private readonly subscriptions: Subscription[] = [];

  ngOnInit (): void {
    this.subscriptions.push(
      this.authService.isLoggedIn().subscribe( ( loggedIn ) => ( this.isLoggedIn = loggedIn ) ),
      this.authService.getUserId().subscribe( ( id ) => ( this.userId = id || null ) ),
      this.authService.getTenantId().subscribe( ( id ) => ( this.tenantId = id || null ) ),
      this.assistantBus.pageContext$.subscribe( ( ctx ) => ( this.pageContext = ctx ) ),
      this.assistantBus.unread$.subscribe( ( unread ) => ( this.hasUnread = unread ) ),
    );
  }

  ngOnDestroy (): void {
    if ( this.launcherHideTimer ) clearTimeout( this.launcherHideTimer );
    this.subscriptions.forEach( ( s ) => s.unsubscribe() );
  }

  @HostListener( 'document:mousemove', ['$event'] )
  onMouseMove ( event: MouseEvent ): void {
    if ( this.isInBottomRightHotzone( event.clientX, event.clientY ) ) {
      this.revealLauncherTemporarily();
    }
  }

  @HostListener( 'document:touchstart', ['$event'] )
  onTouchStart ( event: TouchEvent ): void {
    const touch = event.touches?.[0];
    if ( touch && this.isInBottomRightHotzone( touch.clientX, touch.clientY ) ) {
      this.revealLauncherTemporarily();
    }
  }

  private isInBottomRightHotzone ( clientX: number, clientY: number ): boolean {
    return clientX >= ( window.innerWidth - this.launcherHotzoneSize )
      && clientY >= ( window.innerHeight - this.launcherHotzoneSize );
  }

  private revealLauncherTemporarily (): void {
    this.launcherVisible = true;
    if ( this.launcherHideTimer ) clearTimeout( this.launcherHideTimer );

    if ( this.showAssistant ) return;

    this.launcherHideTimer = setTimeout( () => {
      if ( !this.showAssistant ) this.launcherVisible = false;
    }, this.launcherRevealDurationMs );
  }

  toggleAssistant (): void {
    this.showAssistant = !this.showAssistant;
    if ( this.showAssistant ) {
      this.launcherVisible = true;
      if ( this.launcherHideTimer ) clearTimeout( this.launcherHideTimer );
      this.assistantBus.clearAssistantUnread();
    }
  }

  dismissAssistant (): void {
    this.showAssistant = false;
    this.launcherVisible = false;
  }

  onAssistantNavigate ( target: { path: string; queryParams?: any; fragment?: string; } ): void {
    if ( !target?.path ) return;
    void this.router.navigate( [target.path], { queryParams: target.queryParams, fragment: target.fragment } );
  }

  get guidanceCard (): DocsGuidanceCard | null {
    if ( !this.isLoggedIn ) return this.guestOrientationCard;
    return this.computeGuidanceCard( this.pageContext );
  }

  private get guestOrientationCard (): DocsGuidanceCard {
    return {
      eyebrow: 'WHAT IS THIS PAGE',
      stageLabel: 'Overview',
      tone: 'neutral',
      icon: 'fa-solid fa-compass',
      title: 'Docs turns files into reusable knowledge',
      message: 'TODD organizes your documents and captures reusable answers so the same question never gets answered from scratch twice. Sign in to see it work with your own data.',
      whyItMatters: "A file drawer doesn't answer questions - Docs is what turns documents into knowledge TODD can actually reuse.",
      bullets: [
        'Upload a document, or create one directly in the editor.',
        'TODD flags stale or duplicate documents before they cause confusion.',
        'Ask this chat how Docs works, or what TODD actually does.',
      ],
    };
  }

  private computeGuidanceCard ( ctx: DocsAssistantPageContext | null ): DocsGuidanceCard | null {
    if ( !ctx || String( ctx.feature || '' ).toLowerCase() !== 'documents' ) return null;

    switch ( String( ctx.page || '' ).toLowerCase() ) {
      case 'document-home': return this.documentHomeCard( ctx );
      case 'document-editor': return this.documentEditorCard( ctx );
      case 'knowledge-base': return this.knowledgeBaseCard( ctx );
      case 'response-flow': return this.responseFlowCard( ctx );
      default: return null;
    }
  }

  private documentHomeCard ( ctx: DocsAssistantPageContext ): DocsGuidanceCard {
    const summary = ctx.summary || {};
    const total = Number( summary['totalDocumentCount'] || 0 );
    const staleCount = Number( summary['staleDocumentCount'] || 0 );
    const duplicateCount = Number( summary['duplicateTitleCount'] || 0 );
    const responseReadyCount = Number( summary['responseReadyCount'] || 0 );
    const knowledgeScore = Number( summary['knowledgeScore'] || 0 );

    if ( total === 0 ) {
      return {
        eyebrow: 'GETTING STARTED',
        stageLabel: 'No documents yet',
        tone: 'attention',
        icon: 'fa-solid fa-triangle-exclamation',
        title: 'Add your first document',
        message: "TODD doesn't see any documents yet. Upload a file or create one in the editor to start building knowledge.",
        whyItMatters: 'Knowledge only has something to organize once there are documents here.',
        bullets: [],
      };
    }

    if ( duplicateCount > 0 || staleCount > 0 ) {
      return {
        eyebrow: 'KNOWLEDGE',
        stageLabel: 'Needs cleanup',
        tone: 'attention',
        icon: 'fa-solid fa-triangle-exclamation',
        title: `${duplicateCount + staleCount} document${( duplicateCount + staleCount ) === 1 ? '' : 's'} need attention`,
        message: `${duplicateCount} duplicate title${duplicateCount === 1 ? '' : 's'}, ${staleCount} stale document${staleCount === 1 ? '' : 's'}. Clean these up so search and reuse stay reliable.`,
        whyItMatters: 'Duplicate and stale documents are the main reason findability quietly degrades over time.',
        bullets: [`${total.toLocaleString()} total documents.`],
      };
    }

    if ( responseReadyCount > 0 ) {
      return {
        eyebrow: 'KNOWLEDGE',
        stageLabel: 'Ready to reuse',
        tone: 'progress',
        icon: 'fa-solid fa-hourglass-half',
        title: `${responseReadyCount} document${responseReadyCount === 1 ? ' is' : 's are'} ready to become knowledge`,
        message: 'These documents have content TODD can turn into reusable Q&A entries. Open Response Flow to capture it.',
        whyItMatters: 'A document sitting unused is potential knowledge that no one can search for yet.',
        bullets: [],
        nextStage: 'Response Flow',
      };
    }

    return {
      eyebrow: 'KNOWLEDGE',
      stageLabel: knowledgeScore >= 70 ? 'Healthy' : knowledgeScore >= 40 ? 'Mixed' : 'Watch',
      tone: knowledgeScore >= 70 ? 'ready' : knowledgeScore >= 40 ? 'progress' : 'attention',
      icon: knowledgeScore >= 70 ? 'fa-solid fa-circle-check' : 'fa-solid fa-hourglass-half',
      title: `Knowledge score: ${knowledgeScore}`,
      message: `${total.toLocaleString()} documents tracked. Review freshness, findability, and proposal reuse in the cockpit.`,
      whyItMatters: 'A healthy knowledge score is what makes TODD’s answers trustworthy instead of guesswork.',
      bullets: [],
    };
  }

  private documentEditorCard ( ctx: DocsAssistantPageContext ): DocsGuidanceCard {
    const summary = ctx.summary || {};
    const hasTitle = summary['hasTitle'] === true;
    const hasHtmlContent = summary['hasHtmlContent'] === true;
    const isToddWorking = summary['isToddWorking'] === true;
    const hasToddPreview = summary['hasToddPreview'] === true;
    const isEditing = summary['isEditing'] === true;

    if ( isToddWorking ) {
      return {
        eyebrow: isEditing ? 'EDIT DOCUMENT' : 'CREATE DOCUMENT',
        stageLabel: 'Working',
        tone: 'progress',
        icon: 'fa-solid fa-hourglass-half',
        title: 'TODD is drafting this document',
        message: 'Give it a moment to finish before making more changes.',
        whyItMatters: 'Editing while TODD is actively writing can create a conflict in the draft.',
        bullets: [],
      };
    }

    if ( hasToddPreview ) {
      return {
        eyebrow: isEditing ? 'EDIT DOCUMENT' : 'CREATE DOCUMENT',
        stageLabel: 'Preview ready',
        tone: 'progress',
        icon: 'fa-solid fa-hourglass-half',
        title: 'A TODD draft is ready to review',
        message: 'Review the suggested changes and apply them if they look right.',
        whyItMatters: 'Nothing is committed to the document until you apply the preview.',
        bullets: [],
      };
    }

    if ( !hasTitle || !hasHtmlContent ) {
      return {
        eyebrow: isEditing ? 'EDIT DOCUMENT' : 'CREATE DOCUMENT',
        stageLabel: 'Getting started',
        tone: 'attention',
        icon: 'fa-solid fa-triangle-exclamation',
        title: !hasTitle ? 'Give this document a title' : 'Add some content',
        message: 'Describe what you want written and TODD can draft it, or write directly in the editor.',
        whyItMatters: 'An empty or untitled document won’t show up meaningfully in search or the document list.',
        bullets: [],
      };
    }

    return {
      eyebrow: isEditing ? 'EDIT DOCUMENT' : 'CREATE DOCUMENT',
      stageLabel: 'Ready',
      tone: 'ready',
      icon: 'fa-solid fa-circle-check',
      title: 'This document is ready to save',
      message: 'Ask TODD to refine wording, or export when you’re happy with it.',
      whyItMatters: 'Saved documents become searchable and reusable across Docs and Knowledge.',
      bullets: [],
    };
  }

  private knowledgeBaseCard ( ctx: DocsAssistantPageContext ): DocsGuidanceCard {
    const summary = ctx.summary || {};
    const hasSearchTerm = summary['hasSearchTerm'] === true;
    const searchText = String( summary['searchText'] || '' ).trim();
    const categoryFilter = String( summary['categoryFilter'] || '' ).trim();

    if ( hasSearchTerm ) {
      return {
        eyebrow: 'KNOWLEDGE BASE',
        stageLabel: 'Filtered',
        tone: 'neutral',
        icon: 'fa-solid fa-magnifying-glass',
        title: `Searching for "${searchText}"`,
        message: 'Click any result to see the full answer, sources, and recommendations. Clear the search to browse everything.',
        whyItMatters: 'Knowledge search looks across questions, answers, and keywords - a broader term often surfaces more.',
        bullets: [],
      };
    }

    if ( categoryFilter ) {
      return {
        eyebrow: 'KNOWLEDGE BASE',
        stageLabel: 'Filtered by category',
        tone: 'neutral',
        icon: 'fa-solid fa-filter',
        title: `Showing "${categoryFilter}" entries`,
        message: 'Clear the category filter to browse the full knowledge base.',
        whyItMatters: 'Categories are what make a large knowledge base browsable instead of just searchable.',
        bullets: [],
      };
    }

    return {
      eyebrow: 'KNOWLEDGE BASE',
      stageLabel: 'Browsing',
      tone: 'neutral',
      icon: 'fa-solid fa-book',
      title: 'Browsing saved knowledge',
      message: 'Search or filter by category to narrow the list, or open any entry to see its evidence and recommendations.',
      whyItMatters: 'This is TODD’s reusable memory - the more it holds, the less gets answered from scratch.',
      bullets: [],
      nextStage: 'Add a new entry via Response Flow',
    };
  }

  private responseFlowCard ( ctx: DocsAssistantPageContext ): DocsGuidanceCard {
    const summary = ctx.summary || {};
    const hasQuestion = summary['hasQuestion'] === true;
    const answerCount = Number( summary['answerCount'] || 0 );
    const keywordCount = Number( summary['keywordCount'] || 0 );

    if ( !hasQuestion ) {
      return {
        eyebrow: 'RESPONSE FLOW',
        stageLabel: 'Getting started',
        tone: 'attention',
        icon: 'fa-solid fa-triangle-exclamation',
        title: 'Start with the question',
        message: 'What question should this entry answer? That’s what makes it findable later.',
        whyItMatters: 'The question is the search hook - without one, this entry is hard to find again.',
        bullets: [],
      };
    }

    if ( answerCount === 0 ) {
      return {
        eyebrow: 'RESPONSE FLOW',
        stageLabel: 'Needs an answer',
        tone: 'progress',
        icon: 'fa-solid fa-hourglass-half',
        title: 'Add at least one answer',
        message: 'Write the answer directly, or ask TODD to draft one from a document you’ve already uploaded.',
        whyItMatters: 'A question with no answer isn’t reusable knowledge yet.',
        bullets: [],
      };
    }

    return {
      eyebrow: 'RESPONSE FLOW',
      stageLabel: 'Ready',
      tone: 'ready',
      icon: 'fa-solid fa-circle-check',
      title: 'This entry is ready to save',
      message: keywordCount === 0
        ? 'Consider adding a few keywords so this is easier to find later.'
        : 'Save when ready - it will show up in the Knowledge Base immediately.',
      whyItMatters: 'Keywords and category are what make search actually find this entry later.',
      bullets: [],
    };
  }

  guidanceToneClass ( tone: GuidanceTone ): string {
    return `todd-activation-card--${tone}`;
  }
}
