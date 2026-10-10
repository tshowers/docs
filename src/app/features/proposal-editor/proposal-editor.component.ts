import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Opportunity, ProposalDraft, ProposalQuestion, ProposalSection, dueLong } from '../../models/opportunity';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { OpportunitiesService } from '../../services/opportunities.service';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';
import { WriteActionDirective } from '../../shared/write-access/write-action.directive';

/** Sections TODD still has to write, in order: never drafted, or waiting on a fresh answer. */
export function sectionsToDraft ( draft: ProposalDraft | null ): ProposalSection[] {
  return ( draft?.sections || [] ).filter( ( s ) => !s.blocks.length || s.needsRedraft );
}

/** The question TODD asks next: the first open one, in section order. */
export function nextQuestion ( draft: ProposalDraft | null ): ProposalQuestion | null {
  if ( !draft ) return null;
  const order = new Map( draft.sections.map( ( s, i ) => [s.key, i] ) );
  return draft.questions
      .filter( ( q ) => q.status === 'open' )
      .sort( ( a, b ) => ( order.get( a.sectionKey ) ?? 99 ) - ( order.get( b.sectionKey ) ?? 99 ) )[0] || null;
}

/**
 * The proposal editor (design_handoff_todd_docs 1e). TODD plans the
 * proposal from the RFP, then drafts it section by section; the page shows
 * what came from Knowledge and what's waiting on the user. On the right,
 * TODD asks one question at a time (saved to Knowledge by default) and the
 * RFP checklist updates as the draft changes. Free editing and export stay
 * in the document editor, which always has the latest text.
 */
@Component( {
  selector: 'app-proposal-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DkIconComponent, WriteActionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './proposal-editor.component.html',
  styleUrl: './proposal-editor.component.css',
} )
export class ProposalEditorComponent implements OnInit {
  private readonly route = inject( ActivatedRoute );
  private readonly service = inject( OpportunitiesService );
  private readonly notifications = inject( DocsNotificationService );
  private readonly destroyRef = inject( DestroyRef );

  readonly opportunityId = signal( '' );
  readonly opportunity = signal<Opportunity | null>( null );
  readonly draft = signal<ProposalDraft | null>( null );
  /** 'loading' | 'planning' | 'ready' | 'error' */
  readonly phase = signal<'loading' | 'planning' | 'ready' | 'error'>( 'loading' );
  readonly errorMessage = signal( '' );
  readonly draftingKey = signal( '' );
  readonly failedKeys = signal<string[]>( [] );
  readonly currentKey = signal( '' );
  readonly answering = signal( false );
  readonly savedAt = signal<Date | null>( null );
  answer = '';
  saveToKnowledge = true;
  private drafting = false;

  readonly question = computed( () => nextQuestion( this.draft() ) );
  readonly questionNumber = computed( () => {
    const d = this.draft();
    if ( !d ) return { n: 0, of: 0 };
    const done = d.questions.filter( ( q ) => q.status !== 'open' ).length;
    return { n: done + 1, of: d.questions.length };
  } );
  readonly checklistOk = computed( () => ( this.draft()?.checklist || [] ).filter( ( c ) => c.ok ).length );
  readonly subtitle = computed( () => {
    const o = this.opportunity();
    if ( !o ) return '';
    const parts = [o.agency, o.dueDate ? `due ${ dueLong( o ) }` : ''].filter( Boolean );
    const saved = this.savedAt();
    if ( saved ) parts.push( 'saved just now' );
    return parts.join( ' · ' );
  } );

  ngOnInit (): void {
    this.route.paramMap.pipe( takeUntilDestroyed( this.destroyRef ) ).subscribe( ( params ) => {
      this.opportunityId.set( String( params.get( 'id' ) || '' ) );
      void this.start();
    } );
  }

  private async start (): Promise<void> {
    const id = this.opportunityId();
    this.phase.set( 'loading' );
    try {
      this.opportunity.set( await firstValueFrom( this.service.get( id ) ) );
      let draft = await firstValueFrom( this.service.getProposal( id ) );
      if ( !draft ) {
        this.phase.set( 'planning' );
        draft = await firstValueFrom( this.service.planProposal( id ) );
      }
      this.draft.set( draft );
      this.currentKey.set( draft.sections[0]?.key || '' );
      this.phase.set( 'ready' );
      void this.draftRemaining();
    } catch ( error: any ) {
      this.errorMessage.set( error?.error?.message || 'TODD couldn\'t open this proposal. Try again in a moment.' );
      this.phase.set( 'error' );
    }
  }

  retry (): void {
    void this.start();
  }

  /** Re-reads the RFP from scratch, e.g. after the RFP file was attached. */
  async replan (): Promise<void> {
    if ( !window.confirm( 'Start the draft over from the RFP? Your answers stay in Knowledge.' ) ) return;
    this.phase.set( 'planning' );
    try {
      const draft = await firstValueFrom( this.service.planProposal( this.opportunityId(), true ) );
      this.draft.set( draft );
      this.phase.set( 'ready' );
      void this.draftRemaining();
    } catch ( error: any ) {
      this.errorMessage.set( error?.error?.message || 'TODD couldn\'t plan the proposal.' );
      this.phase.set( 'error' );
    }
  }

  /** Drafts every section that needs it, one request at a time. */
  async draftRemaining (): Promise<void> {
    if ( this.drafting ) return;
    this.drafting = true;
    try {
      for ( ;; ) {
        const next = sectionsToDraft( this.draft() ).find( ( s ) => !this.failedKeys().includes( s.key ) );
        if ( !next ) break;
        this.draftingKey.set( next.key );
        try {
          const draft = await firstValueFrom( this.service.draftSection( this.opportunityId(), next.key ) );
          this.draft.set( draft );
          this.savedAt.set( new Date() );
        } catch {
          this.failedKeys.update( ( keys ) => [...keys, next.key] );
        }
      }
    } finally {
      this.draftingKey.set( '' );
      this.drafting = false;
    }
  }

  retrySection ( key: string ): void {
    this.failedKeys.update( ( keys ) => keys.filter( ( k ) => k !== key ) );
    void this.draftRemaining();
  }

  async submitAnswer ( skip = false ): Promise<void> {
    const q = this.question();
    if ( !q || this.answering() ) return;
    if ( !skip && !this.answer.trim() ) return;
    this.answering.set( true );
    const wantedSave = this.saveToKnowledge;
    try {
      const result = await firstValueFrom( this.service.answerQuestion( this.opportunityId(), q.id, skip ? { skip: true } : { answer: this.answer, saveToKnowledge: wantedSave } ) );
      this.draft.set( result.draft );
      this.answer = '';
      this.saveToKnowledge = true;
      if ( !skip && wantedSave && !result.knowledge.saved && result.knowledge.reason ) {
        this.notifications.show( 'Used in this proposal only', result.knowledge.reason, 'warning' );
      }
      void this.draftRemaining();
    } catch ( error: any ) {
      this.notifications.show( 'Couldn\'t save that', error?.error?.message || 'Please try again.', 'warning' );
    } finally {
      this.answering.set( false );
    }
  }

  goTo ( key: string ): void {
    this.currentKey.set( key );
    document.getElementById( `section-${ key }` )?.scrollIntoView( { behavior: 'smooth', block: 'start' } );
  }

  dotFor ( section: ProposalSection ): string {
    if ( this.draftingKey() === section.key ) return 'is-current';
    if ( section.status === 'done' ) return 'is-done';
    if ( section.status === 'waiting' ) return 'is-waiting';
    return 'is-pending';
  }
}
