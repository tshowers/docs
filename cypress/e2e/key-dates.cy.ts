// Key dates and addenda (design_handoff_todd_docs_lifecycle 1f/1g/1h)
// through the app: 16Ahead reads the RFP for its dates and questions on the
// first visit, the next deadline gets the banner and Add to calendar, the
// owner picks, edits and sends the questions from their own inbox, adds a
// date, and an addendum that moved the due date shows what changed with
// "Check again". The API is stubbed; the server's rules are in todd-backend
// __tests__/keyDatesAndUpdates.test.js.

export {};

const OPP = 'opp-king-county';
const ok = <T>( data: T ) => ( { success: true, data } );
/** A local calendar day, YYYY-MM-DD: the app counts days in local time. */
const day = ( offset: number ) => {
  const d = new Date();
  d.setDate( d.getDate() + offset );
  return `${ d.getFullYear() }-${ String( d.getMonth() + 1 ).padStart( 2, '0' ) }-${ String( d.getDate() ).padStart( 2, '0' ) }`;
};

const base = {
  id: OPP, title: 'Permit Portal Modernization', agency: 'King County', solicitationNumber: 'RFP 2026-118', summary: '',
  dueDate: day( 10 ), dueDateBefore: '', estimatedValue: '', pageLimit: '', portalUrl: '',
  submission: { method: 'email', email: 'bids@kingcounty.gov' }, criteria: [],
  fit: { score: 92, headline: '', reasons: [], gaps: [] },
  source: { kind: 'email', label: '', from: 'no-reply@kingcounty.gov', subject: '', receivedAt: '', mailboxId: 'm1' },
  status: 'drafting', stage: 'drafting', rfpDocumentId: 'rfp-doc', proposalDocumentId: 'proposal-doc', submissionRecord: null,
  mustHaves: { status: 'done', items: [{ id: 'mh1', state: 'met' }], checkedAt: '', summary: { total: 1, met: 1, notMet: 0, unknown: 0 } },
  unreadUpdates: 0, decision: null, noBid: null, history: [], createdAt: '', updatedAt: '',
};

const dates = {
  status: 'done', questionsTo: 'procurement@kingcounty.gov', questionsVia: 'email', checkedAt: '',
  items: [
    { id: 'd1', kind: 'prebid', label: 'Pre-bid meeting', date: day( -1 ), where: 'online', source: 'rfp', previousDate: '' },
    { id: 'd2', kind: 'questions_due', label: 'Questions due', date: day( 2 ), where: '', source: 'rfp', previousDate: '' },
    { id: 'd3', kind: 'expected_award', label: 'Expected award', date: day( 40 ), where: '', source: 'rfp', previousDate: '' },
  ],
};
const questions = { sent: null, items: [
  { id: 'q1', text: 'About how many permit records and attachments are there, and in what format?', why: 'unclear scope', ref: '4.1', picked: true },
  { id: 'q2', text: 'Is there a budget range for the first release?', why: 'no budget stated', ref: '', picked: true },
  { id: 'q3', text: 'Who maintains the current system?', why: 'finds the incumbent', ref: '', picked: true },
  { id: 'q4', text: 'How are the 30 technical points split?', why: 'scoring detail', ref: '', picked: false },
] };

const inbox = { id: 'm1', emailAddress: 'tyrone@taliferro.com', displayName: 'Tyrone', provider: 'gmail', providerLabel: 'Gmail', status: 'connected', purposes: ['outreach', 'rfp'], rfpSenders: [], rfpLastSyncAt: '', rfpLastSyncStatus: '', rfpFoundCount: 0 };

function asOwner ( win: Window ) { win.localStorage.setItem( '__docsCypressAuth', 'true' ); }

