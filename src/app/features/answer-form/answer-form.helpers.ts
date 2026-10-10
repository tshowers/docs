/** The Add/Edit answer page's data, as the response-flows API stores it. */
export interface AnswerDoc { name: string; src: string; type?: string }
export interface AnswerRow { answer: string; source: string; document?: AnswerDoc | null }
export interface RecommendationRow { type: 'Practice' | 'Policy' | 'Resource'; text: string; link: string; document?: AnswerDoc | null }

export interface AnswerForm {
  question: string;
  category: string;
  answers: AnswerRow[];
  recommendations: RecommendationRow[];
  resources: { link: string }[];
  keywords: string[];
}

/** Ready when it has a question and at least one answer with text; otherwise it saves as a draft (3d). */
export function answerStatus ( form: AnswerForm ): { hasQuestion: boolean; hasAnswer: boolean; ready: boolean } {
  const hasQuestion = !!form.question.trim();
  const hasAnswer = form.answers.some( ( a ) => a.answer.trim() );
  return { hasQuestion, hasAnswer, ready: hasQuestion && hasAnswer };
}

/** "https://sos.wa.gov/archives/x" -> "sos.wa.gov/archives/x" for link chips. */
export function linkLabel ( url: string ): string {
  return String( url || '' ).replace( /^https?:\/\/(www\.)?/, '' ).replace( /\/$/, '' );
}

export function normalizeUrl ( value: string ): string {
  const text = String( value || '' ).trim();
  if ( !text ) return '';
  return /^https?:\/\//i.test( text ) ? text : `https://${ text }`;
}

/** The API payload: empty rows dropped, status derived. */
export function toPayload ( form: AnswerForm, extra: { mayaReference: boolean } ): Record<string, unknown> {
  const { ready } = answerStatus( form );
  return {
    question: form.question.trim(),
    category: form.category.trim(),
    answers: form.answers
        .filter( ( a ) => a.answer.trim() )
        .map( ( a ) => ( { answer: a.answer.trim(), source: a.source.trim(), ...( a.document ? { document: a.document } : {} ) } ) ),
    recommendations: form.recommendations
        .filter( ( r ) => r.text.trim() )
        .map( ( r ) => ( { type: r.type, text: r.text.trim(), link: r.link.trim(), ...( r.document ? { document: r.document } : {} ) } ) ),
    resources: form.resources.filter( ( r ) => r.link.trim() ).map( ( r ) => ( { link: r.link.trim() } ) ),
    keywords: [...new Set( form.keywords.map( ( k ) => k.trim().toLowerCase() ).filter( Boolean ) )],
    mayaReference: extra.mayaReference,
    status: ready ? 'complete' : 'draft',
  };
}

/** An API record (old wizard entries included) as the form. */
export function fromRecord ( raw: any ): AnswerForm {
  const answers: AnswerRow[] = ( Array.isArray( raw?.answers ) ? raw.answers : [] ).map( ( a: any ) => ( { answer: String( a?.answer || '' ), source: String( a?.source || '' ), document: a?.document?.src ? a.document : null } ) );
  if ( !answers.length && ( raw?.response || raw?.answer ) ) answers.push( { answer: String( raw.response || raw.answer ), source: '', document: null } );
  return {
    question: String( raw?.question || '' ),
    category: String( raw?.category || '' ),
    answers: answers.length ? answers : [{ answer: '', source: '', document: null }],
    recommendations: ( Array.isArray( raw?.recommendations ) ? raw.recommendations : [] ).map( ( r: any ) => ( {
      type: ['Practice', 'Policy', 'Resource'].includes( r?.type ) ? r.type : 'Practice',
      text: String( r?.text || '' ),
      link: String( r?.link || '' ),
      document: r?.document?.src ? r.document : null,
    } ) ),
    resources: ( Array.isArray( raw?.resources ) ? raw.resources : [] ).filter( ( r: any ) => r?.link ).map( ( r: any ) => ( { link: String( r.link ) } ) ),
    keywords: Array.isArray( raw?.keywords ) ? raw.keywords.map( String ) : [],
  };
}
