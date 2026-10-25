// Approval when it doesn't go straight through: an approver suggests an
// edit and asks for changes, the owner accepts the edit, asks again, and
// the approvers see only what changed; and sending without approval, with
// a reason. The happy path is approval-flow.cy.ts. The backend is a fake
// kept here so the owner's page and the approvers' links share one request;
// the server's own rules are in todd-backend __tests__/approval.flow.test.js.

export {};

const OPP = 'opp-king-county';
const ok = <T>( data: T ) => ( { success: true, data } );
const v1 = '<h2>5. Pricing</h2><p>We propose a fixed price of $438,000.</p><h3>5.2 Terms</h3><p>Liability is limited to the fees paid.</p>';

const opportunity = {
  id: OPP, title: 'Permit Portal Modernization', agency: 'King County', solicitationNumber: 'RFP 2026-118', summary: '',
  dueDate: '2099-10-24', estimatedValue: '', pageLimit: '', portalUrl: '',
  submission: { method: 'email', email: 'bids@kingcounty.gov' }, criteria: [],
  fit: { score: 90, headline: '', reasons: [], gaps: [] },
  source: { kind: 'email', label: '', from: 'no-reply@kingcounty.gov', subject: '', receivedAt: '', mailboxId: 'dana-gmail' },
  status: 'drafting', rfpDocumentId: '', proposalDocumentId: 'proposal-doc', submissionRecord: null, createdAt: '', updatedAt: '',
};
const attachmentB = { id: 'attachment-b', name: 'Attachment B (signed).pdf', title: 'Attachment B (signed)', type: 'attachment', mimeType: 'application/pdf', storagePath: 'u/documents/attachment-b.pdf', src: 'https://example.com/b.pdf' };
const draft = {
  opportunityId: OPP, proposalDocumentId: 'proposal-doc', hasRfpFile: true, sections: [], questions: [], pages: 1, updatedAt: '',
  checklist: [{ id: 'c1', kind: 'attachment', label: 'Attachment B (signed)', detail: '', ok: true, status: 'Found in Documents', documentId: 'attachment-b' }],
};
const email = { to: 'bids@kingcounty.gov', subject: 'RFP 2026-118 Permit Portal Modernization — Taliferro Tech', body: 'Dear King County Procurement,\n\nOur proposal is attached.\n\nDana Reyes', mailboxId: 'dana-gmail' };

/** The server's side, with versions: approvals of an older version don't count. */
class FakeServer {
  html = v1;
  snapshots: Record<number, string> = { 1: v1 };
  sent = false;
  comments: any[] = [];
  request: any = {
    opportunityId: OPP, rule: 'all', dueAt: '', note: 'Can you check the liability terms?', onApproved: 'notify', allowSuggestions: true,
    status: 'waiting', version: 1, email, attachments: [{ documentId: 'attachment-b', name: 'Attachment B (signed).pdf', detail: '1 pp' }], proposalPdfId: '',
    approvers: [
      { id: 'a1', name: 'Marcus Lee', email: 'marcus@taliferro.tech', token: 'token-marcus-0123456789abcdef', approvedVersion: 0, status: 'waiting', message: '', openedAt: '', decidedAt: '', sharedAt: '2026-10-20T20:00:00Z' },
      { id: 'a2', name: '', email: 'jordan@parkito.law', token: 'token-jordan-0123456789abcdef', approvedVersion: 0, status: 'waiting', message: '', openedAt: '', decidedAt: '', sharedAt: '2026-10-20T20:00:00Z' },
    ],
    events: [{ type: 'requested', actor: 'Dana Reyes', at: '2026-10-20T20:00:00Z', meta: { names: ['Marcus Lee', 'jordan@parkito.law'] } }],
    bypassReason: '', linkExpiresAt: '2099-10-24T23:59:59.000Z', createdAt: '2026-10-20T20:00:00Z', updatedAt: '2026-10-20T20:00:00Z',
  };

  state ( a: any ): string {
    if ( a.status === 'approved' ) return a.approvedVersion === this.request.version ? 'approved' : 'recheck';
    return a.status;
  }

