import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Opportunity, ProposalDraft, ProposalQuestion, ProposalSection, Requirement, Requirements, dueLong } from '../../models/opportunity';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { OpportunitiesService } from '../../services/opportunities.service';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';
import { WriteActionDirective } from '../../shared/write-access/write-action.directive';
import { ScoreCheck, ScoreRevision, pointsBySection } from '../../models/score-check';
import { ScoreCheckComponent } from '../../shared/score-check/score-check.component';
import { RequirementsMatrixComponent } from './requirements-matrix.component';

/** After the draft changes, wait this long before checking it against the requirements again. */
const RECHECK_DELAY_MS = 3000;
/** While TODD is reading the RFP for requirements elsewhere, check back this often. */
const REQUIREMENTS_POLL_MS = 5000;

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

/** Unanswered requirements by the section that should answer them: the pink and green blocks in the draft. */
export function openBySection ( requirements: Requirements | null ): Map<string, Requirement[]> {
  const map = new Map<string, Requirement[]>();
  for ( const r of requirements?.items || [] ) {
    if ( r.status === 'answered' || !r.sectionKey ) continue;
    map.set( r.sectionKey, [...( map.get( r.sectionKey ) || [] ), r] );
  }
  return map;
}

/**
 * The proposal editor (design_handoff_todd_docs 1e). TODD plans the
 * proposal from the RFP, then drafts it section by section; the page shows
 * what came from Knowledge and what's waiting on the user. On the right,
 * TODD asks one question at a time (saved to Knowledge by default) and the
 * RFP checklist updates as the draft changes. Free editing and export stay
 * in the document editor, which always has the latest text.
 *
 * The compliance matrix (lifecycle 1d/1e): the right panel's Requirements
 * tab and the full Requirements view list every shall/must/will with where
 * the draft answers it. TODD checks again a few seconds after each change;
 * unanswered ones show in their section, with Write this.
 */
@Component( {
  selector: 'app-proposal-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DkIconComponent, WriteActionDirective, RequirementsMatrixComponent, ScoreCheckComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './proposal-editor.component.html',
  styleUrl: './proposal-editor.component.css',
} )
export class ProposalEditorComponent implements OnInit {
  private readonly route = inject( ActivatedRoute );
  private readonly router = inject( Router );
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

  readonly requirements = signal<Requirements | null>( null );
  /** The requirement TODD is writing for, or whose suggestion is being saved. */
  readonly requirementBusy = signal( '' );
  readonly sideTab = signal<'todd' | 'requirements' | 'checklist' | 'score'>( 'todd' );
  /** Draft, or the full Requirements table (1e); ?view=requirements opens it. */
  readonly view = signal<'draft' | 'requirements'>( 'draft' );
  /** The paragraph just jumped to: "{sectionKey}-{blockIndex}", highlighted for 2s. */
  readonly flash = signal( '' );
  readonly editingSuggestion = signal( '' );
  suggestionText = '';
  private recheckTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingFix = '';
  private checkingRequirements = false;
  private recheckAgain = false;

  readonly openBySection = computed( () => openBySection( this.requirements() ) );

  /** The score-check (lifecycle 1j): loaded when the Score tab opens, or ?fix= arrives from Review & send. */
  readonly scoreCheck = signal<ScoreCheck | null>( null );
  readonly scoring = signal( false );
  /** The fix TODD is writing or whose revision is open; set while saving it too. */
  readonly activeFix = signal( '' );
  readonly fixBusy = signal( false );
  editingFix = '';
  fixText = '';
  private scoreLoaded = false;
  readonly sectionPoints = computed( () => pointsBySection( this.scoreCheck() ) );
  /** Open revisions by section: rewrites at their paragraph, additions at the end. */
  readonly revisions = computed( () => {
    const check = this.scoreCheck();
    const list: { fixId: string; title: string; revision: ScoreRevision }[] = [];
    for ( const c of check?.criteria || [] ) if ( c.revision ) list.push( { fixId: c.id, title: c.fix, revision: c.revision } );
    if ( check?.opening?.revision ) list.push( { fixId: 'opening', title: check.opening.fix, revision: check.opening.revision } );
    return list;
  } );
  readonly sectionTitle = ( key: string ): string => this.draft()?.sections.find( ( s ) => s.key === key )?.title || '';

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
    this.destroyRef.onDestroy( () => { if ( this.recheckTimer ) clearTimeout( this.recheckTimer ); } );
    this.route.queryParamMap.pipe( takeUntilDestroyed( this.destroyRef ) ).subscribe( ( params ) => {
      this.view.set( params.get( 'view' ) === 'requirements' ? 'requirements' : 'draft' );
      // Fix this on Review & send: open the Score tab with that fix's revision.
      const fix = params.get( 'fix' );
      if ( fix && this.phase() === 'ready' ) void this.openFix( fix );
      else if ( fix ) this.pendingFix = fix;
    } );
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
      this.sideTab.set( draft.questions.some( ( q ) => q.status === 'open' ) ? 'todd' : 'requirements' );
      this.phase.set( 'ready' );
      if ( this.pendingFix ) void this.openFix( this.pendingFix );
      void this.loadRequirements();
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
      // New sections: the requirements are read again for them.
      this.requirements.set( null );
      void this.checkRequirements( true );
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
          this.scheduleRecheck();
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

