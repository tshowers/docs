import { answerStatus, fromRecord, linkLabel, normalizeUrl, toPayload } from './answer-form.helpers';

describe( 'answer form helpers', () => {
  const form = {
    question: ' How long do you keep public records data? ',
    category: 'Quality and compliance',
    answers: [{ answer: 'We follow the schedule.', source: 'https://sos.wa.gov/archives/records-retention', document: null }, { answer: '  ', source: '', document: null }],
    recommendations: [{ type: 'Policy' as const, text: 'Publish a retention policy', link: '', document: { name: 'Policy.pdf', src: 'https://x/p.pdf' } }, { type: 'Practice' as const, text: '', link: '' }],
    resources: [{ link: 'https://sos.wa.gov/archives' }, { link: '' }],
    keywords: ['Records Retention', 'records retention', 'backups'],
  };

  it( 'derives Ready / Draft from a question and an answer', () => {
    expect( answerStatus( form ).ready ).toBeTrue();
    expect( answerStatus( { ...form, question: '' } ) ).toEqual( { hasQuestion: false, hasAnswer: true, ready: false } );
    expect( answerStatus( { ...form, answers: [{ answer: ' ', source: '' }] } ).ready ).toBeFalse();
  } );

  it( 'sends clean rows with the derived status', () => {
    const payload = toPayload( form, { mayaReference: false } ) as any;
    expect( payload.question ).toBe( 'How long do you keep public records data?' );
    expect( payload.answers.length ).toBe( 1 );
    expect( payload.recommendations ).toEqual( [{ type: 'Policy', text: 'Publish a retention policy', link: '', document: { name: 'Policy.pdf', src: 'https://x/p.pdf' } }] );
    expect( payload.resources ).toEqual( [{ link: 'https://sos.wa.gov/archives' }] );
    expect( payload.keywords ).toEqual( ['records retention', 'backups'] );
    expect( payload.status ).toBe( 'complete' );
    expect( ( toPayload( { ...form, question: '' }, { mayaReference: true } ) as any ).status ).toBe( 'draft' );
  } );

  it( 'opens old wizard entries, including single-answer ones', () => {
    expect( fromRecord( { question: 'Q', response: 'Old answer' } ).answers ).toEqual( [{ answer: 'Old answer', source: '', document: null }] );
    expect( fromRecord( {} ).answers.length ).toBe( 1 );
    expect( fromRecord( { recommendations: [{ type: 'weird', text: 'x' }] } ).recommendations[0].type ).toBe( 'Practice' );
    expect( linkLabel( 'https://www.sos.wa.gov/archives/' ) ).toBe( 'sos.wa.gov/archives' );
    expect( normalizeUrl( 'sos.wa.gov' ) ).toBe( 'https://sos.wa.gov' );
  } );
} );
