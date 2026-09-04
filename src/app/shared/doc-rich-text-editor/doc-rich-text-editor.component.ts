import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';

/**
 * Trimmed, document-only replacement for taliferrotech's
 * shared/page/email-editor/email-editor.component.ts (1553 lines). That
 * component is primarily an EMAIL composer - contact merge fields,
 * attachments, EmailService send integration, a signature-builder mode -
 * that also happens to expose a `mode="document"` input DocumentEditorComponent
 * used purely for its WYSIWYG surface. In 'document' mode, none of the
 * email/signature-specific code paths in the original ever execute (they're
 * all gated behind `if (this.mode === 'email' | 'signature')` checks), so
 * porting the full file would drag in EmailService, the Contact model, and
 * other compile-time dependencies this app has no other use for.
 *
 * This keeps the exact same contract DocumentEditorComponent depends on -
 * `[htmlContent]` in, `(htmlContentChange)` out, a `mode` input kept for
 * API compatibility - and reimplements just the rich-text surface: a
 * contenteditable canvas with a formatting toolbar (bold/italic/underline/
 * strike, headings, lists, blockquote, link, undo/redo) plus an HTML
 * source view, using the browser's built-in `document.execCommand`.
 */
@Component( {
  selector: 'app-doc-rich-text-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './doc-rich-text-editor.component.html',
  styleUrl: './doc-rich-text-editor.component.css',
} )
export class DocRichTextEditorComponent implements OnChanges {
  @Input() mode: 'email' | 'proposal' | 'signature' | 'document' = 'document';
  @Input() htmlContent = '';
  @Output() htmlContentChange = new EventEmitter<string>();

  @ViewChild( 'editableCanvas' ) editableCanvasRef?: ElementRef<HTMLDivElement>;

  showSource = false;
  sourceDraft = '';

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( changes['htmlContent'] && !changes['htmlContent'].firstChange ) {
      const canvas = this.editableCanvasRef?.nativeElement;
      // Only push external updates in - typing inside the canvas already
      // owns its own DOM, re-setting innerHTML on every keystroke would
      // fight the caret position.
      if ( canvas && canvas.innerHTML !== this.htmlContent && document.activeElement !== canvas ) {
        canvas.innerHTML = this.htmlContent || '';
      }
    }
  }

  ngAfterViewInit (): void {
    const canvas = this.editableCanvasRef?.nativeElement;
    if ( canvas ) {
      canvas.innerHTML = this.htmlContent || '';
    }
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

  private emitFromCanvas (): void {
    const canvas = this.editableCanvasRef?.nativeElement;
    if ( !canvas ) return;
    this.htmlContent = canvas.innerHTML;
    this.htmlContentChange.emit( this.htmlContent );
  }

  toggleSourceView (): void {
    if ( !this.showSource ) {
      this.sourceDraft = this.htmlContent || '';
    } else {
      this.htmlContent = this.sourceDraft;
      this.htmlContentChange.emit( this.htmlContent );
      const canvas = this.editableCanvasRef?.nativeElement;
      if ( canvas ) canvas.innerHTML = this.htmlContent;
    }
    this.showSource = !this.showSource;
  }

  onSourceChange ( value: string ): void {
    this.sourceDraft = value;
  }
}
