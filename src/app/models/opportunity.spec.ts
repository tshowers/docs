import { dueLabel, fitTint, isOpen } from './opportunity';

describe( 'opportunity helpers', () => {
  const now = new Date( 2026, 9, 10, 9 );

  it( 'tints match scores like the design', () => {
    expect( fitTint( 92 ) ).toBe( 'green' );
    expect( fitTint( 86 ) ).toBe( 'green' );
    expect( fitTint( 80 ) ).toBe( 'blue' );
    expect( fitTint( 71 ) ).toBe( 'yellow' );
  } );

  it( 'labels due dates in days, treating a bare date as that whole day', () => {
    expect( dueLabel( { dueDate: '2026-10-24' }, now ) ).toBe( 'Due Oct 24 · 14 days' );
    expect( dueLabel( { dueDate: '2026-10-11' }, now ) ).toBe( 'Due Oct 11 · 1 day' );
    expect( dueLabel( { dueDate: '2026-10-10' }, now ) ).toBe( 'Due today' );
    expect( dueLabel( { dueDate: '2026-10-02' }, now ) ).toBe( 'Closed Oct 2' );
    expect( dueLabel( { dueDate: '' }, now ) ).toBe( '' );
    expect( isOpen( { dueDate: '2026-10-10' } as any, now ) ).toBeTrue();
    expect( isOpen( { dueDate: '2026-10-02' } as any, now ) ).toBeFalse();
  } );
} );
