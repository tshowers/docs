/**
 * Docs' pre-sign-in wizard at /get-started: write a first Q&A answer, then
 * name and company, then hand off to TODD's hosted login. The draft is kept
 * in localStorage so it survives that redirect (it's saved after sign-in by
 * DocsSignupDraftService.submitIfPending in AuthCallbackComponent).
 */
describe( 'Docs get started wizard', () => {
  const storageKey = 'docs_signup_draft';

  beforeEach( () => cy.clearLocalStorage() );

  it( 'writes an answer, asks name and company, and saves the draft', () => {
    cy.visit( '/get-started' );
    cy.get( '[data-cy="get-started-progress"] li' ).should( 'have.length', 4 );
    cy.get( '[data-cy="get-started-progress"] li' ).eq( 0 ).should( 'have.class', 'is-done' );

    // A question is preselected, so Next works straight away.
    cy.contains( '[data-cy="get-started-starter"]', 'What do you charge?' ).should( 'have.attr', 'aria-checked', 'true' );
    cy.contains( '[data-cy="get-started-starter"]', 'How long does it take?' ).click();
    cy.get( '[data-cy="get-started-next"]' ).click();

    cy.contains( '[data-cy="get-started-question"]', 'How do you answer it?' );
    cy.get( '[data-cy="get-started-answer"]' ).should( 'contain.value', 'Most projects take a few weeks' )
      .clear().type( 'Usually two weeks.' );
    cy.get( '[data-cy="get-started-next"]' ).click();

    cy.contains( '[data-cy="get-started-question"]', "Here's your first answer" );
    cy.get( '[data-cy="get-started-preview"]' ).should( 'contain.text', 'How long does it take?' )
      .and( 'contain.text', 'Usually two weeks.' ).and( 'contain.text', '#process' );
    cy.get( '[data-cy="get-started-next"]' ).should( 'contain.text', 'Continue to sign up' ).click();

    cy.get( '[data-cy="get-started-progress"] li' ).eq( 1 ).should( 'have.class', 'is-done' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Ada{enter}' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Lovelace{enter}' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Analytical Co{enter}' );

    cy.contains( '[data-cy="get-started-question"]', 'create your account' );
    cy.window().then( ( win ) => {
      const draft = JSON.parse( win.localStorage.getItem( storageKey ) || '{}' );
      expect( draft ).to.include( {
        starterKey: 'timing', question: 'How long does it take?', answer: 'Usually two weeks.',
        firstName: 'Ada', lastName: 'Lovelace', companyName: 'Analytical Co', readyToSubmit: true,
      } );
    } );

    cy.get( '[data-cy="get-started-sign-in"]' ).click();
    cy.location( 'href', { timeout: 10000 } ).should( 'include', 'todd.taliferro.tech/login' );
  } );

  it( '"Other" asks for the question and needs an answer', () => {
    cy.visit( '/get-started' );
    cy.contains( '[data-cy="get-started-starter"]', 'Other' ).click();
    cy.get( '[data-cy="get-started-next"]' ).should( 'be.disabled' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Do you work weekends?' );
    cy.get( '[data-cy="get-started-next"]' ).click();
    cy.get( '[data-cy="get-started-answer"]' ).should( 'have.value', '' );
    cy.get( '[data-cy="get-started-next"]' ).should( 'be.disabled' );
    cy.get( '[data-cy="get-started-answer"]' ).type( 'Only for launches.' );
    cy.get( '[data-cy="get-started-next"]' ).should( 'not.be.disabled' );
  } );

  it( 'links returning users straight to sign-in', () => {
    cy.visit( '/get-started' );
    cy.get( '[data-cy="get-started-existing"]' ).should( 'have.attr', 'href' ).and( 'include', '/login' );
  } );
} );
