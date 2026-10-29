// Help: the walkthrough videos. The files live in public/video, which is
// kept out of git, so this checks what the page asks for, not the files.
export {};

describe( 'Help videos', () => {
  beforeEach( () => cy.visit( '/help' ) );

  it( 'lists the ready videos and plays one in the player', () => {
    cy.get( '[data-cy="help-videos"] .help__video' ).should( 'have.length', 8 );
    cy.get( '[data-cy="help-videos"] .help__video' ).first().should( 'contain.text', 'Docs in a minute' ).and( 'contain.text', '0:45' );
    cy.get( '[data-cy="help-videos"] .help__video' ).eq( 3 ).should( 'contain.text', 'Draft the proposal with 16Ahead' ).and( 'contain.text', '1:20' );

    cy.contains( '[data-cy="help-videos"] .help__video', 'Get approval before sending' ).click();
    cy.get( '.help__player video' ).should( 'have.attr', 'src', '/video/help-video-6.mp4' ).and( 'have.attr', 'controls' );
    cy.get( '.help__player' ).should( 'contain.text', 'Get approval before sending' );
    cy.get( 'body' ).type( '{esc}' );
    cy.get( '.help__player' ).should( 'not.exist' );
  } );

  it( 'puts a Watch link on each step that has a video', () => {
    cy.get( '#step-06' ).should( 'contain.text', 'Get approval before sending' ).contains( 'button', 'Watch (1:30)' ).click();
    cy.get( '.help__player video' ).should( 'have.attr', 'src', '/video/help-video-6.mp4' );
    cy.get( '.help__player' ).contains( 'button', '×' ).click();
    cy.get( '#step-04' ).contains( 'button', 'Watch (1:20)' );
    cy.get( '#step-09' ).find( '.help__watch' ).should( 'not.exist' );
  } );
} );
