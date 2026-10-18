import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { approvalLink, shareMessage } from '../../models/approval';
import { DkIconComponent } from '../dk-icon/dk-icon.component';

export type ShareVia = 'copy' | 'email' | 'message' | 'share';

/**
 * An approver's private link and the ways to send it: copy it, or open the
 * owner's own mail app or Messages with a short note filled in. TODD sends
 * nothing itself.
 */
@Component( {
  selector: 'app-approver-share',
  standalone: true,
  imports: [DkIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="as" [class.as--compact]="compact()">
      <button type="button" class="dk-btn dk-btn--sm as__btn" (click)="copy()" [attr.aria-label]="'Copy ' + label() + '\\'s link'">
        <dk-icon [name]="copied() ? 'check' : 'copy'" [size]="15" />{{ copied() ? 'Copied' : 'Copy link' }}
      </button>
      <a class="dk-btn dk-btn--sm as__btn" [href]="mailto()" (click)="shared.emit('email')" [attr.aria-label]="'Email ' + label() + ' their link'"><dk-icon name="mail" [size]="15" />Email</a>
      <a class="dk-btn dk-btn--sm as__btn" [href]="sms()" (click)="shared.emit('message')" [attr.aria-label]="'Text ' + label() + ' their link'"><dk-icon name="message" [size]="15" />Message</a>
      @if (canShare) {
        <button type="button" class="dk-btn dk-btn--sm as__btn" (click)="nativeShare()" aria-label="More ways to share"><dk-icon name="share" [size]="15" />More</button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .as { display: flex; flex-wrap: wrap; gap: 6px; }
    .as__btn { background: var(--surface); gap: 6px; }
    .as--compact .as__btn { background: var(--bg); }
    a.as__btn { display: inline-flex; align-items: center; color: var(--text) !important; }
  `],
} )
export class ApproverShareComponent {
  readonly approver = input.required<{ name: string; email: string; token: string }>();
  readonly ownerName = input( '' );
  readonly buyer = input( '' );
  readonly dueAt = input( '' );
  readonly note = input( '' );
  readonly compact = input( false );
  readonly shared = output<ShareVia>();

  readonly copied = signal( false );
  readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  readonly link = computed( () => approvalLink( this.approver().token ) );
  readonly label = computed( () => this.approver().name || this.approver().email || 'this approver' );
  private readonly message = computed( () => shareMessage( { ownerName: this.ownerName(), buyer: this.buyer(), dueAt: this.dueAt(), note: this.note() }, this.approver(), this.link() ) );
  readonly mailto = computed( () => {
    const m = this.message();
    return `mailto:${ encodeURIComponent( this.approver().email || '' ) }?subject=${ encodeURIComponent( m.subject ) }&body=${ encodeURIComponent( m.body ) }`;
  } );
  /** `sms:?&body=` opens Messages on iPhone, Mac and Android. */
  readonly sms = computed( () => `sms:?&body=${ encodeURIComponent( this.message().sms ) }` );

  async copy (): Promise<void> {
    try {
      await navigator.clipboard.writeText( this.link() );
    } catch {
      window.prompt( 'Copy this link', this.link() );
    }
    this.copied.set( true );
    this.shared.emit( 'copy' );
    setTimeout( () => this.copied.set( false ), 2000 );
  }

  async nativeShare (): Promise<void> {
    const m = this.message();
    try {
      await navigator.share( { title: m.subject, text: m.sms.replace( this.link(), '' ).trim(), url: this.link() } );
      this.shared.emit( 'share' );
    } catch {
      // Dismissed: nothing was shared.
    }
  }
}
