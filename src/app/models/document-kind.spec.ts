import { documentExtension, documentKind, documentMatches, documentSurface, opensInEditor, shortDocumentDate } from './document-kind';

describe( 'document kind helpers', () => {
  it( 'reads the kind from the type, then from the words in the title', () => {
    expect( documentKind( { type: 'rfp', src: 'a.pdf', name: 'a.pdf' } ) ).toBe( 'rfp' );
    expect( documentKind( { type: 'proposal', src: 'a.docx', name: 'a.docx' } ) ).toBe( 'proposal' );
    expect( documentKind( { type: 'image', src: 'x.png', name: 'x.png' } ) ).toBe( 'media' );
    expect( documentKind( { type: 'document', src: '', name: 'King County master services agreement.pdf' } ) ).toBe( 'contract' );
    expect( documentKind( { type: 'document', src: '', name: 'p.xlsx', title: 'Permit portal pricing worksheet' } ) ).toBe( 'pricing' );
    expect( documentKind( { type: 'document', src: '', name: 'c.pdf', title: 'Certificate of insurance 2026' } ) ).toBe( 'compliance' );
    expect( documentKind( { type: 'draft', src: '', name: 'Notes' } ) ).toBe( 'draft' );
    expect( documentKind( { type: 'document', src: '', name: 'Team photo list' } ) ).toBe( 'document' );
  } );

  it( 'picks the preview surface and extension', () => {
    expect( documentSurface( { type: 'document', src: 'https://x/y.PDF?alt=media', name: '' } ) ).toBe( 'pdf' );
    expect( documentSurface( { type: 'document', src: 'https://youtu.be/abc', name: '' } ) ).toBe( 'video' );
    expect( documentSurface( { type: 'document', src: '', name: 'sheet.xlsx' } ) ).toBe( 'file' );
    expect( documentExtension( { type: 'document', src: '', name: 'sheet.xlsx' } ) ).toBe( 'XLSX' );
    expect( documentExtension( { type: 'draft', src: '', name: 'Untitled' } ) ).toBe( 'DOC' );
  } );

  it( 'opens drafts and proposals in the editor, files in a new tab', () => {
    expect( opensInEditor( { id: '1', type: 'draft', src: '', name: '' } ) ).toBeTrue();
    expect( opensInEditor( { id: '1', type: 'document', src: 'a.pdf', name: 'a.pdf' } ) ).toBeFalse();
    expect( opensInEditor( { id: '1', type: 'rfp', src: '', name: '' } ) ).toBeFalse();
  } );

  it( 'searches title, topic, summary and kind', () => {
    const doc = { type: 'rfp' as const, src: '', name: 'r.pdf', title: 'Permit Portal', summary: 'King County' };
    expect( documentMatches( doc, 'king county' ) ).toBeTrue();
    expect( documentMatches( doc, 'RFP' ) ).toBeTrue();
    expect( documentMatches( doc, 'tacoma' ) ).toBeFalse();
  } );

  it( 'shortens dates like the design', () => {
    const now = new Date( 2026, 9, 9, 12 );
    expect( shortDocumentDate( { type: 'document', src: '', name: '', updatedAt: new Date( 2026, 9, 9, 8 ).toISOString() }, now ) ).toBe( 'Today' );
    expect( shortDocumentDate( { type: 'document', src: '', name: '', updatedAt: new Date( 2026, 2, 3 ).toISOString() }, now ) ).toBe( 'Mar 3' );
    expect( shortDocumentDate( { type: 'document', src: '', name: '', updatedAt: new Date( 2024, 5, 1 ).toISOString() }, now ) ).toBe( 'Jun 2024' );
  } );
} );
