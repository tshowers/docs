// The whole approval flow through the Docs app: Dana asks two people on
// Review & send, sends each their link, both approve from the link signed
// out, and Dana sends. The backend is a small fake kept in this file so the
// owner's page and the approvers' links see the same request; the server's
// own rules are tested in todd-backend __tests__/approval.flow.test.js.

const OPP = 'opp-king-county';
const html = '<h2>5. Pricing</h2><p>We propose a fixed price of $438,000.</p><h3>5.2 Terms</h3><p>Liability is limited to the fees paid.</p>';
const ok = <T>( data: T ) => ( { success: true, data } );

const opportunity = {
  id: OPP, title: 'Permit Portal Modernization', agency: 'King County', solicitationNumber: 'RFP 2026-118', summary: '',
  dueDate: '2099-10-24', estimatedValue: '', pageLimit: '', portalUrl: '',
  submission: { method: 'email', email: 'bids@kingcounty.gov' }, criteria: [],
  fit: { score: 90, headline: '', reasons: [], gaps: [] },
  source: { kind: 'email', label: '', from: 'no-reply@kingcounty.gov', subject: '', receivedAt: '', mailboxId: 'dana-gmail' },
  status: 'drafting', rfpDocumentId: '', proposalDocumentId: 'proposal-doc', submissionRecord: null, createdAt: '', updatedAt: '',
};
const draft = {
  opportunityId: OPP, proposalDocumentId: 'proposal-doc', hasRfpFile: true, sections: [], questions: [], pages: 1, updatedAt: '',
  checklist: [{ id: 'c1', kind: 'attachment', label: 'Attachment B (signed)', detail: '', ok: true, status: 'Found in Documents', documentId: 'attachment-b' }],
};
const attachmentB = { id: 'attachment-b', name: 'Attachment B (signed).pdf', title: 'Attachment B (signed)', type: 'attachment', mimeType: 'application/pdf', storagePath: 'docs-cypress-user/documents/attachment-b.pdf', src: 'https://example.com/b.pdf' };

interface FakeApprover { id: string; name: string; email: string; token: string; state: string; approvedVersion: number; message: string; openedAt: string; decidedAt: string; sharedAt: string; }

/** The server's side of it, just enough to drive the screens. */
class FakeApprovals {
  request: any = null;
  sent = false;

  ask ( body: any ) {
    const approvers: FakeApprover[] = body.approvers.map( ( a: any, i: number ) => ( {
      id: `a${ i + 1 }`, name: a.name, email: a.email, token: `token-${ i + 1 }-0123456789abcdefghijkl`,
      state: 'waiting', approvedVersion: 0, message: '', openedAt: '', decidedAt: '', sharedAt: '',
    } ) );
    const at = new Date().toISOString();
    this.request = {
      opportunityId: OPP, rule: body.rule, dueAt: body.dueAt, note: body.note, onApproved: body.onApproved, allowSuggestions: body.allowSuggestions,
      status: 'waiting', version: 1, email: body.email, attachments: body.attachments, proposalPdfId: '', approvers,
      events: [{ type: 'requested', actor: body.ownerName, at, meta: { names: approvers.map( ( a ) => a.name || a.email ) } }],
      bypassReason: '', linkExpiresAt: '2099-10-24T23:59:59.000Z', proposalChanged: false, comments: [], createdAt: at, updatedAt: at,
    };
    return this.request;
  }

  byToken ( token: string ): FakeApprover {
    return this.request.approvers.find( ( a: FakeApprover ) => a.token === token );
  }

  view ( token: string ) {
    const me = this.byToken( token );
    const r = this.request;
    return {
      readOnly: this.sent, status: r.status, ownerName: 'Dana Reyes', company: 'Taliferro Tech', note: r.note, rule: r.rule, dueAt: r.dueAt,
      allowSuggestions: r.allowSuggestions, version: r.version,
      opportunity: { title: opportunity.title, agency: opportunity.agency, solicitationNumber: opportunity.solicitationNumber, dueDate: opportunity.dueDate, portalOnly: false },
      email: { to: r.email.to, subject: r.email.subject, body: r.email.body }, attachments: r.attachments.map( ( a: any ) => ( { name: a.name, detail: a.detail } ) ),
      checklist: { ok: 1, total: 1 }, html, previousHtml: '', previousVersion: 0, linkExpiresAt: r.linkExpiresAt,
      me: { id: me.id, name: me.name, email: me.email, state: me.state, message: me.message, decidedAt: me.decidedAt },
      others: r.approvers.filter( ( a: FakeApprover ) => a !== me ).map( ( a: FakeApprover ) => ( { name: a.name || a.email, state: a.state, decidedAt: a.decidedAt } ) ),
      comments: [],
    };
  }

