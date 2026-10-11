import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { DocsInbox } from '../../models/opportunity';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { OpportunitiesService } from '../../services/opportunities.service';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';
import { WriteActionDirective } from '../../shared/write-access/write-action.directive';
import { checkedAgo } from '../opportunities/opportunities.component';

type ProviderId = 'gmail' | 'outlook' | 'icloud' | 'yahoo' | 'dreamhost' | 'other_imap';

/** Same presets as Outreach's Inbox Access (mail-provider-config.js on the server). */
const PROVIDERS: { id: ProviderId; label: string; imap: { host: string; port: number; secure: boolean }; smtp: { host: string; port: number; secure: boolean } }[] = [
  { id: 'gmail', label: 'Gmail with an app password', imap: { host: 'imap.gmail.com', port: 993, secure: true }, smtp: { host: 'smtp.gmail.com', port: 465, secure: true } },
  { id: 'outlook', label: 'Outlook / Microsoft 365', imap: { host: 'outlook.office365.com', port: 993, secure: true }, smtp: { host: 'smtp.office365.com', port: 587, secure: false } },
  { id: 'icloud', label: 'iCloud', imap: { host: 'imap.mail.me.com', port: 993, secure: true }, smtp: { host: 'smtp.mail.me.com', port: 587, secure: false } },
  { id: 'yahoo', label: 'Yahoo', imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true }, smtp: { host: 'smtp.mail.yahoo.com', port: 465, secure: true } },
  { id: 'dreamhost', label: 'DreamHost', imap: { host: 'imap.dreamhost.com', port: 993, secure: true }, smtp: { host: 'smtp.dreamhost.com', port: 465, secure: true } },
  { id: 'other_imap', label: 'Another provider (IMAP)', imap: { host: '', port: 993, secure: true }, smtp: { host: '', port: 465, secure: true } },
];

/** A sender TODD should watch: a full address or a whole @domain, like the server accepts. */
export function normalizeSender ( value: string ): string {
  let sender = String( value || '' ).trim().toLowerCase().replace( /^mailto:/, '' );
  if ( sender && !sender.includes( '@' ) ) sender = `@${ sender }`;
  return /^([a-z0-9._%+-]+)?@[a-z0-9.-]+\.[a-z]{2,}$/.test( sender ) ? sender : '';
}

/**
 * The inbox TODD watches for RFP alerts. Connect one with Google or an app
 * password, choose which senders count as alerts, check it now, or stop
 * watching. An inbox Outreach already uses can be watched too; stopping
 * here never disconnects it from Outreach.
 */
@Component( {
  selector: 'app-rfp-inbox',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DkIconComponent, WriteActionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rfp-inbox.component.html',
  styleUrl: './rfp-inbox.component.css',
} )
export class RfpInboxComponent implements OnInit {
  private readonly service = inject( OpportunitiesService );
  private readonly notifications = inject( DocsNotificationService );

  readonly providers = PROVIDERS;
  readonly inboxes = signal<DocsInbox[] | null>( null );
  readonly busy = signal( '' );
  readonly showForm = signal( false );
  readonly testResult = signal<{ ok: boolean; message: string } | null>( null );
  readonly newSender: Record<string, string> = {};
  form = { emailAddress: '', provider: 'outlook' as ProviderId, secret: '', imapHost: '', smtpHost: '' };

  readonly watched = computed( () => ( this.inboxes() || [] ).filter( ( i ) => i.purposes.includes( 'rfp' ) ) );
  readonly others = computed( () => ( this.inboxes() || [] ).filter( ( i ) => !i.purposes.includes( 'rfp' ) ) );
  readonly checkedAgo = checkedAgo;

  ngOnInit (): void {
    this.refresh();
  }

  refresh (): void {
    this.service.listInboxes().subscribe( {
      next: ( list ) => this.inboxes.set( list ),
      error: () => this.inboxes.set( [] ),
    } );
  }

  connectGoogle (): void {
    this.busy.set( 'google' );
    this.service.startGoogle().subscribe( {
      next: ( { url } ) => { window.location.href = url; },
      error: ( error ) => {
        this.busy.set( '' );
        this.notifications.show( 'Google sign-in unavailable', error?.error?.message || 'Use an app password below instead.', 'warning' );
      },
    } );
  }

  private payload (): object {
    const preset = PROVIDERS.find( ( p ) => p.id === this.form.provider ) || PROVIDERS[0];
    const custom = this.form.provider === 'other_imap';
    return {
      emailAddress: this.form.emailAddress.trim(),
      provider: this.form.provider,
      secret: this.form.secret,
      imap: custom ? { ...preset.imap, host: this.form.imapHost.trim() } : preset.imap,
      smtp: custom ? { ...preset.smtp, host: this.form.smtpHost.trim() || this.form.imapHost.trim().replace( /^imap\./, 'smtp.' ) } : preset.smtp,
    };
  }