  // ── Score-check ────────────────────────────────────────────────
  showTab ( tab: 'todd' | 'requirements' | 'checklist' | 'score' ): void {
    this.sideTab.set( tab );
    if ( tab === 'score' ) void this.loadScore();
  }

  private async loadScore (): Promise<void> {
    if ( this.scoreLoaded ) return;
    this.scoreLoaded = true;
    try {
      this.scoreCheck.set( await firstValueFrom( this.service.getScoreCheck( this.opportunityId() ) ) );
    } catch {
      this.scoreLoaded = false;
    }
  }

  async runScore (): Promise<void> {
    if ( this.scoring() ) return;
    this.scoring.set( true );
    try {
      this.scoreCheck.set( await firstValueFrom( this.service.runScoreCheck( this.opportunityId() ) ) );
      this.scoreLoaded = true;
    } catch ( error: any ) {
      this.notifications.show( 'TODD couldn\'t score the draft', error?.error?.message || 'Please try again.', 'warning' );
    } finally {
      this.scoring.set( false );
    }
  }

  /** Fix this: writes the revision once, then shows it in the draft. */
  async openFix ( fixId: string ): Promise<void> {
    this.pendingFix = '';
    this.sideTab.set( 'score' );
    await this.loadScore();
    this.setView( 'draft' );
    const existing = this.revisions().find( ( r ) => r.fixId === fixId );
    if ( existing ) {
      this.activeFix.set( fixId );
      setTimeout( () => this.scrollToFix( fixId ), 50 );
      return;
    }
    if ( this.fixBusy() ) return;
    this.fixBusy.set( true );
    this.activeFix.set( fixId );
    try {
      this.scoreCheck.set( await firstValueFrom( this.service.writeScoreFix( this.opportunityId(), fixId ) ) );
      setTimeout( () => this.scrollToFix( fixId ), 50 );
    } catch ( error: any ) {
      this.activeFix.set( '' );
      this.notifications.show( 'TODD couldn\'t write that', error?.error?.message || 'Please try again.', 'warning' );
    } finally {
      this.fixBusy.set( false );
    }
  }

  private scrollToFix ( fixId: string ): void {
    document.getElementById( `fix-${ fixId }` )?.scrollIntoView( { behavior: 'smooth', block: 'center' } );
  }

  /** Accepting rewrites the draft and scores it again, so the number moves. */
  async resolveFix ( fixId: string, action: 'accept' | 'discard' ): Promise<void> {
    if ( this.fixBusy() ) return;
    this.fixBusy.set( true );
    try {
      const text = this.editingFix === fixId ? this.fixText.trim() : '';
      const result = await firstValueFrom( this.service.resolveScoreFix( this.opportunityId(), fixId, action, text ) );
      this.scoreCheck.set( result.scoreCheck );
      this.editingFix = '';
      this.activeFix.set( '' );
      if ( result.draft ) {
        this.draft.set( result.draft );
        this.savedAt.set( new Date() );
        this.scheduleRecheck();
      }
      if ( result.copyToEditor ) this.notifications.show( 'Copy it into the editor', 'You\'ve edited this proposal in the editor, so TODD changed its own draft only.', 'warning' );
      if ( action === 'accept' ) void this.runScore();
    } catch ( error: any ) {
      this.notifications.show( 'Couldn\'t update the proposal', error?.error?.message || 'Please try again.', 'warning' );
    } finally {
      this.fixBusy.set( false );
    }
  }

