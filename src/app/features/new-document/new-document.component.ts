import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { KnowledgeItem, primaryAnswer } from '../../models/knowledge';
import { Opportunity } from '../../models/opportunity';
import { DocService } from '../../services/doc.service';
import { DocsAuthService } from '../../services/docs-auth.service';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { KnowledgeStoreService } from '../../services/knowledge-store.service';
import { OpportunitiesService } from '../../services/opportunities.service';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';
import { WriteActionDirective } from '../../shared/write-access/write-action.directive';

const STOP_WORDS = new Set( ['with', 'from', 'that', 'this', 'about', 'letter', 'statement', 'write', 'draft', 'document', 'proposal', 'page', 'pages', 'their', 'your', 'ours', 'for', 'the', 'and'] );

function words ( value: string ): string[] {
  return String( value || '' ).toLowerCase().split( /[^a-z0-9]+/ ).filter( ( w ) => w.length > 3 && !STOP_WORDS.has( w ) );
}

/**
 * What TODD will write from, shown before it starts: the Knowledge answers
 * that share words with the brief (or the most recent ones when none do),
 * and an open opportunity the brief names by agency or title.
 */
export function pickSources ( brief: string, knowledge: KnowledgeItem[], opportunities: Opportunity[], max = 14 ): { knowledge: KnowledgeItem[]; opportunity: Opportunity | null } {
  const wanted = new Set( words( brief ) );
  const scored = knowledge
      .map( ( item ) => ( { item, score: words( `${ item.question } ${ primaryAnswer( item ) } ${ ( item.keywords || [] ).join( ' ' ) }` ).filter( ( w ) => wanted.has( w ) ).length } ) )
      .filter( ( x ) => x.score > 0 )
      .sort( ( a, b ) => b.score - a.score )
      .map( ( x ) => x.item );
  const chosen = scored.length ? scored.slice( 0, max ) : knowledge.slice( 0, Math.min( 10, max ) );
  const lower = String( brief || '' ).toLowerCase();
  const opportunity = opportunities.find( ( o ) => o.status !== 'dismissed' && (
    ( o.agency && lower.includes( o.agency.toLowerCase() ) ) || ( o.title && lower.includes( o.title.toLowerCase() ) )
  ) ) || null;
  return { knowledge: chosen, opportunity };
}

/**
 * New (design_handoff_todd_docs 1j): "What are you writing?" TODD shows the
 * sources it will use (profile, matching Knowledge answers, an opportunity
 * the brief names), writes a first draft and opens it in the editor. Or
 * start from Answer an RFP, a cover letter, a Word file, or a blank page.
 */
@Component( {
  selector: 'app-new-document',
  standalone: true,
  imports: [CommonModule, RouterModule, DkIconComponent, WriteActionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-document.component.html',
  styleUrl: './new-document.component.css',
} )
export class NewDocumentComponent implements OnInit {
  private readonly router = inject( Router );
  private readonly docs = inject( DocService );
  private readonly knowledge = inject( KnowledgeStoreService );
  private readonly opportunities = inject( OpportunitiesService );
  private readonly auth = inject( DocsAuthService );
  private readonly notifications = inject( DocsNotificationService );

  @ViewChild( 'briefInput' ) briefInput?: ElementRef<HTMLInputElement>;

  readonly brief = signal( '' );
  readonly writing = signal( false );
  readonly signedIn = signal<boolean | null>( null );
  /** Sources the user unticked. */
  readonly excluded = signal<{ knowledge: boolean; opportunity: boolean }>( { knowledge: false, opportunity: false } );

  readonly sources = computed( () => pickSources( this.brief(), this.knowledge.items(), this.opportunities.opportunities() ) );

  ngOnInit (): void {
    this.auth.isLoggedIn().subscribe( ( value ) => {
      this.signedIn.set( !!value );
      if ( !value ) return;
      this.knowledge.load().subscribe();
      this.opportunities.load().subscribe();
    } );
  }

  toggle ( which: 'knowledge' | 'opportunity' ): void {
    this.excluded.update( ( e ) => ( { ...e, [which]: !e[which] } ) );
  }

  async start (): Promise<void> {
    const brief = this.brief().trim();
    if ( !brief || this.writing() ) return;
    this.writing.set( true );
    const { knowledge, opportunity } = this.sources();
    try {
      const result = await firstValueFrom( this.docs.compose(
        brief,
        this.excluded().knowledge ? [] : knowledge.map( ( k ) => k.id ),
        this.excluded().opportunity ? '' : opportunity?.id || '',
      ) );
      // The tinted first draft (3a) rides along; the saved document is plain.
      void this.router.navigate( ['/docs/editor', result.documentId], { state: { documentId: result.documentId, title: result.title, blocks: result.blocks, sources: result.sources } } );
    } catch ( error: any ) {
      this.writing.set( false );
      this.notifications.show( 'TODD couldn\'t write that', error?.error?.message || 'Try again in a moment.', 'warning' );
    }
  }

  startFrom ( kind: 'rfp' | 'cover' | 'word' | 'blank' ): void {
    if ( kind === 'rfp' ) void this.router.navigate( ['/opportunities'] );
    else if ( kind === 'cover' ) {
      this.brief.set( 'Cover letter for ' );
      setTimeout( () => this.briefInput?.nativeElement.focus(), 0 );
    } else void this.router.navigate( ['/docs/editor'] );
  }
}
