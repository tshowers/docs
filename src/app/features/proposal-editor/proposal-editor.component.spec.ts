import { nextQuestion, sectionsToDraft } from './proposal-editor.component';

describe( 'proposal editor steps', () => {
  const draft = {
    sections: [
      { key: 'cover', title: 'Cover letter', blocks: [{ type: 'paragraph', text: 'x' }], status: 'done' },
      { key: 'tech', title: 'Technical approach', blocks: [{ type: 'paragraph', text: 'x' }], status: 'waiting', needsRedraft: true },
      { key: 'price', title: 'Pricing', blocks: [], status: 'pending' },
    ],
    questions: [
      { id: 'q2', sectionKey: 'price', status: 'open' },
      { id: 'q1', sectionKey: 'tech', status: 'open' },
      { id: 'q0', sectionKey: 'cover', status: 'answered' },
    ],
  } as any;

  it( 'drafts new sections and the ones waiting on a fresh answer', () => {
    expect( sectionsToDraft( draft ).map( ( s ) => s.key ) ).toEqual( ['tech', 'price'] );
    expect( sectionsToDraft( null ) ).toEqual( [] );
  } );

  it( 'asks the next open question in section order', () => {
    expect( nextQuestion( draft )?.id ).toBe( 'q1' );
    expect( nextQuestion( { ...draft, questions: [] } ) ).toBeNull();
  } );
} );
