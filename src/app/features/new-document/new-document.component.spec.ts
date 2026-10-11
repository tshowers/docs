import { normalizeKnowledge } from '../../models/knowledge';
import { pickSources } from './new-document.component';

describe( 'pickSources', () => {
  const knowledge = [
    normalizeKnowledge( { id: 'a', question: 'Which accessibility standard do you build to?', answers: [{ answer: 'WCAG 2.1 AA' }] } ),
    normalizeKnowledge( { id: 'b', question: 'Describe your data platform work', answers: [{ answer: 'Analytics pipelines for ports and transit' }] } ),
    normalizeKnowledge( { id: 'c', question: 'Insurance coverage', answers: [{ answer: '$1M general liability' }] } ),
  ];
  const opportunities = [{ id: 'o3', agency: 'Port of Seattle', title: 'Data Analytics Platform Support', status: 'new' }] as any;

  it( 'picks Knowledge that shares words with the brief, and the opportunity it names', () => {
    const result = pickSources( 'Capability statement on our data analytics work for the Port of Seattle', knowledge, opportunities );
    expect( result.knowledge.map( ( k ) => k.id ) ).toEqual( ['b'] );
    expect( result.opportunity?.id ).toBe( 'o3' );
  } );

  it( 'falls back to recent Knowledge when nothing matches', () => {
    const result = pickSources( 'Holiday note', knowledge, opportunities );
    expect( result.knowledge.length ).toBe( 3 );
    expect( result.opportunity ).toBeNull();
  } );
} );
