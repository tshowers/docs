import { HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { WriteAccessService } from '../../services/write-access.service';
import { WRITE_ACCESS_APP } from '../write-access/write-access.config';

/** A request this soon after a click is that click's work. */
const CLICK_WINDOW_MS = 600;
/** A follow-up request this soon after the last one keeps the same button busy. */
const CHAIN_WINDOW_MS = 400;
const CLEAR_DELAY_MS = 150;
const CONTROL = 'button, a.dk-btn, [role="button"]';

/**
 * "Did that click do anything?" Every button that starts work shows a
 * spinner the moment it's pressed, until the work it started is done:
 * a click is matched to the backend requests that follow it (see
 * pendingClickInterceptor), so no page has to wire this up button by
 * button. A click the write gate is holding while the account check
 * loads (shared/write-access) shows the spinner too, instead of nothing.
 */
@Injectable( { providedIn: 'root' } )
export class PendingClickService {
  private readonly writeAccess = inject( WriteAccessService );
  private last: { el: HTMLElement; at: number } | null = null;
  private readonly counts = new WeakMap<HTMLElement, number>();
  private readonly lastRequest = new WeakMap<HTMLElement, number>();
  private readonly clearTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
  private accessKnown = false;
  private readonly held = new Set<HTMLElement>();
  private started = false;

  /** Called once by the app shell, in the browser. */
  start (): void {
    if ( this.started || typeof document === 'undefined' ) return;
    this.started = true;
    // Capture on the document runs before the write gate's own capture listener on the button.
    document.addEventListener( 'click', ( event ) => this.onClick( event ), true );
    this.writeAccess.state( WRITE_ACCESS_APP.product ).subscribe( () => {
      this.accessKnown = true;
      for ( const el of this.held ) this.release( el );
      this.held.clear();
    } );
  }

  private onClick ( event: Event ): void {
    const el = ( event.target as Element | null )?.closest?.( CONTROL ) as HTMLElement | null;
    if ( !el || el.hasAttribute( 'data-no-pending' ) || ( el as HTMLButtonElement ).disabled ) return;
    this.last = { el, at: Date.now() };
    // The write gate holds this click until it knows who's signed in: show that it's on its way.
    if ( !this.accessKnown && el.hasAttribute( 'appwriteaction' ) && !this.held.has( el ) ) {
      this.held.add( el );
      this.hold( el );
    }
  }

  /** The control a request starting now belongs to, if any. */
  ownerOfNewRequest (): HTMLElement | null {
    const now = Date.now();
    if ( this.last && now - this.last.at <= CLICK_WINDOW_MS && this.last.el.isConnected ) return this.last.el;
    // A chain: a click's second request starting right after its first finished.
    if ( this.last && this.last.el.isConnected && now - ( this.lastRequest.get( this.last.el ) || 0 ) <= CHAIN_WINDOW_MS ) return this.last.el;
    return null;
  }

  hold ( el: HTMLElement ): void {
    const timer = this.clearTimers.get( el );
    if ( timer ) clearTimeout( timer );
    this.counts.set( el, ( this.counts.get( el ) || 0 ) + 1 );
    el.classList.add( 'dk-pending' );
    el.setAttribute( 'aria-busy', 'true' );
  }

  release ( el: HTMLElement ): void {
    const left = Math.max( 0, ( this.counts.get( el ) || 0 ) - 1 );
    this.counts.set( el, left );
    this.lastRequest.set( el, Date.now() );
    if ( left ) return;
    // A short grace period, so a request that follows straight on doesn't flicker the spinner.
    this.clearTimers.set( el, setTimeout( () => {
      if ( this.counts.get( el ) ) return;
      el.classList.remove( 'dk-pending' );
      el.removeAttribute( 'aria-busy' );
    }, CLEAR_DELAY_MS ) );
  }
}

/** Ties backend requests to the click that started them (PendingClickService). */
export const pendingClickInterceptor: HttpInterceptorFn = ( req, next ) => {
  if ( typeof document === 'undefined' || !req.url.includes( '/api/' ) ) return next( req );
  const clicks = inject( PendingClickService );
  const owner = clicks.ownerOfNewRequest();
  if ( !owner ) return next( req );
  clicks.hold( owner );
  return next( req ).pipe( finalize( () => clicks.release( owner ) ) );
};
