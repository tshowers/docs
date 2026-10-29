// After submittal (design_handoff_todd_docs_lifecycle 1k/1l) through the
// app: TODD's drafted answer to a clarification is edited and sent from the
// owner's inbox, the orals get a date and a prep sheet, a loss gets its
// reason and a debrief request, and a win saves sections to Knowledge. The
// API is stubbed; the server's rules are in todd-backend
// __tests__/afterSubmittal.test.js.

export {};

const OPP = 'opp-everett';
const ok = <T>( data: T ) => ( { success: true, data } );
const later = ( days: number ) => new Date( Date.now() + days * 86400000 ).toISOString();

const base: any = {
  id: OPP, title: 'Parks Reservations App', agency: 'City of Everett', solicitationNumber: 'RFP 26-09', summary: '',
  dueDate: later( -10 ).slice( 0, 10 ), estimatedValue: '', pageLimit: '', portalUrl: '',
  submission: { method: 'email', email: 'purchasing@everettwa.gov' }, criteria: [],
  fit: { score: 81, headline: '', reasons: [], gaps: [] },
  source: { kind: 'email', label: '', from: 'no-reply@everettwa.gov', subject: '', receivedAt: '', mailboxId: 'm1' },
  status: 'submitted', stage: 'submitted', rfpDocumentId: 'rfp', proposalDocumentId: 'proposal-doc',
  submissionRecord: { method: 'email', to: 'purchasing@everettwa.gov', from: 'tyrone@taliferro.com', submittedAt: later( -10 ) },
  keyDates: { status: 'done', items: [{ id: 'd1', kind: 'expected_award', label: 'Expected award', date: later( 20 ).slice( 0, 10 ), where: '', source: 'rfp', previousDate: '' }], questionsTo: '', questionsVia: 'email', checkedAt: '' },
  buyerQuestions: { items: [], sent: null }, unreadUpdates: 0,
  post: { clarifications: [], orals: null, outcome: null, debrief: null, savedSections: [] },
  createdAt: '', updatedAt: '',
};
const inbox = { id: 'm1', emailAddress: 'tyrone@taliferro.com', displayName: '', provider: 'gmail', providerLabel: 'Gmail', status: 'connected', purposes: ['outreach', 'rfp'], rfpSenders: [], rfpLastSyncAt: '', rfpLastSyncStatus: '', rfpFoundCount: 0 };

function asOwner ( win: Window ) { win.localStorage.setItem( '__docsCypressAuth', 'true' ); }