  status (): string {
    if ( this.sent ) return 'sent';
    if ( this.request.status === 'bypassed' ) return 'bypassed';
    const states = this.request.approvers.map( ( a: any ) => this.state( a ) );
    if ( states.every( ( s: string ) => s === 'approved' ) ) return 'approved';
    return states.includes( 'changes' ) ? 'changes' : 'waiting';
  }

  owner () {
    return {
      ...this.request, status: this.status(), proposalChanged: this.html !== this.snapshots[this.request.version],
      approvers: this.request.approvers.map( ( a: any ) => ( { ...a, state: this.state( a ) } ) ),
      comments: this.comments,
    };
  }

  byToken ( token: string ) { return this.request.approvers.find( ( a: any ) => a.token === token ); }

  view ( token: string ) {
    const me = this.byToken( token );
    const state = this.state( me );
    const status = this.status();
    return {
      readOnly: status === 'sent' || status === 'bypassed', status, ownerName: 'Dana Reyes', company: 'Taliferro Tech', note: this.request.note, rule: 'all', dueAt: '',
      allowSuggestions: true, version: this.request.version,
      opportunity: { title: opportunity.title, agency: 'King County', solicitationNumber: 'RFP 2026-118', dueDate: '2099-10-24', portalOnly: false },
      email: { to: email.to, subject: email.subject, body: email.body }, attachments: [{ name: 'Attachment B (signed).pdf', detail: '1 pp' }], checklist: { ok: 1, total: 1 },
      html: this.snapshots[this.request.version], previousHtml: state === 'recheck' ? this.snapshots[me.approvedVersion] : '', previousVersion: state === 'recheck' ? me.approvedVersion : 0,
      linkExpiresAt: this.request.linkExpiresAt,
      me: { id: me.id, name: me.name, email: me.email, state, message: me.message, decidedAt: me.decidedAt },
      others: this.request.approvers.filter( ( a: any ) => a !== me ).map( ( a: any ) => ( { name: a.name || a.email, state: this.state( a ), decidedAt: a.decidedAt } ) ),
      comments: this.comments.filter( ( c ) => c.approverId === me.id ),
    };
  }

  decide ( token: string, decision: string, message: string ) {
    const me = this.byToken( token );
    me.status = decision === 'approve' ? 'approved' : 'changes';
    if ( decision === 'approve' ) me.approvedVersion = this.request.version;
    me.message = message;
    me.decidedAt = new Date().toISOString();
    this.request.events.push( { type: decision === 'approve' ? 'approved' : 'changesRequested', actor: me.name || me.email, at: me.decidedAt, meta: { version: this.request.version, message } } );
  }

  comment ( token: string, body: any ) {
    const me = this.byToken( token );
    const c = { id: `c${ this.comments.length + 1 }`, approverId: me.id, authorName: me.name || me.email, version: this.request.version, sectionTitle: body.sectionTitle, quote: body.quote, text: body.text, replacement: body.replacement ?? null, status: 'open', replies: [], createdAt: new Date().toISOString() };
    this.comments.push( c );
    this.request.events.push( { type: c.replacement !== null ? 'suggested' : 'commented', actor: c.authorName, at: c.createdAt, meta: { section: c.sectionTitle } } );
    return c;
  }

  accept ( id: string ) {
    const c = this.comments.find( ( x ) => x.id === id );
    this.html = this.html.replace( c.quote, c.replacement );
    c.status = 'accepted';
    this.request.events.push( { type: 'editAccepted', actor: 'Dana Reyes', at: new Date().toISOString(), meta: { name: c.authorName, section: c.sectionTitle } } );
  }

  /** Ask again: a new version when the proposal changed; changes requested reset to waiting. */
  askAgain () {
    if ( this.html !== this.snapshots[this.request.version] ) {
      this.request.version += 1;
      this.snapshots[this.request.version] = this.html;
      for ( const a of this.request.approvers ) if ( a.status === 'changes' ) a.status = 'waiting';
      this.request.events.push( { type: 'reasked', actor: 'Dana Reyes', at: new Date().toISOString(), meta: { version: this.request.version, names: [] } } );
    }
  }
}

