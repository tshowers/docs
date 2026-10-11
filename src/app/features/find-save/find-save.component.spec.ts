import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DocsAuthService } from '../../services/docs-auth.service';
import { FindSaveComponent } from './find-save.component';

describe( 'FindSaveComponent (Save to Knowledge from Find)', () => {
  const params = { q: 'bonhomie seattle', title: 'Bonhomie Coffee Bar', answer: 'Haitian coffee bar.', url: 'https://www.bonhomiecoffee.co/', keywords: 'coffee,seattle' };

  function setup ( signedIn: boolean, query: Record<string, string> = params ) {
    const auth = { isLoggedIn: () => of( signedIn ), signIn: jasmine.createSpy( 'signIn' ) };
    TestBed.configureTestingModule( {
      imports: [FindSaveComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter( [] ),
        { provide: DocsAuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap( query ) } } },
      ],
    } );
    const fixture = TestBed.createComponent( FindSaveComponent );
    const router = TestBed.inject( Router );
    spyOn( router, 'navigate' ).and.returnValue( Promise.resolve( true ) );
    return { fixture, component: fixture.componentInstance, http: TestBed.inject( HttpTestingController ), router, auth };
  }

  it( 'saves straight away when signed in, then opens the answer', fakeAsync( () => {
    const { fixture, http, router } = setup( true );
    fixture.detectChanges();
    tick();

    const req = http.expectOne( ( r ) => r.url.endsWith( '/response-flows/from-find' ) );
    expect( req.request.body ).toEqual( { query: 'bonhomie seattle', title: 'Bonhomie Coffee Bar', answer: 'Haitian coffee bar.', url: 'https://www.bonhomiecoffee.co/', keywords: ['coffee', 'seattle'] } );
    req.flush( { success: true, item: { id: 'kb1' } } );
    tick();
    expect( router.navigate ).toHaveBeenCalledWith( ['/knowledge', 'kb1'], { replaceUrl: true } );
    http.verify();
  } ) );

  it( 'asks to sign in first, and comes back to this page', fakeAsync( () => {
    const { fixture, component, http, auth } = setup( false );
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect( component.state() ).toBe( 'signIn' );
    http.expectNone( ( r ) => r.url.endsWith( '/response-flows/from-find' ) );
    ( fixture.nativeElement.querySelector( 'button' ) as HTMLButtonElement ).click();
    expect( auth.signIn ).toHaveBeenCalled();
  } ) );

  it( 'offers Docs when the free Find limit is reached', fakeAsync( () => {
    const { fixture, component, http } = setup( true );
    fixture.detectChanges();
    tick();
    http.expectOne( ( r ) => r.url.endsWith( '/response-flows/from-find' ) )
      .flush( { success: false, code: 'FIND_SAVE_LIMIT', message: 'You\'ve saved 100 answers from Find. Get Docs to save more.' }, { status: 403, statusText: 'Forbidden' } );
    tick();
    fixture.detectChanges();

    expect( component.state() ).toBe( 'limit' );
    expect( fixture.nativeElement.textContent ).toContain( 'Get Docs to save more' );
  } ) );

  it( 'says so when there is nothing to save', fakeAsync( () => {
    const { fixture, component } = setup( true, {} );
    fixture.detectChanges();
    tick();
    expect( component.state() ).toBe( 'error' );
  } ) );
} );