  editFix ( fixId: string, text: string ): void {
    this.editingFix = fixId;
    this.fixText = text;
  }

  /** A revision that rewrites this paragraph. */
  revisionAt ( sectionKey: string, blockIndex: number ) {
    return this.revisions().find( ( r ) => r.revision.sectionKey === sectionKey && r.revision.blockIndex === blockIndex ) || null;
  }

  /** Revisions that add a paragraph to this section. */
  additionsFor ( sectionKey: string ) {
    return this.revisions().filter( ( r ) => r.revision.sectionKey === sectionKey && r.revision.blockIndex < 0 );
  }

  // ── Requirements ───────────────────────────────────────────────
  /** The matrix as it stands; read from the RFP the first time, otherwise checked against the latest draft. */
  private async loadRequirements (): Promise<void> {
    const id = this.opportunityId();
    try {
      const current = await firstValueFrom( this.service.getRequirements( id ) );
      this.requirements.set( current );
      if ( current.status === 'checking' ) this.pollRequirements();
      else void this.checkRequirements();
    } catch {
      void this.checkRequirements();
    }
  }

  async checkRequirements ( force = false ): Promise<void> {
    if ( this.checkingRequirements ) {
      this.recheckAgain = true;
      return;
    }
    this.checkingRequirements = true;
    const id = this.opportunityId();
    const first = !this.requirements()?.items.length;
    if ( first || force ) this.requirements.update( ( r ) => ( { ...( r || emptyRequirements() ), status: 'checking' } ) );
    try {
      const result = await firstValueFrom( this.service.checkRequirements( id, force ) );
      if ( id !== this.opportunityId() ) return;
      this.requirements.set( result );
      // The checklist's "Requirements answered" line comes with the draft.
      this.draft.set( await firstValueFrom( this.service.getProposal( id ) ) || this.draft() );
      if ( result.status === 'checking' ) this.pollRequirements();
    } catch {
      if ( first ) this.requirements.update( ( r ) => ( { ...( r || emptyRequirements() ), status: 'failed' } ) );
    } finally {
      this.checkingRequirements = false;
      if ( this.recheckAgain ) {
        this.recheckAgain = false;
        this.scheduleRecheck();
      }
    }
  }

  private scheduleRecheck (): void {
    if ( this.recheckTimer ) clearTimeout( this.recheckTimer );
    this.recheckTimer = setTimeout( () => {
      this.recheckTimer = null;
      void this.checkRequirements();
    }, RECHECK_DELAY_MS );
  }

  private pollRequirements (): void {
    if ( this.recheckTimer ) clearTimeout( this.recheckTimer );
    this.recheckTimer = setTimeout( async () => {
      this.recheckTimer = null;
      const latest = await firstValueFrom( this.service.getRequirements( this.opportunityId() ) ).catch( () => null );
      if ( !latest ) return;
      this.requirements.set( latest );
      if ( latest.status === 'checking' ) this.pollRequirements();
      else this.draft.set( await firstValueFrom( this.service.getProposal( this.opportunityId() ) ).catch( () => null ) || this.draft() );
    }, REQUIREMENTS_POLL_MS );
  }

  async writeRequirement ( r: Requirement ): Promise<void> {
    if ( this.requirementBusy() ) return;
    this.requirementBusy.set( r.id );
    try {
      this.requirements.set( await firstValueFrom( this.service.writeRequirement( this.opportunityId(), r.id ) ) );
      if ( this.view() === 'draft' ) setTimeout( () => this.showSuggestion( r.id ), 50 );
    } catch ( error: any ) {
      this.notifications.show( 'TODD couldn\'t write that', error?.error?.message || 'Please try again.', 'warning' );
    } finally {
      this.requirementBusy.set( '' );
    }
  }

