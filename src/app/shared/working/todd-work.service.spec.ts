import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, throwError } from 'rxjs';

import { DocsNotificationService } from '../../services/docs-notification.service';
import { ToddWorkService, describeTask, timeLeft } from './todd-work.service';

describe( 'TODD is working', () => {
  const start = 1_000_000;

  it( 'says how long is left in plain words', () => {
    const task = { etaSeconds: 60, startedAt: start };
    expect( timeLeft( task, start ) ).toBe( 'about a minute' );
    expect( timeLeft( task, start + 30_000 ) ).toBe( 'about 30 seconds' );
    expect( timeLeft( task, start + 55_000 ) ).toBe( 'almost done' );
    expect( timeLeft( task, start + 120_000 ) ).toBe( 'taking longer than usual' );
    expect( timeLeft( { etaSeconds: 300, startedAt: start }, start ) ).toBe( 'about 5 minutes' );
    expect( timeLeft( { startedAt: start }, start ) ).toBe( '' );
  } );

  it( 'reads as a sentence, with progress', () => {
    expect( describeTask( { id: 1, label: 'Drafting Pricing', done: 2, total: 7, etaSeconds: 60, route: '/', startedAt: start }, start ) )
      .toBe( '16Ahead is drafting Pricing · 3 of 7 · about a minute' );
    expect( describeTask( { id: 1, label: 'Reading the RFP', route: '/', startedAt: start }, start ) ).toBe( '16Ahead is reading the RFP' );
  } );

  describe( 'tracking a call', () => {
    let work: ToddWorkService;
    let shown: jasmine.Spy;

    beforeEach( () => {
      jasmine.clock().install();
      jasmine.clock().mockDate( new Date( start ) );
      TestBed.configureTestingModule( { providers: [provideRouter( [] ), { provide: DocsNotificationService, useValue: { show: jasmine.createSpy( 'show' ) } }] } );
      work = TestBed.inject( ToddWorkService );
      shown = TestBed.inject( DocsNotificationService ).show as jasmine.Spy;
    } );

    afterEach( () => jasmine.clock().uninstall() );

    it( 'is listed while it runs and says when a slow job is done', () => {
      const reply = new Subject<string>();
      reply.pipe( work.track( 'Planning the proposal', { etaSeconds: 60, confirm: 'The proposal plan is ready' } ) ).subscribe();
      expect( work.tasks().map( ( t ) => t.label ) ).toEqual( ['Planning the proposal'] );
      jasmine.clock().tick( 5000 );
      reply.next( 'plan' );
      reply.complete();
      expect( work.tasks() ).toEqual( [] );
      expect( shown ).toHaveBeenCalledWith( 'The proposal plan is ready', '', 'success' );
    } );

    it( 'stays quiet about quick jobs and failures', () => {
      const quick = new Subject<string>();
      quick.pipe( work.track( 'Reading the key dates', { confirm: 'Done' } ) ).subscribe();
      quick.next( 'x' );
      quick.complete();
      throwError( () => new Error( 'nope' ) ).pipe( work.track( 'Sending the proposal', { confirm: 'Sent' } ) ).subscribe( { error: () => null } );
      expect( work.tasks() ).toEqual( [] );
      expect( shown ).not.toHaveBeenCalled();
    } );
  } );
} );
