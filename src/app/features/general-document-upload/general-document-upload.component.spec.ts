import { looksLikeRfp, titleFromFileName } from './general-document-upload.component';

describe( 'upload helpers', () => {
  it( 'makes a readable title from a file name', () => {
    expect( titleFromFileName( 'final_FINAL_v3.docx' ) ).toBe( 'Final FINAL v3' );
    expect( titleFromFileName( 'COI_2026_renewal.pdf' ) ).toBe( 'COI 2026 renewal' );
    expect( titleFromFileName( '.pdf' ) ).toBe( 'Untitled file' );
  } );

  it( 'spots files named like solicitations', () => {
    expect( looksLikeRfp( 'KC-RFP-2026-118.pdf' ) ).toBeTrue();
    expect( looksLikeRfp( 'Bonfire_Solicitation_88213.pdf' ) ).toBeTrue();
    expect( looksLikeRfp( 'rates.xlsx' ) ).toBeFalse();
    expect( looksLikeRfp( 'Rfpm notes.docx' ) ).toBeFalse();
  } );
} );