describe( 'Key dates and addenda', () => {
  beforeEach( () => {
    cy.intercept( 'GET', /\/api\/docs\/inboxes$/, ok( [inbox] ) );
    cy.intercept( 'GET', /\/api\/docs\/opportunities$/, ok( [] ) );
  } );

  it( 'reads the dates on the first visit, then sends the picked questions from your inbox', () => {
    let current: any = { ...base, keyDates: { status: 'unchecked', items: [], questionsTo: '', questionsVia: 'unknown', checkedAt: '' }, buyerQuestions: { items: [], sent: null } };
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-king-county$/, ( req ) => req.reply( ok( current ) ) );
    cy.intercept( 'GET', /\/opp-king-county\/updates$/, ok( [] ) );
    cy.intercept( 'POST', /\/dates\/check$/, ( req ) => {
      current = { ...base, keyDates: dates, buyerQuestions: questions };
      req.reply( { delay: 300, body: ok( current ) } );
    } ).as( 'read' );
    cy.intercept( 'PATCH', /\/opp-king-county\/questions$/, ( req ) => {
      const change = req.body.items[0];
      current = { ...current, buyerQuestions: { ...current.buyerQuestions, items: current.buyerQuestions.items.map( ( q: any ) => q.id === change.id ? { ...q, ...change } : q ) } };
      req.reply( ok( current ) );
    } ).as( 'save' );
    cy.intercept( 'POST', /\/questions\/send$/, ( req ) => {
      current = { ...current, buyerQuestions: { ...current.buyerQuestions, sent: { at: new Date().toISOString(), to: req.body.to, from: 'tyrone@taliferro.com', count: 3, messageId: 'm' } } };
      req.reply( ok( current ) );
    } ).as( 'send' );

    cy.visit( `/opportunities/${ OPP }`, { onBeforeLoad: asOwner } );
    cy.contains( '.kd-line', 'Reading the RFP for its dates' );
    cy.wait( '@read' ).its( 'request.body' ).should( 'deep.equal', { force: false } );

    cy.contains( '.kd-banner.is-soon', 'Questions due in 2 days' ).and( 'contain', 'send to procurement@kingcounty.gov' );
    cy.get( '.kd-steps li' ).should( 'have.length', 4 );
    cy.contains( '.kd-steps li[data-state="past"]', 'Pre-bid meeting' );
    cy.contains( '.kd-steps li[data-state="next"]', 'Questions due' );
    cy.contains( '.kd-steps li[data-state="later"]', 'Proposal due' );

    cy.contains( '.kd-questions', 'Questions I\'d ask King County' ).and( 'contain', '3 of 4 picked' );
    cy.contains( '.kd-qs li', 'From 4.1 · unclear scope' );
    cy.get( '.kd-qs li' ).eq( 2 ).find( 'input[type="checkbox"]' ).uncheck();
    cy.wait( '@save' ).its( 'request.body' ).should( 'deep.equal', { items: [{ id: 'q3', picked: false }] } );
    cy.get( '.kd-qs li' ).eq( 3 ).find( 'textarea' ).should( 'have.value', 'How are the 30 technical points split?' ).clear().type( 'How are the 30 technical approach points split between design and integration?' ).blur();
    cy.wait( '@save' ).its( 'request.body.items.0.text' ).should( 'eq', 'How are the 30 technical approach points split between design and integration?' );
    cy.get( '.kd-qs li' ).eq( 3 ).find( 'input[type="checkbox"]' ).check();
    cy.wait( '@save' );

    cy.contains( 'button', 'Send 3 from tyrone@taliferro.com' ).click();
    // The signer comes from the Firebase-authenticated profile, which the stubbed sign-in doesn't have.
    cy.wait( '@send' ).its( 'request.body' ).should( 'include', { mailboxId: 'm1', to: 'procurement@kingcounty.gov' } );
    cy.contains( '.kd-sent', 'You sent 3 questions to procurement@kingcounty.gov' );
    cy.get( '.kd-qs' ).should( 'not.exist' );
    cy.contains( '.bu-card', 'Not posted yet' );
    cy.contains( '.bu-card', 'Must-haves: all met' );
  } );

  it( 'adds a date the RFP didn\'t give, and downloads a calendar file', () => {
    let current: any = { ...base, keyDates: { ...dates, items: [dates.items[0], dates.items[2]] }, buyerQuestions: { items: [], sent: null } };
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-king-county$/, ( req ) => req.reply( ok( current ) ) );
    cy.intercept( 'GET', /\/opp-king-county\/updates$/, ok( [] ) );
    cy.intercept( 'POST', /\/opp-king-county\/dates$/, ( req ) => {
      current = { ...current, keyDates: { ...current.keyDates, items: [...current.keyDates.items, { id: 'd9', kind: req.body.kind, label: 'Questions due', date: req.body.date, where: '', source: 'you', previousDate: '' }] } };
      req.reply( ok( current ) );
    } ).as( 'add' );

    cy.visit( `/opportunities/${ OPP }`, { onBeforeLoad: asOwner } );
    cy.contains( '.kd-line', 'I didn\'t find a questions deadline in the RFP.' );
    cy.contains( '.kd-banner', 'Proposal due in 10 days' );
    cy.contains( 'button', '+ Add a date' ).click();
    cy.get( '.kd-add select' ).select( 'Questions due' );
    cy.get( '.kd-add input[type="date"]' ).type( day( 3 ) );
    cy.contains( '.kd-add button', 'Add' ).click();
    cy.wait( '@add' ).its( 'request.body' ).should( 'deep.equal', { kind: 'questions_due', date: day( 3 ) } );
    cy.contains( '.kd-banner.is-soon', 'Questions due in 3 days' );
    cy.contains( '.kd-banner button', 'Add to calendar' ).click();
    cy.readFile( 'cypress/downloads/Questions due - Permit Portal Modernization.ics' ).should( 'contain', 'SUMMARY:Questions due: Permit Portal Modernization' ).and( 'contain', `DTSTART;VALUE=DATE:${ day( 3 ).replace( /-/g, '' ) }` );
  } );

  it( 'shows what an addendum changed, with the items to check again', () => {
    const moved = { ...base, dueDate: day( 17 ), dueDateBefore: day( 10 ), unreadUpdates: 1, keyDates: dates, buyerQuestions: { ...questions, sent: { at: new Date().toISOString(), to: 'procurement@kingcounty.gov', from: 'tyrone@taliferro.com', count: 3, messageId: 'm' } } };
    let updates: any[] = [
      { id: 'u2', kind: 'addendum', number: '2', headline: 'Addendum 2 arrived. Three things changed.', from: 'no-reply@kingcounty.gov', subject: 'Addendum 2', receivedAt: new Date().toISOString(), detailsElsewhere: false, link: 'https://kingcounty.gov/rfp/2026-118/addendum-2', read: false, answers: [], savedAnswers: 0,
        changes: [
          { kind: 'due_date', title: 'Due date moved', detail: 'The proposal is now due a week later.', ref: '', newDate: day( 17 ), checkAgain: false },
          { kind: 'requirement', title: 'Requirement 3.4.2 changed', detail: 'WCAG 2.1 AA is now WCAG 2.2 AA.', ref: '3.4.2', newDate: '', checkAgain: true },
          { kind: 'form', title: 'New form: Attachment F', detail: 'Subcontractor disclosure.', ref: '', newDate: '', checkAgain: true },
        ] },
      { id: 'u0', kind: 'answers', number: '', headline: 'Two answers posted.', from: 'no-reply@kingcounty.gov', subject: 'Answers', receivedAt: new Date().toISOString(), detailsElsewhere: false, link: '', read: true, savedAnswers: 2, changes: [],
        answers: [{ question: 'How many records are in the 2011 system?', answer: 'About 310,000 permits and 1.2 million attachments.', useful: true }, { question: 'Is there a budget range?', answer: 'Up to $500,000 for the first two years.', useful: true }] },
    ];
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-king-county$/, ok( moved ) );
    cy.intercept( 'GET', /\/opp-king-county\/updates$/, ( req ) => req.reply( ok( updates ) ) );
    cy.intercept( 'POST', /\/updates\/u2\/read$/, ( req ) => {
      updates = updates.map( ( u ) => u.id === 'u2' ? { ...u, read: true } : u );
      req.reply( ok( updates ) );
    } ).as( 'read' );

    cy.visit( `/opportunities/${ OPP }`, { onBeforeLoad: asOwner } );
    cy.contains( '.kd-addendum h2', 'Addendum 2 arrived. Three things changed.' );
    cy.contains( '.kd-addendum', 'matched to RFP 2026-118' );
    cy.get( '.kd-changes li' ).should( 'have.length', 3 );
    cy.get( '.kd-again' ).should( 'have.length', 2 );
    cy.contains( '.kd-addendum a', 'Open the 2 items to check' ).should( 'have.attr', 'href' ).and( 'include', '/proposal?view=requirements' );
    cy.contains( '.kd-addendum a', 'Read the addendum' ).should( 'have.attr', 'href', 'https://kingcounty.gov/rfp/2026-118/addendum-2' );
    cy.contains( '.kd-steps li', 'Proposal due' ).find( 's' ).should( 'exist' );
    cy.contains( '.bu-card', 'Buyer\'s answers' ).and( 'contain', 'About 310,000 permits' ).and( 'contain', 'Saved to Knowledge under King County.' );

    cy.contains( '.kd-addendum button', 'Mark as read' ).click();
    cy.wait( '@read' );
    cy.get( '.kd-addendum' ).should( 'not.exist' );
    cy.contains( '.bu-card', 'Addendum 2' ).and( 'contain', 'The proposal is now due a week later.' );
  } );

  it( 'shows the next date and a new addendum on the Opportunities cards', () => {
    cy.intercept( 'GET', /\/api\/docs\/opportunities$/, ok( [
      { ...base, status: 'new', stage: 'qualifying', proposalDocumentId: '', keyDates: dates, unreadUpdates: 1 },
      { ...base, id: 'opp-2', status: 'new', stage: 'found', title: 'Utility Billing Self-Service', dueDate: day( 20 ), keyDates: { ...dates, items: [] }, unreadUpdates: 0 },
    ] ) );
    cy.visit( '/opportunities', { onBeforeLoad: asOwner } );
    cy.contains( '.opp-card', 'Permit Portal' ).within( () => {
      cy.contains( '.opp-chip--pink', 'New addendum' );
      cy.contains( '.opp-chip--yellow', 'Questions due in 2 days' );
    } );
    cy.contains( '.opp-card', 'Utility Billing' ).find( '.opp-chip' ).first().should( 'contain', 'Due ' ).and( 'not.have.class', 'opp-chip--yellow' );
  } );
} );
