import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, ViewEncapsulation, inject } from '@angular/core';

import { DkIconComponent } from '../dk-icon/dk-icon.component';

/** What's selected in the page, for "Ask TODD · 1 paragraph selected" (3b). */
export interface EditorSelection {
  text: string;
  paragraphs: number;
}

/** Highlight name for the selection TODD is revising (CSS Custom Highlight API). */
const HIGHLIGHT = 'dk-todd-selection';

/**
 * The page inside Studio (design_handoff_todd_docs 3a-3c): a toolbar (B, I,
 * U, H1, H2, list, link, then Visual / HTML) above a contenteditable page.
 * Keeps the contract DocumentEditorComponent depends on - [htmlContent] in,
 * (htmlContentChange) out - and adds what the TODD card needs: the current
 * selection, its HTML, and replacing just that passage with TODD's
 * revision. Content between <… docEditorEmpty> tags shows inside the page
 * while it's empty (the Word drop zone in 3c).
 *
 * Styles are unencapsulated (every rule under .doc-editor-shell): the page
 * is innerHTML, which Angular's scoped styles never reach.
 */
@Component( {
  selector: 'app-doc-rich-text-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, DkIconComponent],
  templateUrl: './doc-rich-text-editor.component.html',
  styleUrl: './doc-rich-text-editor.component.css',
  encapsulation: ViewEncapsulation.None,
} )
export class DocRichTextEditorComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() mode: 'email' | 'proposal' | 'signature' | 'document' = 'document';
  @Input() htmlContent = '';
  /** View only: no toolbar, nothing editable (signed in without Docs). */
  @Input() readonly = false;
  @Output() htmlContentChange = new EventEmitter<string>();
  @Output() selectionChange = new EventEmitter<EditorSelection | null>();

  @ViewChild( 'editableCanvas' ) editableCanvasRef?: ElementRef<HTMLDivElement>;

  private readonly zone = inject( NgZone );
  showSource = false;
  sourceDraft = '';
  /** The last non-empty selection inside the page, kept while you use the TODD card. */
  private savedRange: Range | null = null;

  get isEmpty (): boolean {
    return !String( this.htmlContent || '' ).replace( /<[^>]*>/g, '' ).replace( /&nbsp;/g, ' ' ).trim();
  }

  private readonly onSelectionChange = (): void => {
    const canvas = this.editableCanvasRef?.nativeElement;
    const selection = document.getSelection();
    if ( !canvas || !selection || !selection.rangeCount ) return;
    const range = selection.getRangeAt( 0 );
    if ( !canvas.contains( range.commonAncestorContainer ) ) return;
    const text = selection.toString().trim();
    this.zone.run( () => {
      if ( !text ) {
        this.savedRange = null;
        this.selectionChange.emit( null );
        return;
      }
      this.savedRange = range.cloneRange();
      const blocks = this.blocksIn( range );
      this.selectionChange.emit( { text, paragraphs: Math.max( 1, blocks ) } );
    } );
  };

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( changes['htmlContent'] && !changes['htmlContent'].firstChange ) {
      const canvas = this.editableCanvasRef?.nativeElement;
      // Typing inside the canvas owns its DOM; only push outside changes in.
      if ( canvas && canvas.innerHTML !== this.htmlContent && document.activeElement !== canvas ) {
        canvas.innerHTML = this.htmlContent || '';
      }
    }
  }

  ngAfterViewInit (): void {
    const canvas = this.editableCanvasRef?.nativeElement;
    if ( canvas ) canvas.innerHTML = this.htmlContent || '';
    this.zone.runOutsideAngular( () => document.addEventListener( 'selectionchange', this.onSelectionChange ) );
  }

  ngOnDestroy (): void {
    document.removeEventListener( 'selectionchange', this.onSelectionChange );
    this.clearHighlight();
  }

  exec ( command: string, value?: string ): void {
    this.editableCanvasRef?.nativeElement?.focus();
    document.execCommand( command, false, value );
    this.emitFromCanvas();
  }

  formatBlock ( tag: string ): void {
    this.exec( 'formatBlock', tag );
  }

  insertLink (): void {
    const url = window.prompt( 'Link URL' );
    if ( !url ) return;
    this.exec( 'createLink', url );
  }

  onCanvasInput (): void {
    this.emitFromCanvas();
  }

  /** The selected passage's HTML, or '' when nothing is selected. */
  selectionHtml (): string {
    if ( !this.savedRange ) return '';
    const holder = document.createElement( 'div' );
    holder.appendChild( this.savedRange.cloneContents() );
    return holder.innerHTML;
  }

  hasSelection (): boolean {
    return !!this.savedRange;
  }

  /** Tints the passage TODD is revising, so it stays visible while you read the preview. */
  highlightSelection (): void {
    const registry = ( globalThis as any ).CSS?.highlights;
    const HighlightCtor = ( globalThis as any ).Highlight;
    if ( !this.savedRange || !registry || !HighlightCtor ) return;
    registry.set( HIGHLIGHT, new HighlightCtor( this.savedRange ) );
  }

  clearHighlight (): void {
    ( globalThis as any ).CSS?.highlights?.delete( HIGHLIGHT );
  }

  /** Puts TODD's revision where the selection was; returns false if there's no selection. */
  replaceSelection ( html: string ): boolean {
    const range = this.savedRange;
    const canvas = this.editableCanvasRef?.nativeElement;
    if ( !range || !canvas || !canvas.contains( range.commonAncestorContainer ) ) return false;
    range.deleteContents();
    const template = document.createElement( 'template' );
    template.innerHTML = html;
    range.insertNode( template.content );
    this.savedRange = null;
    this.clearHighlight();
    this.emitFromCanvas();
    this.selectionChange.emit( null );
    return true;
  }

  private blocksIn ( range: Range ): number {
    const holder = document.createElement( 'div' );
    holder.appendChild( range.cloneContents() );
    return holder.querySelectorAll( 'p, li, h1, h2, h3, blockquote, div.dk-src' ).length;
  }

  private emitFromCanvas (): void {
    const canvas = this.editableCanvasRef?.nativeElement;
    if ( !canvas ) return;
    this.htmlContent = canvas.innerHTML;
    this.htmlContentChange.emit( this.htmlContent );
  }

  setView ( view: 'visual' | 'html' ): void {
    if ( ( view === 'html' ) === this.showSource ) return;
    if ( view === 'html' ) {
      this.sourceDraft = this.htmlContent || '';
    } else {
      this.htmlContent = this.sourceDraft;
      this.htmlContentChange.emit( this.htmlContent );
      const canvas = this.editableCanvasRef?.nativeElement;
      if ( canvas ) canvas.innerHTML = this.htmlContent;
    }
    this.showSource = view === 'html';
  }

  /** Kept for callers of the old toolbar toggle. */
  toggleSourceView (): void {
    this.setView( this.showSource ? 'visual' : 'html' );
  }

  onSourceChange ( value: string ): void {
    this.sourceDraft = value;
  }
}