function serve ( server: FakeServer ) {
  const submitted = () => ( { ...opportunity, status: 'submitted', submissionRecord: { method: 'email', to: email.to, from: 'dana@taliferro.tech', submittedAt: new Date().toISOString(), attachments: [{ filename: 'a', bytes: 1 }, { filename: 'b', bytes: 1 }] } } );
  cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-king-county$/, ( req ) => req.reply( ok( server.sent ? submitted() : opportunity ) ) );
  cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-king-county\/proposal$/, ok( draft ) );
  cy.intercept( 'GET', /\/proposal\/scorecheck$/, ok( { status: 'done', total: 80, max: 100, criteria: [], opening: null, ranAt: new Date().toISOString(), stale: false } ) );
  cy.intercept( 'GET', /\/proposal\/requirements$/, ok( { status: 'done', items: [], summary: { total: 0, answered: 0, notAnswered: 0 }, matrixRequired: false, extractedAt: '', matchedAt: '' } ) );
  cy.intercept( 'GET', /\/api\/docs\/inboxes$/, ok( [{ id: 'dana-gmail', emailAddress: 'dana@taliferro.tech', displayName: 'Dana Reyes', provider: 'gmail', providerLabel: 'Gmail', status: 'connected', purposes: ['outreach', 'rfp'], rfpSenders: [], rfpLastSyncAt: '', rfpLastSyncStatus: '', rfpFoundCount: 0 }] ) );
  cy.intercept( 'GET', /\/api\/profile$/, { profile: { firstName: 'Dana', lastName: 'Reyes', companyName: 'Taliferro Tech' } } );
  cy.intercept( 'GET', /\/api\/docs$/, { documents: [attachmentB] } );
  cy.intercept( 'GET', /\/api\/docs\/proposal-doc$/, ( req ) => req.reply( { document: { id: 'proposal-doc', title: 'Proposal · Permit Portal Modernization', type: 'proposal', htmlContent: server.html } } ) );

  cy.intercept( 'GET', /\/opp-king-county\/approval$/, ( req ) => req.reply( ok( server.owner() ) ) );
  cy.intercept( 'POST', /\/opp-king-county\/approval$/, ( req ) => {
    server.askAgain();
    req.reply( ok( server.owner() ) );
  } ).as( 'ask' );
  cy.intercept( 'POST', /\/approval\/approvers\/[^/]+\/shared$/, ok( { sharedAt: '' } ) );
  cy.intercept( 'POST', /\/approval\/comments\/[^/]+$/, ( req ) => {
    if ( req.body.action === 'accept' ) server.accept( req.url.split( '/' ).pop()! );
    req.reply( ok( server.owner() ) );
  } ).as( 'resolve' );
  cy.intercept( 'POST', /\/approval\/bypass$/, ( req ) => {
    server.request.status = 'bypassed';
    server.request.bypassReason = req.body.reason;
    server.request.events.push( { type: 'bypassed', actor: 'Dana Reyes', at: new Date().toISOString(), meta: { reason: req.body.reason } } );
    req.reply( ok( server.owner() ) );
  } ).as( 'bypass' );

  const token = ( url: string, back = 0 ) => url.split( '/' ).slice( -1 - back )[0];
  cy.intercept( 'GET', /\/api\/public\/approvals\/[^/]+$/, ( req ) => req.reply( ok( server.view( token( req.url ) ) ) ) ).as( 'open' );
  cy.intercept( 'POST', /\/api\/public\/approvals\/[^/]+\/comments$/, ( req ) => req.reply( ok( server.comment( token( req.url, 1 ), req.body ) ) ) ).as( 'comment' );
  cy.intercept( 'POST', /\/api\/public\/approvals\/[^/]+\/decision$/, ( req ) => {
    server.decide( token( req.url, 1 ), req.body.decision, req.body.message );
    req.reply( ok( server.view( token( req.url, 1 ) ) ) );
  } ).as( 'decide' );

  cy.intercept( 'POST', '**/firebasestorage.googleapis.com/**', { name: 'u/documents/proposal.pdf', bucket: 'taliferrotech.appspot.com', contentType: 'application/pdf', size: '100', downloadTokens: 't' } );
  cy.intercept( 'GET', '**/firebasestorage.googleapis.com/**', { name: 'u/documents/proposal.pdf', bucket: 'taliferrotech.appspot.com', downloadTokens: 't' } );
  cy.intercept( 'POST', /\/api\/docs$/, { document: { id: 'proposal-pdf' } } );
  cy.intercept( 'POST', /\/proposal\/send$/, ( req ) => {
    server.sent = true;
    req.reply( ok( submitted() ) );
  } ).as( 'send' );
}