describe( 'After submittal', () => {
  let current: any;
  const withPost = ( post: any, extra: any = {} ) => {
    current = { ...current, ...extra, post: { ...current.post, ...post } };
    return current;
  };

  beforeEach( () => {
    current = JSON.parse( JSON.stringify( base ) );
    cy.intercept( 'GET', /\/api\/docs\/inboxes$/, ok( [inbox] ) );
    cy.intercept( 'GET', /\/api\/docs\/opportunities$/, ok( [] ) );
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-everett$/, ( req ) => req.reply( ok( current ) ) );
    cy.intercept( 'GET', /\/updates$/, ok( [] ) );
  } );

  it( 'answers a clarification with TODD\'s draft, from your inbox', () => {
    cy.intercept( 'POST', /\/clarifications$/, ( req ) => req.reply( ok( withPost( { clarifications: [{ id: 'c1', question: req.body.question, askedAt: new Date().toISOString(), source: 'you', answer: 'Yes. Year-2 support of $24,000 includes hosting.', draftedAt: new Date().toISOString(), sentAt: '', sentTo: '', sentFrom: '' }] } ) ) ) ).as( 'log' );
    cy.intercept( 'POST', /\/clarifications\/c1\/send$/, ( req ) => req.reply( ok( withPost( { clarifications: [{ ...current.post.clarifications[0], answer: req.body.answer, sentAt: new Date().toISOString(), sentTo: 'purchasing@everettwa.gov', sentFrom: 'tyrone@taliferro.com' }] } ) ) ) ).as( 'send' );

    cy.visit( `/opportunities/${ OPP }`, { onBeforeLoad: asOwner } );
    cy.get( '.as-tiles li' ).should( 'have.length', 5 );
    cy.contains( '.as-tiles li[data-state="current"]', 'Submitted' );
    cy.get( '.kd-banner' ).should( 'not.exist' );
    cy.contains( '.as-award', 'How did it go?' );

    cy.contains( '.cl-log button', 'Log a question' ).click();
    cy.get( '.cl-log textarea' ).type( 'Please confirm whether hosting is included in the year-2 support price.' );
    cy.contains( '.cl-log button', 'Log it' ).click();
    cy.wait( '@log' );
    cy.contains( '.cl-card.is-open', 'Everett asked' ).and( 'contain', 'Please confirm whether hosting' );
    cy.contains( '.as-tiles li[data-state="current"]', 'Clarification' );
    cy.get( '.cl-card.is-open textarea' ).should( 'have.value', 'Yes. Year-2 support of $24,000 includes hosting.' ).type( ' Backups and security updates too.' );
    cy.contains( '.cl-card button', 'Send from tyrone@taliferro.com' ).click();
    cy.wait( '@send' ).its( 'request.body' ).should( 'include', { mailboxId: 'm1', to: 'purchasing@everettwa.gov', answer: 'Yes. Year-2 support of $24,000 includes hosting. Backups and security updates too.' } );
    cy.contains( '.cl-card', 'You sent · drafted by 16Ahead' ).and( 'contain', 'Sent from tyrone@taliferro.com' );
    cy.contains( '.as-history', 'Clarification' );
  } );

  it( 'adds the oral presentation and TODD\'s prep sheet', () => {
    cy.intercept( 'POST', /\/orals$/, ( req ) => req.reply( ok( withPost( { orals: { date: req.body.date, attendees: req.body.attendees, place: req.body.place, minutes: req.body.minutes, prep: null } } ) ) ) ).as( 'orals' );
    cy.intercept( 'POST', /\/orals\/prep$/, ( req ) => req.reply( ok( withPost( { orals: { ...current.post.orals, prep: { questions: ['How will you move our existing reservations without downtime?', 'Who supports it after launch?', 'Can residents book without an account?'], themes: ['You talk to the engineers building it', 'Live in weeks, not months', 'A modern cloud stack'], numbers: ['$186K total, 2 years', '3 releases over 14 weeks', '40,000 visits on election night'] }, at: '' } } ) ) ) ).as( 'prep' );

    cy.visit( `/opportunities/${ OPP }`, { onBeforeLoad: asOwner } );
    cy.contains( 'button', 'Invited to an oral presentation?' ).click();
    const day = later( 5 ).slice( 0, 10 );
    cy.get( '.as-form input[type="date"]' ).type( day );
    cy.get( '.as-form input[name="people"]' ).clear().type( 'Tyrone Showers, Dana Lee' );
    cy.get( '.as-form input[name="place"]' ).type( 'Everett City Hall, Room 3' );
    cy.contains( '.as-form button', 'Save' ).click();
    cy.wait( '@orals' ).its( 'request.body' ).should( ( body ) => {
      expect( body.attendees ).to.deep.equal( ['Tyrone Showers', 'Dana Lee'] );
      expect( body.minutes ).to.equal( 45 );
      expect( body.date.slice( 0, 4 ) ).to.equal( day.slice( 0, 4 ) );
    } );
    cy.contains( '.as-tiles li[data-state="current"]', 'Oral presentation' );
    cy.contains( '.as-meta', 'Tyrone Showers, Dana Lee · 45 minutes · Everett City Hall, Room 3' );
    cy.contains( 'button', 'Make the prep sheet' ).click();
    cy.wait( '@prep' );
    cy.contains( '.as-prep', 'Likely questions' ).and( 'contain', 'without downtime' ).and( 'contain', '$186K total' );
    cy.contains( 'button', 'Download prep sheet' ).click();
    cy.readFile( 'cypress/downloads/Prep sheet - Parks Reservations App.pdf', { timeout: 10000 } ).should( 'have.length.greaterThan', 500 );
    cy.contains( '.as-card button', 'Add to calendar' ).click();
    cy.readFile( 'cypress/downloads/Oral presentation - Parks Reservations App.ics' ).should( 'contain', 'LOCATION:Everett City Hall\\, Room 3' );
  } );

  it( 'records a loss with why, and asks for a debrief from your email', () => {
    cy.intercept( 'POST', /\/outcome$/, ( req ) => req.reply( ok( withPost( { outcome: { result: req.body.result, reason: req.body.reason || '', at: new Date().toISOString() } }, { status: req.body.result === 'won' ? 'won' : 'lost', stage: req.body.result } ) ) ) ).as( 'outcome' );
    cy.intercept( 'POST', /\/debrief\/send$/, ( req ) => req.reply( ok( withPost( { debrief: { to: req.body.to, subject: req.body.subject, sentAt: new Date().toISOString(), sentFrom: 'tyrone@taliferro.com', remindAt: later( 7 ), repliedAt: '' } } ) ) ) ).as( 'debrief' );

    cy.visit( `/opportunities/${ OPP }`, { onBeforeLoad: asOwner } );
    cy.contains( '.as-chip', 'We lost' ).click();
    cy.wait( '@outcome' ).its( 'request.body' ).should( 'deep.equal', { result: 'lost' } );
    cy.contains( '.as-award', 'Why do you think?' );
    cy.contains( '.as-chip', 'Experience' ).click();
    cy.wait( '@outcome' ).its( 'request.body' ).should( 'deep.equal', { result: 'lost', reason: 'Experience' } );
    cy.contains( '.as-tiles li[data-state="current"]', 'Lost' ).and( 'contain', 'Experience' );
    cy.contains( '.as-award', 'Win and loss reasons go into how I score new RFPs' );
    cy.get( '.as-mail input[type="email"]' ).should( 'have.value', 'purchasing@everettwa.gov' );
    cy.get( '.as-mail input' ).eq( 1 ).should( 'have.value', 'Debrief request: RFP 26-09 Parks Reservations App' );
    cy.contains( 'button', 'Send from my email' ).click();
    cy.wait( '@debrief' ).its( 'request.body' ).should( 'include', { mailboxId: 'm1', to: 'purchasing@everettwa.gov', remind: true } );
    cy.contains( '.as-sent', 'Debrief request sent to purchasing@everettwa.gov.' ).and( 'contain', 'if there\'s no reply' );
    cy.contains( '.as-history li', 'Lost' ).should( 'contain', 'Why: Experience.' );
  } );

  it( 'after a win, saves the winning sections to Knowledge', () => {
    current = { ...current, status: 'won', stage: 'won', post: { ...current.post, outcome: { result: 'won', reason: '', at: new Date().toISOString() } } };
    cy.intercept( 'GET', /\/opp-everett\/proposal$/, ok( { opportunityId: OPP, proposalDocumentId: 'proposal-doc', hasRfpFile: true, questions: [], checklist: [], pages: 3, updatedAt: '', sections: [
      { key: 'tech', title: '3. Technical approach', ask: '', criteria: [], status: 'done', blocks: [{ type: 'paragraph', text: 'x' }] },
      { key: 'team', title: '2. Team', ask: '', criteria: [], status: 'done', blocks: [{ type: 'paragraph', text: 'y' }] },
    ] } ) );
    cy.intercept( 'POST', /\/outcome\/knowledge$/, ( req ) => req.reply( ok( { opportunity: withPost( { savedSections: req.body.sectionKeys } ), saved: req.body.sectionKeys.length, reason: '' } ) ) ).as( 'save' );

    cy.visit( `/opportunities/${ OPP }`, { onBeforeLoad: asOwner } );
    cy.contains( '.as-tiles li[data-state="current"]', 'Won' );
    cy.contains( '.as-save', 'Save the winning sections to Knowledge?' );
    cy.contains( '.as-save label', '2. Team' ).find( 'input' ).uncheck();
    cy.contains( '.as-save button', 'Save 1 section' ).click();
    cy.wait( '@save' ).its( 'request.body' ).should( 'deep.equal', { sectionKeys: ['tech'] } );
    cy.contains( '.as-save label', '2. Team' );
    cy.contains( '.as-save label', 'Technical approach' ).should( 'not.exist' );
  } );
} );
