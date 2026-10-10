import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Document } from '../../models/document.model';
import { DocsAuthService } from '../../services/docs-auth.service';
import { DocsDropdownService } from '../../services/docs-dropdown.service';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { DocumentsStoreService } from '../../services/documents-store.service';
import { KnowledgeStoreService } from '../../services/knowledge-store.service';
import { ResponseFlowService } from '../../services/response-flow.service';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';
import { WriteActionDirective } from '../../shared/write-access/write-action.directive';
import { AnswerDoc, AnswerForm, answerStatus, fromRecord, linkLabel, normalizeUrl, toPayload } from './answer-form.helpers';

const CATEGORY_LIST = 'KNOWLEDGE_BASE_CATEGORIES';

type AttachTarget = { kind: 'answer' | 'recommendation'; index: number };

/**
 * Add / Edit answer (design_handoff_todd_docs 3d) at
 * /knowledge/response-flow (?id= or /:id to edit): one page in place of
 * the step-by-step wizard. Question, category, one or more answers with an
 * optional link or document each, and optional recommendations, resources
 * and keywords. TODD picks the category and suggests keywords. Status is
 * derived: no question or no answer text saves a draft, which TODD won't
 * use in proposals. Delete stays on the answer page (2d).
 */
@Component( {
  selector: 'app-answer-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DkIconComponent, WriteActionDirective],
  templateUrl: './answer-form.component.html',
  styleUrl: './answer-form.component.css',
} )
export class AnswerFormComponent implements OnInit {
  private readonly route = inject( ActivatedRoute );
  private readonly router = inject( Router );
  private readonly api = inject( ResponseFlowService );
  private readonly http = inject( HttpClient );
  private readonly auth = inject( DocsAuthService );
  private readonly dropdowns = inject( DocsDropdownService );
  private readonly notifications = inject( DocsNotificationService );
  private readonly knowledge = inject( KnowledgeStoreService );
  private readonly documentsStore = inject( DocumentsStoreService );

  form: AnswerForm = { question: '', category: '', answers: [{ answer: '', source: '', document: null }], recommendations: [], resources: [], keywords: [] };
  /** Kept as it was (Maya's internal-reference flag isn't on this page). */
  private mayaReference = false;

  readonly id = signal( '' );
  readonly loading = signal( false );
  readonly saving = signal( false );
  readonly categories = signal<string[]>( [] );
  readonly suggestedKeywords = signal<string[]>( [] );
  /** "I picked the category from your question" once TODD has. */
  readonly toddPickedCategory = signal( false );
  private newCategory = '';

  /** Inline editors: which answer is adding a link, and the attach picker. */
  linkFor = -1;
  linkDraft = '';
  resourceDraft = '';
  addingResource = false;
  keywordDraft = '';
  attachTarget: AttachTarget | null = null;
  attachSearch = '';
  uploading = false;

  private tenantId = '';
  private userId = '';

  readonly isEdit = computed( () => !!this.id() );
  readonly documents = this.documentsStore.documents;
  readonly linkLabel = linkLabel;

  get status () {
    return answerStatus( this.form );
  }

  get attachChoices (): Document[] {
    const q = this.attachSearch.trim().toLowerCase();
    return this.documents()
        .filter( ( d ) => d.src && ( !q || `${ d.title || '' } ${ d.name }`.toLowerCase().includes( q ) ) )
        .slice( 0, 8 );
  }

  ngOnInit (): void {
    this.auth.getTenantId().subscribe( async ( tenantId ) => {
      this.tenantId = String( tenantId || '' );
      if ( !this.tenantId ) return;
      try {
        const items = await this.dropdowns.getItems( this.tenantId, CATEGORY_LIST );
        this.categories.set( items.map( ( i ) => i.name ).filter( Boolean ).sort( ( a, b ) => a.localeCompare( b ) ) );
      } catch { this.categories.set( [] ); }
    } );
    this.auth.getUserId().subscribe( ( userId ) => {
      this.userId = String( userId || '' );
      if ( this.userId ) this.documentsStore.load().subscribe();
    } );
    const id = this.route.snapshot.paramMap.get( 'id' ) || this.route.snapshot.queryParamMap.get( 'id' ) || '';
    if ( id ) {
      this.id.set( id );
      this.loading.set( true );
      this.api.getResponseFlow( id ).subscribe( {
        next: ( raw ) => {
          this.form = fromRecord( raw );
          this.mayaReference = raw?.mayaReference === true;
          this.loading.set( false );
        },
        error: () => {
          this.loading.set( false );
          this.notifications.show( 'Couldn\'t open that answer', 'It may have been deleted.', 'warning' );
        },
      } );
    }
  }

