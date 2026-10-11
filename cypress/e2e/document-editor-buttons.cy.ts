const presetActions = [
  [ 'fix-grammar', 'Fix spelling and grammar' ],
  [ 'professional-tone', 'Rewrite to a more professional tone' ],
  [ 'concise', 'Rewrite to a more concise version' ],
  [ 'expand', 'Expand with more detail and examples where helpful' ],
  [ 'bulletize', 'Convert to bullet points with clear sections' ],
  [ 'summarize', 'Summarize into an executive summary (5-7 bullets)' ],
] as const;

describe( 'Document editor buttons', () => {
  beforeEach( () => {
    cy.visit( '/docs/editor', {
      onBeforeLoad: ( win ) => win.localStorage.setItem( '__docsCypressAuth', 'true' )
    } );
    cy.get( '[data-demo="document-instructions"]' ).should( 'be.visible' );
  } );

  // Apply, Try again and Discard appear with TODD's revision (design 3b).
  it( 'renders all eleven primary workflow buttons', () => {
    cy.get( '[data-cy^="editor-action-"]' ).should( 'have.length', 11 );
  } );

  for ( const [ action, instruction ] of presetActions ) {
    it( `sets the instruction for ${action}`, () => {
      cy.get( `[data-cy="editor-action-${action}"]` ).click();
      cy.get( '[data-demo="document-instructions"]' ).should( 'have.value', instruction );
    } );
  }

  it( 'enables preview after an instruction and keeps preview-only actions gated', () => {
    cy.get( '[data-cy="editor-action-preview"]' ).should( 'be.disabled' );
    cy.get( '[data-cy="editor-action-discard-preview"]' ).should( 'not.exist' );
    cy.get( '[data-cy="editor-action-apply-preview"]' ).should( 'not.exist' );

    cy.get( '[data-demo="document-instructions"]' ).type( 'Make this clearer' );
    cy.get( '[data-cy="editor-action-preview"]' ).should( 'be.enabled' );
  } );

  it( 'keeps copy disabled until the editor has content', () => {
    cy.get( '[data-cy="editor-action-copy"]' ).should( 'be.disabled' );
  } );

  it( 'shows a blank page with the Word drop zone until there is text', () => {
    cy.get( '.de__status' ).should( 'contain.text', 'Not saved yet' );
    cy.get( '[data-demo="document-upload"]' ).should( 'be.visible' ).and( 'contain.text', 'Or drop a Word file here' );
    cy.get( '[data-cy="editor-canvas"]' ).click().type( 'Hello' );
    cy.get( '[data-demo="document-upload"]' ).should( 'not.exist' );
    cy.get( '[data-cy="editor-action-copy"]' ).should( 'be.enabled' );
  } );
} );
