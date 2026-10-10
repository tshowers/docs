import { highlightParts } from './document-list.component';

describe( 'highlightParts', () => {
  it( 'marks every case-insensitive match and keeps the original casing', () => {
    expect( highlightParts( 'King County RFP for king county', 'KING county' ) ).toEqual( [
      { text: 'King County', hit: true },
      { text: ' RFP for ', hit: false },
      { text: 'king county', hit: true },
    ] );
  } );

  it( 'returns the text untouched without a search term', () => {
    expect( highlightParts( 'Permit Portal', '  ' ) ).toEqual( [{ text: 'Permit Portal', hit: false }] );
  } );
} );
