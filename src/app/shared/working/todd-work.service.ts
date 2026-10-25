import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MonoTypeOperatorFunction, Observable, defer } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';

import { DocsNotificationService } from '../../services/docs-notification.service';

/** Shown in the header pill once a job has run this long. */
export const SHOW_AFTER_MS = 1200;

export interface WorkTask {
  id: number;
  /** What TODD is doing, as a sentence fragment: "Drafting Technical approach". */
  label: string;
  /** Steps done and total, for "3 of 7". */
  done?: number;
  total?: number;
  /** How long it usually takes, for "about a minute". */
  etaSeconds?: number;
  /** Where it was started; the pill goes back there. */
  route: string;
  startedAt: number;
}

export interface WorkOptions {
  etaSeconds?: number;
  done?: number;
  total?: number;
  /** Said when it finishes, if it took long enough for someone to look away. */
  confirm?: string;
}

export interface WorkHandle {
  update ( changes: Partial<Pick<WorkTask, 'label' | 'done' | 'total' | 'etaSeconds'>> ): void;
  finish ( confirm?: string ): void;
  /** Ended without success; whoever started it explains the error. */
  stop (): void;
}

/**
 * What TODD is working on right now, for the "TODD is working" pill in the
 * header. Slow jobs (reading an RFP, planning and drafting, the score
 * check) register here, from the service call or the component running
 * them, so people can see that something is happening, how far along it
 * is, and when it's done, even after leaving the page.
 */
@Injectable( { providedIn: 'root' } )
export class ToddWorkService {
  private readonly router = inject( Router );
  private readonly notifications = inject( DocsNotificationService );
  private nextId = 1;

  readonly tasks = signal<WorkTask[]>( [] );

  start ( label: string, options: WorkOptions = {} ): WorkHandle {
    const task: WorkTask = {
      id: this.nextId++,
      label,
      done: options.done,
      total: options.total,
      etaSeconds: options.etaSeconds,
      route: this.router.url,
      startedAt: Date.now(),
    };
    this.tasks.update( ( list ) => [...list, task] );
    let ended = false;
    const end = (): WorkTask | undefined => {
      if ( ended ) return undefined;
      ended = true;
      const current = this.tasks().find( ( t ) => t.id === task.id );
      this.tasks.update( ( list ) => list.filter( ( t ) => t.id !== task.id ) );
      return current;
    };
    return {
      update: ( changes ) => this.tasks.update( ( list ) => list.map( ( t ) => t.id === task.id ? { ...t, ...changes } : t ) ),
      finish: ( confirm = options.confirm ) => {
        const current = end();
        // Quick jobs only needed the button's spinner; a toast would be noise.
        if ( current && confirm && Date.now() - current.startedAt >= SHOW_AFTER_MS ) {
          this.notifications.show( confirm, this.router.url === current.route ? '' : 'Go back to it any time.', 'success' );
        }
      },
      stop: () => void end(),
    };
  }

  /**
   * Wraps a service call: registered while it runs, finished when it
   * succeeds (with an optional confirmation), stopped when it fails.
   *   this.http.post(...).pipe( this.work.track( 'Reading the RFP', { etaSeconds: 60 } ) )
   */
  track<T> ( label: string, options: WorkOptions & { confirmWith?: ( value: T ) => string } = {} ): MonoTypeOperatorFunction<T> {
    return ( source: Observable<T> ) => defer( () => {
      const handle = this.start( label, options );
      let last: T | undefined;
      let ok = false;
      return source.pipe(
        tap( { next: ( value ) => { last = value; ok = true; }, error: () => { ok = false; } } ),
        finalize( () => ok ? handle.finish( options.confirmWith && last !== undefined ? options.confirmWith( last ) : options.confirm ) : handle.stop() ),
      );
    } );
  }
}

/** "about a minute", "about 20 seconds", "almost done", "taking longer than usual". */
export function timeLeft ( task: Pick<WorkTask, 'etaSeconds' | 'startedAt'>, now = Date.now() ): string {
  if ( !task.etaSeconds ) return '';
  const elapsed = ( now - task.startedAt ) / 1000;
  const left = task.etaSeconds - elapsed;
  if ( elapsed > task.etaSeconds * 1.6 + 10 ) return 'taking longer than usual';
  if ( left <= 8 ) return 'almost done';
  if ( left < 45 ) return `about ${ Math.max( 10, Math.round( left / 10 ) * 10 ) } seconds`;
  if ( left < 90 ) return 'about a minute';
  return `about ${ Math.round( left / 60 ) } minutes`;
}

/** "TODD is drafting Technical approach · 3 of 7 · about a minute". */
export function describeTask ( task: WorkTask, now = Date.now() ): string {
  const what = task.label ? task.label.charAt( 0 ).toLowerCase() + task.label.slice( 1 ) : 'working';
  const parts = [`TODD is ${ what }`];
  if ( task.total && task.total > 1 ) parts.push( `${ Math.min( ( task.done || 0 ) + 1, task.total ) } of ${ task.total }` );
  const left = timeLeft( task, now );
  if ( left ) parts.push( left );
  return parts.join( ' · ' );
}
