import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { documentKind, documentTitle, parseDay } from '../../models/document-kind';
import { isStale } from '../../models/knowledge';
import { DocsInbox, FIT_THRESHOLD, Opportunity, dueDate, fitTint, isOpen } from '../../models/opportunity';
import { DocsAuthService } from '../../services/docs-auth.service';
import { DocumentsStoreService } from '../../services/documents-store.service';
import { KnowledgeStoreService } from '../../services/knowledge-store.service';
import { OpportunitiesService } from '../../services/opportunities.service';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';
import { routeAsk } from './home-ask';

export interface NeedsYouItem {
  key: string;
  icon: string;
  tint: string;
  text: string;
  action: string;
  route: string[];
  queryParams?: Record<string, string>;
  /** Sooner first. */
  urgency: number;
}

const DAY = 86400000;

function daysUntil ( date: Date, now: Date ): number {
  const start = ( d: Date ) => new Date( d.getFullYear(), d.getMonth(), d.getDate() ).getTime();
  return Math.round( ( start( date ) - start( now ) ) / DAY );
}

/**
 * "Needs you" on Home (1b, reusing 1c's rows): proposals coming due, TODD's
 * open questions, compliance files about to expire, answers that need a
 * check, and an inbox Docs can't reach. Soonest first.
 */
export function needsYou ( input: {
  opportunities: Opportunity[];
  openQuestions: Record<string, number>;
  documents: { id?: any; title?: string; name?: string; type: any; dueDate?: any; src: string }[];
  staleKnowledge: number;
  failingInbox: DocsInbox | null;
  now?: Date;
} ): NeedsYouItem[] {
  const now = input.now || new Date();
  const items: NeedsYouItem[] = [];
  for ( const o of input.opportunities ) {
    if ( o.status !== 'drafting' ) continue;
    const due = dueDate( o );
    const days = due ? daysUntil( due, now ) : null;
    const questions = input.openQuestions[o.id] || 0;
    if ( questions ) {
      items.push( { key: `q-${ o.id }`, icon: 'help', tint: 'blue', text: `TODD has ${ questions } ${ questions === 1 ? 'question' : 'questions' } for the ${ o.agency || o.title } draft`, action: 'Answer', route: ['/opportunities', o.id, 'proposal'], urgency: days ?? 30 } );
    } else if ( days !== null && days >= 0 && days <= 10 ) {
      items.push( { key: `due-${ o.id }`, icon: 'clock', tint: 'pink', text: `${ o.agency || o.title } proposal is due ${ days === 0 ? 'today' : `in ${ days } ${ days === 1 ? 'day' : 'days' }` }`, action: 'Finish', route: ['/opportunities', o.id, 'proposal'], urgency: days } );
    }
  }
  for ( const doc of input.documents ) {
    if ( !doc.dueDate || documentKind( doc as any ) !== 'compliance' ) continue;
    const due = parseDay( doc.dueDate );
    if ( !due ) continue;
    const days = daysUntil( due, now );
    // Renewing insurance or a certification takes weeks, so flag two months out.
    if ( days < 0 || days > 60 ) continue;
    items.push( { key: `exp-${ doc.id }`, icon: 'alert-circle', tint: 'yellow', text: `Your ${ documentTitle( doc as any ) } expires ${ due.toLocaleDateString( 'en-US', { month: 'short', day: 'numeric' } ) }`, action: 'Upload', route: ['/upload'], urgency: days } );
  }
  if ( input.failingInbox ) {
    items.push( { key: 'inbox', icon: 'inbox', tint: 'pink', text: `Docs can't reach ${ input.failingInbox.emailAddress }`, action: 'Fix', route: ['/opportunities', 'inbox'], urgency: 1 } );
  }
  if ( input.staleKnowledge ) {
    items.push( { key: 'stale', icon: 'book', tint: 'cyan', text: `${ input.staleKnowledge } Knowledge ${ input.staleKnowledge === 1 ? 'answer is' : 'answers are' } over a year old`, action: 'Review', route: ['/knowledge'], queryParams: { review: '1' }, urgency: 60 } );
  }
  return items.sort( ( a, b ) => a.urgency - b.urgency );
}