  decide ( token: string, decision: string, message: string ) {
    const me = this.byToken( token );
    const at = new Date().toISOString();
    me.state = decision === 'approve' ? 'approved' : 'changes';
    me.approvedVersion = decision === 'approve' ? this.request.version : 0;
    me.message = message;
    me.decidedAt = at;
    this.request.events.push( { type: decision === 'approve' ? 'approved' : 'changesRequested', actor: me.name || me.email, at, meta: { version: 1, message } } );
    const states = this.request.approvers.map( ( a: FakeApprover ) => a.state );
    this.request.status = states.every( ( s: string ) => s === 'approved' ) ? 'approved' : states.includes( 'changes' ) ? 'changes' : 'waiting';
  }
}

function asOwner ( win: Window ) { win.localStorage.setItem( '__docsCypressAuth', 'true' ); }
function signedOut ( win: Window ) { win.localStorage.removeItem( '__docsCypressAuth' ); }

describe( 'Approval before sending, through the app', () => {
  it( 'asks, both approve from their links, and Dana sends', () => {
    const fake = new FakeApprovals();
    const links: Record<string, string> = {};
    let sendBody: any = null;

    // Owner's data for Review & send.
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-king-county$/, ( req ) => req.reply( ok( fake.sent ? { ...opportunity, status: 'submitted', submissionRecord: { method: 'email', to: 'bids@kingcounty.gov', from: 'dana@taliferro.tech', submittedAt: new Date().toISOString(), attachments: [{ filename: 'a', bytes: 1 }, { filename: 'b', bytes: 1 }] } } : opportunity ) ) );
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-king-county\/proposal$/, ok( draft ) );
    // The score-check (score-check.cy.ts) has run already, so Review & send doesn't run one.
    cy.intercept( 'GET', /\/proposal\/scorecheck$/, ok( { status: 'done', total: 80, max: 100, criteria: [], opening: null, ranAt: new Date().toISOString(), stale: false } ) );
    cy.intercept( 'GET', /\/api\/docs\/inboxes$/, ok( [{ id: 'dana-gmail', emailAddress: 'dana@taliferro.tech', displayName: 'Dana Reyes', provider: 'gmail', providerLabel: 'Gmail', status: 'connected', purposes: ['outreach', 'rfp'], rfpSenders: [], rfpLastSyncAt: '', rfpLastSyncStatus: '', rfpFoundCount: 0 }] ) );
    cy.intercept( 'GET', /\/api\/profile$/, { profile: { firstName: 'Dana', lastName: 'Reyes', companyName: 'Taliferro Tech' } } );
    cy.intercept( 'GET', /\/api\/docs$/, { documents: [attachmentB] } );
    cy.intercept( 'GET', /\/api\/docs\/proposal-doc$/, { document: { id: 'proposal-doc', title: 'Proposal · Permit Portal Modernization', type: 'proposal', htmlContent: html } } );

    // Approval, owner side.
    cy.intercept( 'GET', /\/api\/docs\/opportunities\/opp-king-county\/approval$/, ( req ) => req.reply( ok( fake.request ) ) ).as( 'getApproval' );
    cy.intercept( 'POST', /\/api\/docs\/opportunities\/opp-king-county\/approval$/, ( req ) => req.reply( ok( fake.ask( req.body ) ) ) ).as( 'ask' );
    cy.intercept( 'POST', /\/approval\/approvers\/[^/]+\/shared$/, ( req ) => {
      const id = req.url.split( '/approvers/' )[1].split( '/' )[0];
      fake.request.approvers.find( ( a: FakeApprover ) => a.id === id ).sharedAt = new Date().toISOString();
      req.reply( ok( { sharedAt: '' } ) );
    } ).as( 'shared' );

    // Approvers, from their links.
    cy.intercept( 'GET', /\/api\/public\/approvals\/[^/]+$/, ( req ) => req.reply( ok( fake.view( req.url.split( '/' ).pop()! ) ) ) ).as( 'open' );
    cy.intercept( 'POST', /\/api\/public\/approvals\/[^/]+\/decision$/, ( req ) => {
      const token = req.url.split( '/' ).slice( -2 )[0];
      fake.decide( token, req.body.decision, req.body.message );
      req.reply( ok( fake.view( token ) ) );
    } ).as( 'decide' );

    // Send: the proposal PDF goes to Storage and Documents, then out from Dana's inbox.
    cy.intercept( 'POST', '**/firebasestorage.googleapis.com/**', { name: 'docs-cypress-user/documents/proposal.pdf', bucket: 'taliferrotech.appspot.com', contentType: 'application/pdf', size: '100', downloadTokens: 't' } );
    cy.intercept( 'GET', '**/firebasestorage.googleapis.com/**', { name: 'docs-cypress-user/documents/proposal.pdf', bucket: 'taliferrotech.appspot.com', downloadTokens: 't' } );
    cy.intercept( 'POST', /\/api\/docs$/, { document: { id: 'proposal-pdf' } } ).as( 'savePdf' );
    cy.intercept( 'POST', /\/proposal\/send$/, ( req ) => {
      sendBody = req.body;
      fake.sent = true;
      fake.request.status = 'sent';
      req.reply( ok( { ...opportunity, status: 'submitted', submissionRecord: { method: 'email', to: req.body.to, from: 'dana@taliferro.tech', submittedAt: new Date().toISOString(), attachments: [{ filename: 'a', bytes: 1 }, { filename: 'b', bytes: 1 }] } } ) );
    } ).as( 'send' );

    // ── Dana asks ────────────────────────────────────────────────
    cy.visit( `/opportunities/${ OPP }/send`, { onBeforeLoad: asOwner } );
    cy.contains( 'h1', 'Everything the RFP asks for is in.' );
    cy.contains( 'button', 'Send proposal' ).should( 'be.enabled' );
    cy.contains( 'button', 'Get approval' ).click();

    cy.contains( 'h2', 'Get approval before sending' );
    cy.get( '#ga-entry' ).type( 'Marcus Lee <marcus@taliferro.tech>{enter}' ).type( 'jordan@parkito.law{enter}' );
    cy.get( '.ga__token' ).should( 'have.length', 2 );
    cy.contains( 'No 16Ahead account or sign-in needed.' );
    cy.get( '#ga-note' ).type( 'Can you check pricing in section 5?' );
    cy.contains( '.ga__actions button', 'Ask for approval' ).click();

    cy.wait( '@ask' ).its( 'request.body' ).should( ( body ) => {
      expect( body.approvers ).to.deep.equal( [{ name: 'Marcus Lee', email: 'marcus@taliferro.tech' }, { name: '', email: 'jordan@parkito.law' }] );
      expect( body.rule ).to.equal( 'all' );
      expect( body.onApproved ).to.equal( 'notify' );
      expect( body.email ).to.include( { to: 'bids@kingcounty.gov', mailboxId: 'dana-gmail' } );
      expect( body.attachments.map( ( a: any ) => a.documentId ) ).to.deep.equal( ['attachment-b'] );
    } );

    // ── Dana sends each person their link ───────────────────────
    cy.contains( 'h2', 'Send each person their link' );
    cy.window().then( ( win ) => {
      cy.stub( win.navigator.clipboard, 'writeText' ).callsFake( ( text: string ) => {
        links[text.includes( 'token-1' ) ? 'marcus' : 'jordan'] = text;
        return Promise.resolve();
      } );
    } );
    cy.get( '.ga__links li' ).eq( 0 ).contains( 'button', 'Copy link' ).click();
    cy.get( '.ga__links li' ).eq( 1 ).contains( 'button', 'Copy link' ).click();
    cy.wait( ['@shared', '@shared'] );
    cy.get( '.ga__links li' ).eq( 1 ).find( 'a' ).first().should( 'have.attr', 'href' ).and( 'match', /^mailto:jordan%40parkito\.law\?subject=/ );
    cy.contains( '.ga__actions button', 'Done' ).click();

    cy.contains( 'h1', '0 of 2 approved.' );
    cy.contains( 'button', 'Send after approval' ).should( 'be.disabled' );
    cy.contains( 'button', 'Send without approval…' );

    // ── Both approve from their links, signed out ───────────────
    cy.then( () => {
      expect( links['marcus'] ).to.match( /\/approve\/token-1-/ );
      expect( links['jordan'] ).to.match( /\/approve\/token-2-/ );
    } );
    for ( const who of ['jordan', 'marcus'] ) {
      cy.then( () => cy.visit( new URL( links[who] ).pathname, { onBeforeLoad: signedOut } ) );
      cy.wait( '@open' );
      cy.get( 'app-docs-header' ).should( 'not.exist' );
      cy.contains( 'Shared with you by' ).should( 'contain', 'Dana Reyes' );
      cy.get( '.ap__page' ).should( 'contain', 'Liability is limited to the fees paid.' );
      cy.contains( '.ap__decide button', 'Approve' ).click();
      cy.wait( '@decide' ).its( 'request.body.decision' ).should( 'equal', 'approve' );
      cy.contains( 'You approved version 1.' );
    }

    // ── Back to Dana: approved, Send unlocks, it goes ───────────
    cy.visit( `/opportunities/${ OPP }/send`, { onBeforeLoad: asOwner } );
    cy.contains( 'h1', 'Approved. Ready to send.' );
    cy.contains( 'Approved version 1' );
    // The Approvers card (lifecycle 1m): each line says who approved which version.
    cy.get( '.rs__people .rs__who small' ).should( 'have.length', 2 ).each( ( line ) => expect( line.text().trim() ).to.match( /^Approved v1 · / ) );
    cy.get( '.rs__people .rs__copy' ).should( 'not.exist' );
    cy.contains( 'button', 'Send proposal' ).should( 'be.enabled' ).click();

    cy.wait( '@send' ).then( () => {
      expect( sendBody ).to.include( { mailboxId: 'dana-gmail', to: 'bids@kingcounty.gov' } );
      expect( sendBody.documentIds ).to.deep.equal( ['proposal-pdf', 'attachment-b'] );
      expect( sendBody.subject ).to.equal( fake.request.email.subject );
    } );
    cy.contains( 'h1', 'Sent.' );
    cy.contains( 'Sent to bids@kingcounty.gov' );
  } );
} );
