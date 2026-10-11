import { freshnessLabel, knowledgeMatches, knowledgeTag, normalizeKnowledge, primaryAnswer, shortLink } from './knowledge';

describe( 'knowledge helpers', () => {
  const now = new Date( 2026, 9, 9, 12 );
  const iso = ( y: number, m: number, d: number ) => new Date( y, m, d, 9 ).toISOString();

  it( 'tags new, stale, draft and Find answers', () => {
    expect( knowledgeTag( { createdAt: iso( 2026, 9, 8 ) }, now ) ).toEqual( { label: 'New', tint: 'blue' } );
    expect( knowledgeTag( { createdAt: iso( 2025, 6, 1 ), updatedAt: iso( 2025, 7, 1 ) }, now ) ).toEqual( { label: 'Still true?', tint: 'yellow' } );
    expect( knowledgeTag( { status: 'draft', createdAt: iso( 2026, 9, 8 ) }, now ) ).toEqual( { label: 'Draft', tint: 'yellow' } );
    expect( knowledgeTag( { type: 'bookmark', createdAt: iso( 2026, 1, 1 ) }, now ) ).toEqual( { label: 'via Find', tint: 'cyan' } );
    expect( knowledgeTag( { createdAt: iso( 2026, 1, 1 ) }, now ) ).toBeNull();
  } );

  it( 'describes freshness like the design', () => {
    expect( freshnessLabel( { createdAt: iso( 2026, 9, 9 ) }, now ) ).toBe( 'Added today' );
    expect( freshnessLabel( { createdAt: iso( 2026, 1, 1 ), updatedAt: iso( 2026, 7, 14 ) }, now ) ).toBe( 'Confirmed Aug 2026' );
    expect( freshnessLabel( { createdAt: iso( 2025, 7, 1 ) }, now ) ).toBe( '14 months old' );
  } );

  it( 'falls back to legacy answer fields and searches everything', () => {
    expect( primaryAnswer( { answers: [], response: 'WCAG 2.1 AA' } ) ).toBe( 'WCAG 2.1 AA' );
    const item = normalizeKnowledge( { id: 1, question: 'Which standard?', answers: [{ answer: 'We build to WCAG' }], keywords: ['Section 508'] } );
    expect( knowledgeMatches( item, 'wcag' ) ).toBeTrue();
    expect( knowledgeMatches( item, '508' ) ).toBeTrue();
    expect( knowledgeMatches( item, 'pricing' ) ).toBeFalse();
    expect( shortLink( 'https://www.w3.org/TR/WCAG21/' ) ).toBe( 'w3.org/TR/WCAG21' );
  } );
} );
