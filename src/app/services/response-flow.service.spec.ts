import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ResponseFlowService } from './response-flow.service';
import { environment } from '../../environments/environment';

describe( 'ResponseFlowService', () => {
  let service: ResponseFlowService;
  let http: HttpTestingController;
  const base = `${environment.backendURL}/response-flows`;

  beforeEach( () => {
    TestBed.configureTestingModule( { providers: [ResponseFlowService, provideHttpClient(), provideHttpClientTesting()] } );
    service = TestBed.inject( ResponseFlowService );
    http = TestBed.inject( HttpTestingController );
  } );

  afterEach( () => http.verify() );

  it( 'maps all response-flow CRUD operations to the API', () => {
    const flow = { question: 'Q' };
    service.createResponseFlow( flow ).subscribe();
    expect( http.expectOne( { method: 'POST', url: base } ).request.body ).toEqual( flow );
    service.getResponseFlows().subscribe();
    http.expectOne( { method: 'GET', url: base } ).flush( { success: true, items: [] } );
    service.getResponseFlow( '1' ).subscribe();
    http.expectOne( { method: 'GET', url: `${base}/1` } ).flush( { success: true, item: flow } );
    service.updateResponseFlow( '1', flow ).subscribe();
    expect( http.expectOne( { method: 'PUT', url: `${base}/1` } ).request.body ).toEqual( flow );
    service.removeResponseFlow( '1' ).subscribe();
    http.expectOne( { method: 'DELETE', url: `${base}/1` } ).flush( {} );
  } );

  it( 'unwraps the { success, items } / { success, item } response envelope', () => {
    const items = [{ id: '1', question: 'Q' }];
    let result: any;
    service.getResponseFlows().subscribe( ( r ) => ( result = r ) );
    http.expectOne( { method: 'GET', url: base } ).flush( { success: true, items } );
    expect( result ).toEqual( items );

    let single: any;
    service.getResponseFlow( '1' ).subscribe( ( r ) => ( single = r ) );
    http.expectOne( { method: 'GET', url: `${base}/1` } ).flush( { success: true, item: items[0] } );
    expect( single ).toEqual( items[0] );
  } );
} );
