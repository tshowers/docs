import { PDFDocument } from 'pdf-lib';

import { Requirement } from '../models/opportunity';
import { answeredInLabel, buildMatrixPdf, matrixRows } from './requirements-matrix';
import { filterRequirements, recentlyMatched } from '../features/proposal-editor/requirements-matrix.component';
import { openBySection } from '../features/proposal-editor/proposal-editor.component';

const req = ( id: string, changes: Partial<Requirement> = {} ): Requirement => ( {
  id, ref: '3.4.2', text: 'Must meet WCAG 2.1 AA', quote: '', page: 0, type: 'must', sectionKey: 'tech',
  status: 'not_answered', answeredIn: null, manual: false, matchedAt: '', suggestion: null, ...changes,
} );

describe( 'compliance matrix', () => {
  const answered = req( 'r1', { ref: '3.2.1.4', text: 'Shall support SSO', type: 'shall', status: 'answered', answeredIn: { sectionKey: 'tech', blockIndex: 3, label: '3.2 Security ¶2' }, matchedAt: '2026-10-22T10:00:00Z' } );
  const later = req( 'r2', { status: 'answered', answeredIn: { sectionKey: 'team', blockIndex: 0, label: '' }, matchedAt: '2026-10-22T11:00:00Z' } );
  const open = req( 'r3' );
  const elsewhere = req( 'r4', { sectionKey: '' } );
  const items = [answered, later, open, elsewhere];

  it( 'filters and lists the newest matches first', () => {
    expect( filterRequirements( items, 'not_answered' ).map( ( r ) => r.id ) ).toEqual( ['r3', 'r4'] );
    expect( filterRequirements( items, 'answered' ).map( ( r ) => r.id ) ).toEqual( ['r1', 'r2'] );
    expect( filterRequirements( items, 'all' ).length ).toBe( 4 );
    expect( recentlyMatched( items ).map( ( r ) => r.id ) ).toEqual( ['r2', 'r1'] );
  } );

  it( 'puts unanswered requirements in the section that should answer them', () => {
    const map = openBySection( { status: 'done', items, summary: { total: 4, answered: 2, notAnswered: 2 }, matrixRequired: false, extractedAt: '', matchedAt: '' } );
    expect( [...map.keys()] ).toEqual( ['tech'] );
    expect( map.get( 'tech' )!.map( ( r ) => r.id ) ).toEqual( ['r3'] );
    expect( openBySection( null ).size ).toBe( 0 );
  } );

  it( 'says where each is answered in the appendix', () => {
    expect( answeredInLabel( answered ) ).toBe( '3.2 Security ¶2' );
    expect( answeredInLabel( later, ( key ) => key === 'team' ? '2. Team' : '' ) ).toBe( '2. Team' );
    expect( answeredInLabel( { status: 'answered', answeredIn: null, manual: true } ) ).toBe( 'Answered' );
    expect( answeredInLabel( open ) ).toBe( 'Not answered' );
    expect( matrixRows( [answered, req( 'r5', { ref: '' } )] ) ).toEqual( [
      { ref: '3.2.1.4', requirement: 'Shall support SSO', type: 'shall', answeredIn: '3.2 Security ¶2' },
      { ref: '–', requirement: 'Must meet WCAG 2.1 AA', type: 'must', answeredIn: 'Not answered' },
    ] );
  } );

  it( 'builds a landscape PDF that runs onto more pages with the header repeated', async () => {
    const rows = Array.from( { length: 60 }, ( _, i ) => ( { ref: `3.${ i }`, requirement: `Shall do thing number ${ i } as the RFP describes it in some detail`, type: 'shall', answeredIn: '3.2 Security ¶2' } ) );
    const { bytes, pages } = await buildMatrixPdf( rows, { title: 'Compliance matrix · Permit Portal' } );
    expect( pages ).toBeGreaterThan( 1 );
    const doc = await PDFDocument.load( bytes );
    expect( doc.getPage( 0 ).getWidth() ).toBe( 792 );
    expect( doc.getTitle() ).toBe( 'Compliance matrix · Permit Portal' );
  } );
} );
