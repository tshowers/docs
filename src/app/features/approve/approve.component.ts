import { CommonModule } from '@angular/common';
import { AfterViewChecked, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, OnInit, SecurityContext, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { APPROVER_STATE, ApprovalComment, GuestApproval, blockKey, displayName, firstName, initials, longWhen, personTint } from '../../models/approval';
import { ApprovalsService } from '../../services/approvals.service';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';

interface Composer { mode: 'comment' | 'suggest'; quote: string; sectionTitle: string; text: string; replacement: string; }

/**
 * An approver's review (design_handoff_todd_docs 4e, 4f on a phone). The
 * private link is the only access: no TODD account, no sign-in. They read
 * the proposal exactly as the buyer will get it, comment or suggest edits
 * on selected text, and approve or request changes. After an edit, someone
 * who already approved sees what changed; the rest is marked reviewed.
 */
@Component( {
  selector: 'app-approve',
  standalone: true,
  imports: [CommonModule, FormsModule, DkIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './approve.component.html',
  styleUrl: './approve.component.css',
} )
export class ApproveComponent implements OnInit, AfterViewChecked {
  private readonly route = inject( ActivatedRoute );
  private readonly api = inject( ApprovalsService );
  private readonly sanitizer = inject( DomSanitizer );
  private readonly title = inject( Title );
  private readonly destroyRef = inject( DestroyRef );

  @ViewChild( 'page' ) pageRef?: ElementRef<HTMLElement>;

  readonly shortDay = ( iso: string ) => iso ? new Date( iso ).toLocaleDateString( 'en-US', { month: 'short', day: 'numeric' } ) : '';
  readonly phase = signal<'loading' | 'ready' | 'error'>( 'loading' );
  readonly errorMessage = signal( '' );
  readonly data = signal<GuestApproval | null>( null );
  readonly pdfBusy = signal( false );
  readonly shortDue = ( date: string ) => {
    const at = /^\d{4}-\d{2}-\d{2}$/.test( date ) ? new Date( `${ date }T12:00:00` ) : new Date( date );
    return isNaN( at.getTime() ) ? '' : at.toLocaleDateString( 'en-US', { month: 'short', day: 'numeric' } );
  };

  /** Download PDF (lifecycle 1n): this exact version, built the way Review & send builds it. */
  async downloadPdf (): Promise<void> {
    const d = this.data();
    if ( !d || this.pdfBusy() ) return;
    this.pdfBusy.set( true );
    try {
      const { buildProposalPdf } = await import( '../../shared/proposal-pdf' );
      const title = `Proposal · ${ d.opportunity.title }`;
      const pdf = await buildProposalPdf( d.html, { title, author: d.company } );
      const url = URL.createObjectURL( new Blob( [pdf.bytes as BlobPart], { type: 'application/pdf' } ) );
      const link = document.createElement( 'a' );
      link.href = url;
      link.download = `${ title.replace( ' · ', ' - ' ).replace( /[\\/:*?"<>|]+/g, '' ) } (version ${ d.version }).pdf`;
      document.body.appendChild( link );
      link.click();
      link.remove();
      setTimeout( () => URL.revokeObjectURL( url ), 1000 );
    } finally {
      this.pdfBusy.set( false );
    }
  }
  readonly composer = signal<Composer | null>( null );
  readonly selection = signal<{ quote: string; sectionTitle: string; top: number; left: number } | null>( null );
  readonly busy = signal<'' | 'approve' | 'changes' | 'comment'>( '' );
  readonly problem = signal( '' );
  readonly activeSection = signal( '' );
  readonly showDiffOnly = signal( true );
  message = '';

  private token = '';
  private renderedFor = '';

  readonly APPROVER_STATE = APPROVER_STATE;
  readonly initials = initials;
  readonly longWhen = longWhen;
  readonly displayName = displayName;
  readonly firstName = firstName;
  readonly tint = ( key: string ) => personTint( key );

  readonly sections = computed( () => {
    const d = this.data();
    if ( !d ) return [] as { title: string; count: number }[];
    const doc = new DOMParser().parseFromString( this.clean( d.html ), 'text/html' );
    return Array.from( doc.body.querySelectorAll( 'h1, h2, h3' ) ).map( ( h ) => {
      const title = blockKey( h.textContent || '' );
      return { title, count: d.comments.filter( ( c ) => c.sectionTitle === title && c.status === 'open' ).length };
    } ).filter( ( s ) => s.title );
  } );
  readonly decided = computed( () => {
    const state = this.data()?.me.state;
    return state === 'approved' || state === 'changes';
  } );
  readonly othersLine = computed( () => {
    const d = this.data();
    if ( !d ) return '';
    return d.others.map( ( o ) => {
      if ( o.state === 'approved' ) return `${ o.name } approved${ o.decidedAt ? ` ${ this.timeOf( o.decidedAt ) }` : '' }.`;
      if ( o.state === 'changes' ) return `${ o.name } requested changes.`;
      return `${ o.name } hasn't decided yet.`;
    } ).join( ' ' );
  } );
  readonly myCommentCount = computed( () => ( this.data()?.comments || [] ).length );

  ngOnInit (): void {
    this.route.paramMap.pipe( takeUntilDestroyed( this.destroyRef ) ).subscribe( ( params ) => {
      this.token = String( params.get( 'token' ) || '' );
      void this.load();
    } );
  }

  ngAfterViewChecked (): void {
    // The page is drawn once per version of the data, after Angular renders the container.
    const d = this.data();
    const host = this.pageRef?.nativeElement;
    if ( !d || !host ) return;
    const key = `${ d.version }|${ d.comments.map( ( c ) => c.id + c.status ).join( ',' ) }|${ this.showDiffOnly() }`;
    if ( key === this.renderedFor ) return;
    this.renderedFor = key;
    this.draw( host, d );
  }

  private async load (): Promise<void> {
    this.phase.set( 'loading' );
    try {
      const data = await firstValueFrom( this.api.open( this.token ) );
      this.data.set( data );
      this.message = data.me.message || '';
      this.title.setTitle( `Approve · ${ data.opportunity.title || 'Proposal' }` );
      this.phase.set( 'ready' );
    } catch ( error: any ) {
      this.errorMessage.set( error?.error?.message || 'This link doesn\'t work. Ask whoever sent it for a new one.' );
      this.phase.set( 'error' );
    }
  }

  private clean ( html: string ): string {
    return this.sanitizer.sanitize( SecurityContext.HTML, html || '' ) || '';
  }

  /** Renders the proposal, marks what changed since their last approval, and places their comments. */
  private draw ( host: HTMLElement, d: GuestApproval ): void {
    host.innerHTML = this.clean( d.html ) || '<p class="ap__empty">The proposal is empty.</p>';
    host.querySelectorAll( 'h1, h2, h3' ).forEach( ( h, i ) => ( h as HTMLElement ).id = `ap-sec-${ i }` );

    if ( d.previousHtml ) {
      const before = new DOMParser().parseFromString( this.clean( d.previousHtml ), 'text/html' );
      const seen = new Set( Array.from( before.body.children ).map( ( el ) => blockKey( el.textContent || '' ) ) );
      Array.from( host.children ).forEach( ( el ) => {
        const changed = !seen.has( blockKey( el.textContent || '' ) ) && !!blockKey( el.textContent || '' );
        el.classList.add( changed ? 'ap-changed' : 'ap-reviewed' );
        if ( !changed && this.showDiffOnly() && !/^H[1-3]$/.test( el.tagName ) ) el.classList.add( 'ap-folded' );
      } );
    }

    for ( const c of d.comments ) this.place( host, c, d.me );
  }

  private place ( host: HTMLElement, c: ApprovalComment, me: GuestApproval['me'] ): void {
    let anchor: HTMLElement | null = null;
    if ( c.quote ) {
      const walker = document.createTreeWalker( host, NodeFilter.SHOW_TEXT );
      let node: Node | null;
      while ( ( node = walker.nextNode() ) ) {
        const text = node.nodeValue || '';
        const at = text.indexOf( c.quote );
        if ( at < 0 || ( node.parentElement && node.parentElement.closest( '.ap-card, del, ins' ) ) ) continue;
        const range = document.createRange();
        range.setStart( node, at );
        range.setEnd( node, at + c.quote.length );
        const wrap = document.createElement( 'span' );
        wrap.className = c.replacement !== null ? 'ap-sugg' : 'ap-mark';
        if ( c.replacement !== null && c.status === 'open' ) {
          const del = document.createElement( 'del' );
          del.textContent = c.quote;
          const ins = document.createElement( 'ins' );
          ins.textContent = c.replacement;
          range.deleteContents();
          wrap.append( del, ' ', ins );
          range.insertNode( wrap );
        } else {
          range.surroundContents( wrap );
        }
        anchor = wrap;
        break;
      }
    }
    // The card follows the block holding the quote, or the section's heading.
    let block: Element | null = anchor;
    while ( block && block.parentElement !== host ) block = block.parentElement;
    if ( !block && c.sectionTitle ) block = Array.from( host.querySelectorAll( 'h1, h2, h3' ) ).find( ( h ) => blockKey( h.textContent || '' ) === c.sectionTitle ) || null;

    const card = document.createElement( 'div' );
    card.className = 'ap-card';
    card.dataset['tint'] = 'yellow';
    const av = document.createElement( 'span' );
    av.className = 'ap-card__av';
    av.textContent = initials( me.name, me.email );
    const body = document.createElement( 'div' );
    const head = document.createElement( 'strong' );
    const kind = c.replacement !== null ? 'suggested edit' : 'comment';
    const status = c.status === 'accepted' ? ' · accepted' : c.status === 'rejected' ? ' · not used' : '';
    head.textContent = `${ displayName( me ) } · ${ kind }${ status }`;
    body.appendChild( head );
    if ( c.text ) {
      const p = document.createElement( 'p' );
      p.textContent = c.text;
      body.appendChild( p );
    }
    for ( const r of c.replies || [] ) {
      const p = document.createElement( 'p' );
      p.className = 'ap-card__reply';
      p.textContent = `${ r.by }: ${ r.text }`;
      body.appendChild( p );
    }
    card.append( av, body );
    if ( block ) block.after( card );
    else host.appendChild( card );
  }

  // ── Selecting text: Comment / Suggest edit ─────────────────────
  @HostListener( 'document:selectionchange' )
  onSelectionChange (): void {
    const host = this.pageRef?.nativeElement;
    const d = this.data();
    if ( !host || !d || d.readOnly || this.composer() ) return;
    const sel = document.getSelection();
    if ( !sel || sel.isCollapsed || !sel.rangeCount ) { this.selection.set( null ); return; }
    const range = sel.getRangeAt( 0 );
    if ( !host.contains( range.commonAncestorContainer ) ) { this.selection.set( null ); return; }
    const quote = sel.toString().replace( /\s+/g, ' ' ).trim().slice( 0, 1000 );
    if ( quote.length < 2 ) { this.selection.set( null ); return; }
    const rect = range.getBoundingClientRect();
    this.selection.set( { quote, sectionTitle: this.sectionOf( host, range.startContainer ), top: rect.top, left: rect.left + rect.width / 2 } );
  }

  @HostListener( 'window:scroll' )
  onScroll (): void {
    if ( this.selection() ) this.onSelectionChange();
  }

  private sectionOf ( host: HTMLElement, node: Node ): string {
    let block: Node | null = node;
    while ( block && block.parentNode !== host ) block = block.parentNode;
    let el = block as Element | null;
    while ( el ) {
      if ( /^H[1-3]$/.test( el.tagName ) ) return blockKey( el.textContent || '' );
      el = el.previousElementSibling;
    }
    return '';
  }

  startComposer ( mode: 'comment' | 'suggest' ): void {
    const s = this.selection();
    if ( !s ) return;
    this.composer.set( { mode, quote: s.quote, sectionTitle: s.sectionTitle, text: '', replacement: mode === 'suggest' ? s.quote : '' } );
    this.selection.set( null );
    document.getSelection()?.removeAllRanges();
    this.problem.set( '' );
  }

  /** A comment on a section without selecting text (keyboard and phone friendly). */
  commentOnSection ( title: string ): void {
    this.composer.set( { mode: 'comment', quote: '', sectionTitle: title, text: '', replacement: '' } );
    this.problem.set( '' );
  }

  async saveComment (): Promise<void> {
    const c = this.composer();
    const d = this.data();
    if ( !c || !d || this.busy() ) return;
    const replacement = c.mode === 'suggest' ? c.replacement.trim() : '';
    if ( c.mode === 'suggest' && ( !replacement || replacement === c.quote ) ) { this.problem.set( 'Change the text to suggest an edit.' ); return; }
    if ( c.mode === 'comment' && !c.text.trim() ) { this.problem.set( 'Write a comment.' ); return; }
    this.busy.set( 'comment' );
    try {
      const saved = await firstValueFrom( this.api.comment( this.token, { sectionTitle: c.sectionTitle, quote: c.quote, text: c.text.trim(), replacement: replacement || undefined } ) );
      this.data.set( { ...d, comments: [...d.comments, saved] } );
      this.composer.set( null );
    } catch ( error: any ) {
      this.problem.set( error?.error?.message || '16Ahead couldn\'t save that. Try again.' );
    } finally {
      this.busy.set( '' );
    }
  }

  async decide ( decision: 'approve' | 'changes' ): Promise<void> {
    const d = this.data();
    if ( !d || this.busy() || d.readOnly ) return;
    if ( decision === 'changes' && !this.message.trim() && !d.comments.some( ( c ) => c.status === 'open' ) ) {
      this.problem.set( `Tell ${ firstName( { name: d.ownerName } ) } what to change, or comment on the text first.` );
      document.getElementById( 'ap-message' )?.focus();
      return;
    }
    this.busy.set( decision );
    this.problem.set( '' );
    try {
      this.data.set( await firstValueFrom( this.api.decide( this.token, decision, this.message.trim() ) ) );
    } catch ( error: any ) {
      this.problem.set( error?.error?.message || '16Ahead couldn\'t save that. Try again.' );
    } finally {
      this.busy.set( '' );
    }
  }

  goTo ( index: number, title: string ): void {
    this.activeSection.set( title );
    document.getElementById( `ap-sec-${ index }` )?.scrollIntoView( { behavior: 'smooth', block: 'start' } );
  }

  timeOf ( value: string ): string {
    const d = new Date( value );
    if ( isNaN( d.getTime() ) ) return '';
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay ? `at ${ d.toLocaleTimeString( 'en-US', { hour: 'numeric', minute: '2-digit' } ) }` : `on ${ d.toLocaleDateString( 'en-US', { month: 'short', day: 'numeric' } ) }`;
  }
}
