// Deleting many documents at once (Ty, 2026-10-30): Select turns the cards
// into checkboxes, "Select all shown" follows the search, and Delete removes
// the checked ones. One that fails stays checked so trying again retries it.

export {};

const asOwner = ( w: Window ) => w.localStorage.setItem( '__docsCypressAuth', 'true' );
const doc = ( id: string, title: string ) => ( { id, title, name: title, mimeType: 'text/html', summary: '', createdAt: '2026-10-23T12:00:00Z' } );
const DOCS = [doc( 'd1', 'TODD Market Announcement' ), doc( 'd2', 'Retail Email - TODD Market' ), doc( 'd3', 'Agencies plan' )];

describe( 'Deleting documents in bulk', () => {
  beforeEach( () => {
    cy.intercept( 'GET', /\/api\/docs\/opportunities$/, { success: true, data: [] } );
    cy.intercept( 'GET', /\/api\/docs$/, { documents: DOCS } );
    cy.viewport( 1400, 900 );
  } );

  it( 'selects what the search shows and deletes it', () => {
    cy.intercept( 'DELETE', /\/api\/docs\/d[12]$/, { success: true } ).as( 'delete' );
    cy.visit( '/documents', { onBeforeLoad: asOwner } );
    cy.get( '[data-cy="docs-search"]' ).type( 'TODD' );
    cy.get( '[data-cy="docs-select"]' ).click();
    cy.get( '[data-cy="docs-select-all"]' ).should( 'contain', 'Select all 2 shown' ).click();
    cy.get( '[data-cy="docs-selectbar"]' ).should( 'contain', '2 selected' );
    cy.on( 'window:confirm', ( text ) => {
      expect( text ).to.contain( 'these 2 documents' );
      return true;
    } );
    cy.get( '[data-cy="docs-delete-selected"]' ).should( 'contain', 'Delete 2' ).click();
    cy.wait( ['@delete', '@delete'] );
    cy.get( '[data-cy="docs-selectbar"]' ).should( 'not.exist' );
    cy.get( '[data-cy="docs-search"]' ).clear();
    cy.get( '[data-cy^="docs-card-"]' ).should( 'have.length', 1 ).and( 'contain', 'Agencies plan' );
  } );

  it( 'a card toggles instead of opening, and a failed delete stays checked', () => {
    cy.intercept( 'DELETE', /\/api\/docs\/d1$/, { success: true } );
    cy.intercept( 'DELETE', /\/api\/docs\/d2$/, { statusCode: 500, body: {} } );
    cy.visit( '/documents', { onBeforeLoad: asOwner } );
    cy.get( '[data-cy="docs-select"]' ).click();
    cy.get( '[data-cy="docs-card-d1"]' ).click();
    cy.get( '[data-cy="docs-card-d2"]' ).click().should( 'have.attr', 'aria-checked', 'true' );
    cy.location( 'pathname' ).should( 'eq', '/documents' );
    cy.on( 'window:confirm', () => true );
    cy.get( '[data-cy="docs-delete-selected"]' ).click();
    cy.get( '[data-cy="docs-card-d1"]' ).should( 'not.exist' );
    cy.get( '[data-cy="docs-card-d2"]' ).should( 'have.attr', 'aria-checked', 'true' );
    cy.get( '[data-cy="docs-selectbar"]' ).should( 'contain', '1 selected' );
  } );
} );
