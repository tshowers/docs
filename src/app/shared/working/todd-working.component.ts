import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { SHOW_AFTER_MS, ToddWorkService, describeTask } from './todd-work.service';

/**
 * "TODD is drafting Technical approach · 3 of 7 · about a minute": in the
 * bottom-left corner while TODD works on something slow, on any page
 * (toasts are top right, the assistant bottom right, and the header has no
 * room for it). Click it to go back to where it was started. On a phone it
 * floats above the tab bar.
 * Quick jobs never show it; their button's spinner is enough.
 */
@Component( {
  selector: 'app-todd-working',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (shown(); as task) {
      <button type="button" class="tw" (click)="goBack()" [attr.title]="text()" [attr.aria-label]="text() + (onItsPage() ? '' : '. Go back to it.')">
        <img class="tw__av" src="assets/avatar-todd-sm.png" alt="" />
        <span class="tw__spin" aria-hidden="true"></span>
        <span class="tw__text">{{ text() }}</span>
        @if (others()) { <span class="tw__more">+{{ others() }}</span> }
      </button>
    }
    <span class="tw__live" aria-live="polite">{{ announce() }}</span>
  `,
  styles: [`
    :host { display: contents; }
    .tw {
      position: fixed; left: 24px; bottom: 24px; z-index: 30;
      display: inline-flex; align-items: center; gap: 8px;
      max-width: min(480px, calc(100vw - 120px)); height: 48px; min-height: 0; padding: 0 16px 0 6px;
      border: 0; border-radius: 999px; background: var(--t-blue); color: var(--t-blue-fg);
      font: 700 14px/1 var(--font); cursor: pointer; box-shadow: 0 10px 30px rgba(15, 17, 21, .16);
      animation: tw-in .2s ease-out;
    }
    .tw:hover { filter: brightness(.97); }
    .tw:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
    .tw__av { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex: none; }
    .tw__spin { width: 14px; height: 14px; flex: none; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: tw-spin .8s linear infinite; }
    .tw__text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tw__more { flex: none; padding: 3px 7px; border-radius: 999px; background: var(--bg); font-size: 11px; }
    .tw__live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    @keyframes tw-spin { to { transform: rotate(360deg); } }
    @keyframes tw-in { from { opacity: 0; transform: translateY(6px); } }
    @media (prefers-reduced-motion: reduce) { .tw, .tw__spin { animation-duration: 2.4s; } .tw { animation: none; } }
    /* Phone: the header has no room; float above the tab bar. */
    @media (max-width: 760px) {
      .tw { left: 16px; right: 16px; bottom: calc(76px + env(safe-area-inset-bottom)); max-width: none; }
    }
  `],
} )
export class ToddWorkingComponent {
  private readonly work = inject( ToddWorkService );
  private readonly router = inject( Router );
  /** Ticks while something runs, so the elapsed time and "about a minute" stay current. */
  private readonly now = signal( Date.now() );
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Oldest job first: the one people have waited on longest. */
  private readonly visible = computed( () => this.work.tasks().filter( ( t ) => this.now() - t.startedAt >= SHOW_AFTER_MS ) );
  readonly shown = computed( () => this.visible()[0] || null );
  readonly others = computed( () => Math.max( 0, this.visible().length - 1 ) );
  readonly text = computed( () => {
    const task = this.shown();
    return task ? describeTask( task, this.now() ) : '';
  } );
  readonly onItsPage = computed( () => this.shown()?.route === this.router.url );
  /** Screen readers hear when a job starts showing and when everything is done. */
  readonly announce = signal( '' );

  constructor () {
    effect( () => {
      const running = this.work.tasks().length > 0;
      if ( running && !this.timer && typeof window !== 'undefined' ) {
        this.timer = setInterval( () => this.now.set( Date.now() ), 500 );
      } else if ( !running && this.timer ) {
        clearInterval( this.timer );
        this.timer = null;
        this.now.set( Date.now() );
      }
    } );
    let lastShownId = 0;
    effect( () => {
      const task = this.shown();
      if ( task && task.id !== lastShownId ) {
        lastShownId = task.id;
        this.announce.set( describeTask( task, Date.now() ) );
      } else if ( !task && lastShownId ) {
        lastShownId = 0;
        this.announce.set( '16Ahead is done.' );
      }
    }, { allowSignalWrites: true } );
    inject( DestroyRef ).onDestroy( () => this.timer && clearInterval( this.timer ) );
  }

  goBack (): void {
    const task = this.shown();
    if ( task && !this.onItsPage() ) void this.router.navigateByUrl( task.route );
  }
}