const asOwner = ( win: Window ) => win.localStorage.setItem( '__docsCypressAuth', 'true' );
const signedOut = ( win: Window ) => win.localStorage.removeItem( '__docsCypressAuth' );
const MARCUS = '/approve/token-marcus-0123456789abcdef';
const JORDAN = '/approve/token-jordan-0123456789abcdef';

/** Selects text in the proposal on an approver's page, the way a person would. */
function selectText ( text: string ) {
  cy.get( '.ap__page' ).contains( text ).then( ( $el ) => {
    const node = Array.from( $el[0].childNodes ).find( ( n ) => n.nodeType === 3 && ( n.nodeValue || '' ).includes( text ) )!;
    const doc = $el[0].ownerDocument;
    const at = node.nodeValue!.indexOf( text );
    const range = doc.createRange();
    range.setStart( node, at );
    range.setEnd( node, at + text.length );
    const selection = doc.getSelection()!;
    selection.removeAllRanges();
    selection.addRange( range );
    doc.dispatchEvent( new Event( 'selectionchange' ) );
  } );
}

describe( 'Approval with changes, and without approval', () => {
  it( 'an approver suggests an edit, the owner accepts it and asks again, and only the change is re-checked', () => {
    const server = new FakeServer();
    serve( server );

    // Marcus approves version 1 from his link.
    cy.visit( MARCUS, { onBeforeLoad: signedOut } );
    cy.contains( '.ap__decide button', 'Approve' ).click();
    cy.wait( '@decide' );

    // Jordan suggests an edit on the liability terms, then asks for changes.
    cy.visit( JORDAN, { onBeforeLoad: signedOut } );
    cy.get( '.ap__page' ).should( 'contain', 'Liability is limited to the fees paid.' );
    selectText( 'the fees paid' );
    cy.get( '.ap__pop' ).contains( 'button', 'Suggest edit' ).click();
    cy.contains( '.ap__composer h2', 'Suggest an edit · 5.2 Terms' );
    cy.get( '#ap-replacement' ).should( 'have.value', 'the fees paid' ).clear().type( 'the fees paid in the 12 months before the claim' );
    cy.get( '#ap-why' ).type( 'Attachment B caps liability at 12 months.' );
    cy.contains( '.ap__composer button', 'Save' ).click();
    cy.wait( '@comment' ).its( 'request.body' ).should( 'deep.include', { sectionTitle: '5.2 Terms', quote: 'the fees paid', replacement: 'the fees paid in the 12 months before the claim', text: 'Attachment B caps liability at 12 months.' } );
    cy.get( '.ap__page .ap-sugg del' ).should( 'have.text', 'the fees paid' );
    cy.get( '.ap__page .ap-sugg ins' ).should( 'have.text', 'the fees paid in the 12 months before the claim' );
    cy.contains( '.ap__page .ap-card', 'suggested edit' ).and( 'contain', 'Attachment B caps liability at 12 months.' );
    cy.contains( '.ap__sections button', '5.2 Terms' ).find( '.ap__count' ).should( 'have.text', '1' );
    cy.contains( '.ap__decide button', 'Request changes' ).click();
    cy.wait( '@decide' ).its( 'request.body.decision' ).should( 'equal', 'changes' );
    cy.contains( 'You asked for changes.' );

    // Dana sees it, accepts the edit, and asks again.
    cy.visit( `/opportunities/${ OPP }/send`, { onBeforeLoad: asOwner } );
    cy.contains( 'h1', 'Jordan requested changes.' );
    cy.contains( 'button', 'Send after approval' ).should( 'be.disabled' );
    cy.contains( '.rs__comment', 'suggested edit' ).within( () => {
      cy.get( 'del' ).should( 'have.text', 'the fees paid' );
      cy.get( 'ins' ).should( 'have.text', 'the fees paid in the 12 months before the claim' );
      cy.contains( 'button', 'Accept edit' ).click();
    } );
    cy.wait( '@resolve' ).its( 'request.body.action' ).should( 'equal', 'accept' );
    cy.contains( 'h1', 'Changed since you asked.' );
    cy.contains( '.rs__banner', 'The proposal changed since you asked.' ).contains( 'button', 'Ask for approval again' ).click();
    cy.wait( '@ask' ).its( 'request.body.approvers' ).should( ( list ) => expect( list.map( ( a: any ) => a.id ) ).to.deep.equal( ['a1', 'a2'] ) );
    cy.contains( 'h2', 'Send each person their link' );
    cy.contains( '.ga__actions button', 'Done' ).click();
    cy.contains( 'h1', '0 of 2 approved.' );
    cy.contains( 'button', 'Send after approval' ).should( 'be.disabled' );

    // Marcus approved version 1: he's told it changed and sees what changed.
    cy.visit( MARCUS, { onBeforeLoad: signedOut } );
    cy.contains( '.ap__notice', 'You approved version 1.' );
    cy.get( '.ap__page .ap-changed' ).should( 'contain', '12 months before the claim' );
    cy.get( '.ap__page .ap-folded' ).should( 'exist' );
    cy.contains( '.ap__decide button', 'Approve' ).click();
    cy.wait( '@decide' );
    cy.contains( 'You approved version 2.' );

    cy.visit( JORDAN, { onBeforeLoad: signedOut } );
    cy.get( '.ap__page' ).should( 'contain', 'the fees paid in the 12 months before the claim' );
    cy.contains( '.ap__page .ap-card', 'accepted' );
    cy.contains( '.ap__decide button', 'Approve' ).click();
    cy.wait( '@decide' );

    // Version 2 is approved by both: Send unlocks and it goes.
    cy.visit( `/opportunities/${ OPP }/send`, { onBeforeLoad: asOwner } );
    cy.contains( 'h1', 'Approved. Ready to send.' );
    cy.contains( 'Approved version 2' );
    cy.contains( 'button', 'Send proposal' ).should( 'be.enabled' ).click();
    cy.wait( '@send' );
    cy.contains( 'h1', 'Sent.' );
  } );

  it( 'sends without approval only with a reason, and the approvers see it went without them', () => {
    const server = new FakeServer();
    serve( server );

    cy.visit( `/opportunities/${ OPP }/send`, { onBeforeLoad: asOwner } );
    cy.contains( 'h1', '0 of 2 approved.' );
    cy.contains( 'button', 'Send after approval' ).should( 'be.disabled' );
    cy.contains( 'button', 'Send without approval…' ).click();
    cy.contains( 'h2', 'Send without approval?' );
    cy.contains( 'button', 'Unlock Send' ).should( 'be.disabled' );
    cy.get( '#rs-bypass-reason' ).type( 'Marcus is out and the deadline is today.' );
    cy.contains( 'button', 'Unlock Send' ).should( 'be.enabled' ).click();
    cy.wait( '@bypass' ).its( 'request.body' ).should( 'deep.equal', { reason: 'Marcus is out and the deadline is today.' } );
    cy.get( '.toast' ).should( 'contain', 'Send is unlocked' );

    // Jordan's link: read-only now, and says why.
    cy.visit( JORDAN, { onBeforeLoad: signedOut } );
    cy.contains( '.ap__notice', 'Dana chose to send it without waiting for approval.' );
    cy.get( '.ap__decide' ).should( 'not.exist' );

    cy.visit( `/opportunities/${ OPP }/send`, { onBeforeLoad: asOwner } );
    cy.contains( 'button', 'Send proposal' ).should( 'be.enabled' ).click();
    cy.wait( '@send' );
    cy.contains( 'h1', 'Sent.' );
  } );
} );