  // ── TODD's suggestions ─────────────────────────────────────────
  async suggest (): Promise<void> {
    if ( !this.form.question.trim() || ( this.form.category && this.suggestedKeywords().length ) ) return;
    try {
      const response = await firstValueFrom( this.http.post<{ data: { category: string; isNewCategory: boolean; keywords: string[] } }>(
        `${ environment.backendURL }/docs/knowledge/suggest`,
        { question: this.form.question, answers: this.form.answers.map( ( a ) => a.answer ).filter( Boolean ), categories: this.categories() },
      ) );
      const s = response?.data;
      if ( !s ) return;
      if ( !this.form.category && s.category ) {
        this.form.category = s.category;
        this.toddPickedCategory.set( true );
        if ( s.isNewCategory ) {
          this.newCategory = s.category;
          this.categories.update( ( list ) => [...list, s.category] );
        }
      }
      this.suggestedKeywords.set( s.keywords.filter( ( k ) => !this.form.keywords.includes( k ) ) );
    } catch { /* suggestions are optional */ }
  }

  // ── Answers ────────────────────────────────────────────────────
  addAnswer (): void {
    this.form.answers.push( { answer: '', source: '', document: null } );
  }

  removeAnswer ( index: number ): void {
    this.form.answers.splice( index, 1 );
    if ( !this.form.answers.length ) this.addAnswer();
  }

  startLink ( index: number ): void {
    this.linkFor = index;
    this.linkDraft = '';
  }

  saveLink (): void {
    const url = normalizeUrl( this.linkDraft );
    if ( url && this.linkFor >= 0 ) this.form.answers[this.linkFor].source = url;
    this.linkFor = -1;
  }

  // ── Attachments (answers and recommendations) ──────────────────
  openAttach ( target: AttachTarget ): void {
    this.attachTarget = target;
    this.attachSearch = '';
  }

  attach ( doc: AnswerDoc ): void {
    const target = this.attachTarget;
    if ( !target ) return;
    const clean = { name: doc.name, src: doc.src, type: doc.type || 'document' };
    if ( target.kind === 'answer' ) this.form.answers[target.index].document = clean;
    else this.form.recommendations[target.index].document = clean;
    this.attachTarget = null;
  }

  /** A file from this computer: stored where the wizard stored them. */
  async uploadAndAttach ( event: Event ): Promise<void> {
    const file = ( event.target as HTMLInputElement ).files?.[0];
    if ( !file ) return;
    this.uploading = true;
    try {
      const storageRef = ref( getStorage(), `${ this.userId ? `documents/${ this.userId }` : 'documents' }/${ file.name }` );
      await uploadBytes( storageRef, file );
      this.attach( { name: file.name, src: await getDownloadURL( storageRef ), type: file.type.startsWith( 'image/' ) ? 'image' : file.type.startsWith( 'video/' ) ? 'video' : 'document' } );
    } catch {
      this.notifications.show( 'Upload failed', 'Try again, or attach a document that\'s already in Docs.', 'warning' );
    } finally {
      this.uploading = false;
    }
  }

  // ── Optional sections ──────────────────────────────────────────
  addRecommendation (): void {
    this.form.recommendations.push( { type: 'Practice', text: '', link: '', document: null } );
  }

  addResource (): void {
    const url = normalizeUrl( this.resourceDraft );
    if ( url && !this.form.resources.some( ( r ) => r.link === url ) ) this.form.resources.push( { link: url } );
    this.resourceDraft = '';
    this.addingResource = false;
  }

  addKeyword ( value: string ): void {
    const k = String( value || '' ).trim().toLowerCase();
    if ( k && !this.form.keywords.includes( k ) ) this.form.keywords.push( k );
    this.suggestedKeywords.update( ( list ) => list.filter( ( s ) => s !== k ) );
    this.keywordDraft = '';
  }

  removeKeyword ( k: string ): void {
    this.form.keywords = this.form.keywords.filter( ( x ) => x !== k );
  }

  // ── Save ───────────────────────────────────────────────────────
  async save (): Promise<void> {
    if ( this.saving() ) return;
    if ( !this.form.question.trim() && !this.form.answers.some( ( a ) => a.answer.trim() ) ) {
      this.notifications.show( 'Nothing to save yet', 'Write a question or an answer first.', 'warning' );
      return;
    }
    this.saving.set( true );
    const payload = toPayload( this.form, { mayaReference: this.mayaReference } );
    try {
      if ( this.newCategory && this.form.category === this.newCategory && this.tenantId ) {
        await this.dropdowns.addItem( this.tenantId, CATEGORY_LIST, this.newCategory ).catch( () => null );
      }
      const saved = this.id()
        ? await firstValueFrom( this.api.updateResponseFlow( this.id(), payload ) )
        : await firstValueFrom( this.api.createResponseFlow( payload ) );
      const savedId = String( saved?.id || this.id() );
      this.knowledge.loaded.set( false );
      this.notifications.show( payload['status'] === 'draft' ? 'Saved as a draft' : 'Answer saved', payload['status'] === 'draft' ? 'TODD won\'t use it in proposals until it has a question and an answer.' : 'TODD can use it in your next proposal.', 'success' );
      void this.router.navigate( savedId ? ['/knowledge', savedId] : ['/knowledge'] );
    } catch ( error: any ) {
      this.notifications.show( 'Couldn\'t save it', error?.error?.message || 'Please try again.', 'warning' );
    } finally {
      this.saving.set( false );
    }
  }

  cancel (): void {
    void this.router.navigate( this.id() ? ['/knowledge', this.id()] : ['/knowledge'] );
  }
}