/**
 * Home (design_handoff_todd_docs 1b; 2a signed out): one ask box that
 * routes what you type, quick actions, the RFPs that fit, and what needs
 * you. Signed out it explains Docs and points to About and Help.
 * Replaces the Docs cockpit.
 */
@Component( {
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, DkIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
} )
export class HomeComponent implements OnInit {
  private readonly router = inject( Router );
  private readonly auth = inject( DocsAuthService );
  private readonly opportunities = inject( OpportunitiesService );
  private readonly knowledge = inject( KnowledgeStoreService );
  private readonly documents = inject( DocumentsStoreService );

  readonly signedIn = signal<boolean | null>( null );
  readonly ask = signal( '' );
  /** Signed out, the box explains instead of searching. */
  readonly guestAsked = signal( '' );
  readonly inboxes = signal<DocsInbox[]>( [] );
  readonly openQuestions = signal<Record<string, number>>( {} );
  /** Phone (1l): "N things need you" opens the list. */
  readonly needsOpen = signal( false );
  readonly loaded = this.opportunities.loaded;

  readonly fits = computed( () => this.opportunities.opportunities()
      .filter( ( o ) => o.status === 'new' && isOpen( o ) && o.fit.score >= FIT_THRESHOLD )
      .sort( ( a, b ) => b.fit.score - a.fit.score ) );

  readonly needs = computed( () => needsYou( {
    opportunities: this.opportunities.opportunities(),
    openQuestions: this.openQuestions(),
    documents: this.documents.documents(),
    staleKnowledge: this.knowledge.items().filter( ( k ) => isStale( k ) ).length,
    failingInbox: this.inboxes().find( ( i ) => i.purposes.includes( 'rfp' ) && i.rfpLastSyncStatus === 'failed' ) || null,
  } ) );

  readonly fitTint = fitTint;

  readonly quick = [
    { label: 'Answer an RFP', icon: 'file', tint: 'violet', route: '/opportunities' },
    { label: 'Find a document', icon: 'search', tint: 'blue', route: '/documents' },
    { label: 'Add files', icon: 'upload', tint: 'green', route: '/upload' },
    { label: 'Ask Knowledge', icon: 'book', tint: 'cyan', route: '/knowledge' },
  ];

  /** Signed out (2a): copy kept from Help's "how Docs is different". */
  readonly pillars = [
    { icon: 'file', tint: 'violet', title: 'From RFP to first draft', copy: 'TODD reads the RFPs that reach your inbox, scores each against your profile and drafts the proposal, so you start editing instead of starting from a blank page.' },
    { icon: 'book', tint: 'cyan', title: 'Knowledge stays when people leave', copy: 'Every answer your team gives while drafting is saved to Knowledge with its sources, ready for the next proposal and the next person.' },
    { icon: 'folder', tint: 'green', title: 'One home for every kind of file', copy: 'RFP source files, drafts, notes, PDFs, images, videos and music live in one searchable library instead of five different tools.' },
  ];

  ngOnInit (): void {
    this.auth.isLoggedIn().subscribe( ( value ) => {
      this.signedIn.set( !!value );
      if ( value ) void this.loadWorkspace();
    } );
  }

  private async loadWorkspace (): Promise<void> {
    this.knowledge.load().subscribe();
    this.documents.load().subscribe();
    this.opportunities.listInboxes().subscribe( { next: ( list ) => this.inboxes.set( list ), error: () => this.inboxes.set( [] ) } );
    const list = await firstValueFrom( this.opportunities.load( true ) );
    // TODD's open questions, for the drafts most likely to need them.
    const drafting = list.filter( ( o ) => o.status === 'drafting' ).slice( 0, 4 );
    const counts: Record<string, number> = {};
    await Promise.all( drafting.map( async ( o ) => {
      const draft = await firstValueFrom( this.opportunities.getProposal( o.id ) ).catch( () => null );
      const open = ( draft?.questions || [] ).filter( ( q ) => q.status === 'open' ).length;
      if ( open ) counts[o.id] = open;
    } ) );
    this.openQuestions.set( counts );
  }

  submit (): void {
    const text = this.ask().trim();
    if ( !text ) return;
    if ( !this.signedIn() ) {
      this.guestAsked.set( text );
      return;
    }
    const route = routeAsk( text );
    if ( route ) void this.router.navigate( [route.path], { queryParams: route.queryParams } );
  }
}