  async resolveRequirement ( r: Requirement, action: 'accept' | 'discard', text = '' ): Promise<void> {
    if ( this.requirementBusy() ) return;
    this.requirementBusy.set( r.id );
    try {
      const result = await firstValueFrom( this.service.resolveRequirement( this.opportunityId(), r.id, action, text ) );
      this.requirements.set( result.requirements );
      if ( result.draft ) {
        this.draft.set( result.draft );
        this.savedAt.set( new Date() );
      }
      this.editingSuggestion.set( '' );
      if ( result.copyToEditor ) this.notifications.show( 'Copy it into the editor', 'You\'ve edited this proposal in the editor, so TODD added the paragraph to its own draft only.', 'warning' );
    } catch ( error: any ) {
      this.notifications.show( 'Couldn\'t update the proposal', error?.error?.message || 'Please try again.', 'warning' );
    } finally {
      this.requirementBusy.set( '' );
    }
  }

  async markRequirement ( r: Requirement, answered: boolean ): Promise<void> {
    try {
      this.requirements.set( await firstValueFrom( this.service.markRequirement( this.opportunityId(), r.id, answered ) ) );
      this.draft.set( await firstValueFrom( this.service.getProposal( this.opportunityId() ) ) || this.draft() );
    } catch {
      this.notifications.show( 'Couldn\'t update the matrix', 'Please try again.', 'warning' );
    }
  }

  editSuggestion ( r: Requirement ): void {
    this.editingSuggestion.set( r.id );
    this.suggestionText = r.suggestion?.text || '';
  }

  /** Scrolls the draft to the paragraph that answers it (or TODD's suggestion) and highlights it for 2s. */
  jumpTo ( r: Requirement ): void {
    const d = this.draft();
    if ( d?.documentEdited && d.proposalDocumentId && r.status === 'answered' ) {
      void this.router.navigate( ['/docs/editor', d.proposalDocumentId] );
      return;
    }
    this.setView( 'draft' );
    setTimeout( () => {
      if ( r.status !== 'answered' ) return this.showSuggestion( r.id );
      const where = r.answeredIn;
      if ( !where ) return;
      const key = `${ where.sectionKey }-${ where.blockIndex }`;
      const el = document.getElementById( `blk-${ key }` ) || document.getElementById( `section-${ where.sectionKey }` );
      el?.scrollIntoView( { behavior: 'smooth', block: 'center' } );
      this.flash.set( key );
      setTimeout( () => { if ( this.flash() === key ) this.flash.set( '' ); }, 2000 );
    }, 50 );
  }

  private showSuggestion ( id: string ): void {
    document.getElementById( `req-${ id }` )?.scrollIntoView( { behavior: 'smooth', block: 'center' } );
  }

  setView ( view: 'draft' | 'requirements' ): void {
    if ( view === this.view() ) return;
    void this.router.navigate( [], { relativeTo: this.route, queryParams: { view: view === 'requirements' ? 'requirements' : null }, queryParamsHandling: 'merge', replaceUrl: true } );
  }

  /** Export as appendix: the matrix as a PDF or Word table. */
  async exportMatrix ( format: 'pdf' | 'docx' ): Promise<void> {
    const req = this.requirements();
    if ( !req?.items.length ) return;
    const o = this.opportunity();
    const title = `Compliance matrix · ${ o?.title || 'Proposal' }`;
    try {
      const matrix = await import( '../../shared/requirements-matrix' );
      const rows = matrix.matrixRows( req.items, this.sectionTitle );
      const blob = format === 'pdf' ?
        new Blob( [( await matrix.buildMatrixPdf( rows, { title } ) ).bytes as BlobPart], { type: 'application/pdf' } ) :
        await matrix.buildMatrixDocx( rows, { title } );
      const url = URL.createObjectURL( blob );
      const link = document.createElement( 'a' );
      link.href = url;
      link.download = `${ title.replace( ' · ', ' - ' ).replace( /[\\/:*?"<>|]+/g, '' ) }.${ format }`;
      document.body.appendChild( link );
      link.click();
      link.remove();
      setTimeout( () => URL.revokeObjectURL( url ), 1000 );
    } catch {
      this.notifications.show( 'Couldn\'t export the matrix', 'Please try again.', 'warning' );
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

function emptyRequirements (): Requirements {
  return { status: 'unchecked', items: [], summary: { total: 0, answered: 0, notAnswered: 0 }, matrixRequired: false, extractedAt: '', matchedAt: '' };
}