  test (): void {
    this.busy.set( 'test' );
    this.testResult.set( null );
    this.service.testInbox( this.payload() ).subscribe( {
      next: ( result ) => {
        this.busy.set( '' );
        this.testResult.set( { ok: !!result?.success, message: result?.success ? 'TODD can reach this inbox.' : ( result?.message || 'TODD couldn\'t sign in.' ) } );
      },
      error: ( error ) => {
        this.busy.set( '' );
        this.testResult.set( { ok: false, message: error?.error?.message || 'TODD couldn\'t sign in. Check the address and app password.' } );
      },
    } );
  }

  connect (): void {
    this.busy.set( 'connect' );
    this.service.connectInbox( this.payload() ).subscribe( {
      next: () => {
        this.busy.set( '' );
        this.showForm.set( false );
        this.form = { emailAddress: '', provider: 'outlook', secret: '', imapHost: '', smtpHost: '' };
        this.testResult.set( null );
        this.notifications.show( 'Inbox connected', 'TODD will check it for RFP alerts every 10 minutes.', 'success' );
        this.refresh();
      },
      error: ( error ) => {
        this.busy.set( '' );
        this.notifications.show( 'Couldn\'t connect it', error?.error?.message || 'Please check the details and try again.', 'warning' );
      },
    } );
  }

  watch ( inbox: DocsInbox, on: boolean ): void {
    if ( !on && !window.confirm( inbox.purposes.includes( 'outreach' ) ? `Stop watching ${ inbox.emailAddress } for RFPs? Outreach keeps using it.` : `Stop watching ${ inbox.emailAddress }? It will be disconnected.` ) ) return;
    this.busy.set( `watch:${ inbox.id }` );
    this.service.updateInbox( inbox.id, { watchForRfps: on } ).subscribe( {
      next: () => { this.busy.set( '' ); this.refresh(); },
      error: () => {
        this.busy.set( '' );
        this.notifications.show( 'Couldn\'t update it', 'Please try again.', 'warning' );
      },
    } );
  }

  addSender ( inbox: DocsInbox ): void {
    const sender = normalizeSender( this.newSender[inbox.id] || '' );
    if ( !sender ) {
      this.notifications.show( 'Not an address', 'Enter an email address, or a domain like bidnet.com.', 'warning' );
      return;
    }
    if ( inbox.rfpSenders.includes( sender ) ) return;
    this.saveSenders( inbox, [...inbox.rfpSenders, sender] );
    this.newSender[inbox.id] = '';
  }

  removeSender ( inbox: DocsInbox, sender: string ): void {
    if ( inbox.rfpSenders.length <= 1 ) {
      this.notifications.show( 'Keep at least one', 'TODD needs at least one sender to watch for.', 'warning' );
      return;
    }
    this.saveSenders( inbox, inbox.rfpSenders.filter( ( s ) => s !== sender ) );
  }

  private saveSenders ( inbox: DocsInbox, senders: string[] ): void {
    this.busy.set( `senders:${ inbox.id }` );
    this.service.updateInbox( inbox.id, { rfpSenders: senders } ).subscribe( {
      next: ( updated ) => {
        this.busy.set( '' );
        this.inboxes.update( ( list ) => ( list || [] ).map( ( i ) => i.id === inbox.id ? { ...i, rfpSenders: updated.rfpSenders || senders } : i ) );
      },
      error: ( error ) => {
        this.busy.set( '' );
        this.notifications.show( 'Couldn\'t save senders', error?.error?.message || 'Please try again.', 'warning' );
      },
    } );
  }

  checkNow ( inbox: DocsInbox ): void {
    this.busy.set( `check:${ inbox.id }` );
    this.service.checkInbox( inbox.id ).subscribe( {
      next: ( result ) => {
        this.busy.set( '' );
        const n = result?.newOpportunityCount || 0;
        this.notifications.show( n ? `${ n } new ${ n === 1 ? 'RFP' : 'RFPs' }` : 'Nothing new', n ? 'They\'re on Opportunities, scored against your profile.' : `TODD read ${ result?.checkedCount || 0 } new alert ${ ( result?.checkedCount || 0 ) === 1 ? 'email' : 'emails' }.`, 'success' );
        this.refresh();
      },
      error: ( error ) => {
        this.busy.set( '' );
        this.notifications.show( 'Couldn\'t check it', error?.error?.message || 'TODD couldn\'t reach this inbox. Reconnect it below.', 'warning' );
        this.refresh();
      },
    } );
  }
}
