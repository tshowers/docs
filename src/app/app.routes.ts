import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    // Home (1b; 2a signed out). The old landing page's content is About.
    path: '',
    pathMatch: 'full',
    data: {
      pageTitle: 'Docs',
      meta: {
        title: 'Docs — Proposals, RFPs, and your knowledge base | 16Ahead',
        description: 'Docs and Knowledge keep proposals, RFPs, and your response library in one place so 16Ahead can draft, track, and reuse them.',
        keepSocial: true,
      },
    },
    loadComponent: () =>
      import( './features/home/home.component' ).then( ( m ) => m.HomeComponent ),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import( './features/auth-callback/auth-callback.component' ).then( ( m ) => m.AuthCallbackComponent ),
  },
  {
    path: 'mobile-handoff',
    loadComponent: () =>
      import( './features/mobile-handoff/mobile-handoff.component' ).then( ( m ) => m.MobileHandoffComponent ),
  },
  {
    path: 'ios',
    data: {
      meta: {
        title: 'Docs for iOS | 16Ahead',
        description: 'Docs for iOS is coming soon: keep proposals, RFP responses, and your knowledge base within reach wherever the work takes you.',
      },
    },
    loadComponent: () =>
      import( './features/app-showcase/app-showcase.component' ).then( ( m ) => m.AppShowcaseComponent ),
  },
  {
    // The signed-out header's About tab (2b).
    path: 'about',
    data: {
      pageTitle: 'About',
      meta: {
        title: 'About Docs | 16Ahead',
        description: 'What Docs and Knowledge do: store proposals and RFPs, build a reusable answer library, and let 16Ahead draft responses from your own work.',
      },
    },
    loadComponent: () =>
      import( './features/about/about.component' ).then( ( m ) => m.AboutComponent ),
  },
  {
    path: 'help',
    data: {
      pageTitle: 'Help',
      meta: {
        title: 'Docs Help | 16Ahead',
        description: 'How to add documents and RFPs, build Knowledge answers, and use 16Ahead to draft and send proposals in Docs.',
      },
    },
    loadComponent: () =>
      import( './features/help/help.component' ).then( ( m ) => m.HelpComponent ),
  },
  {
    path: 'docs/success',
    data: { flow: 'docs', pageTitle: 'Payment' },
    loadComponent: () =>
      import( './features/payment-success/payment-success.component' ).then( ( m ) => m.PaymentSuccessComponent ),
  },
  {
    path: 'knowledge/success',
    data: { flow: 'knowledge', pageTitle: 'Payment' },
    loadComponent: () =>
      import( './features/payment-success/payment-success.component' ).then( ( m ) => m.PaymentSuccessComponent ),
  },
  {
    // The old Stripe plan pages now forward to the one "browse free,
    // create with the app" pricing page.
    path: 'docs/pricing',
    redirectTo: '/pricing',
  },
  {
    path: 'knowledge/pricing',
    redirectTo: '/pricing',
  },
  {
    // Home used to live at /docs; old links and bookmarks land on /.
    // Redirects here are absolute: with server rendering, a relative one on
    // a two-segment path (docs/pricing -> pricing) resolves under docs/ and
    // loops.
    path: 'docs',
    pathMatch: 'full',
    redirectTo: '/',
  },
  {
    path: 'docs/landing',
    redirectTo: '/',
  },
  {
    // An approver's private link (round 4): no account or sign-in, no app header.
    path: 'approve/:token',
    data: { pageTitle: 'Approve' },
    loadComponent: () =>
      import( './features/approve/approve.component' ).then( ( m ) => m.ApproveComponent ),
  },
  {
    // The short form from the lifecycle handoff (1m). Links 16Ahead makes stay /approve/.
    path: 'a/:token',
    // A function, so server-side routing fills in the token too.
    redirectTo: ( { params } ) => `/approve/${ encodeURIComponent( params['token'] || '' ) }`,
  },
  {
    // The four tabs (design_handoff_todd_docs): Home, Opportunities,
    // Documents, Knowledge. Each tab's old pages redirect into it.
    path: 'opportunities',
    data: { pageTitle: 'Opportunities' },
    loadComponent: () =>
      import( './features/opportunities/opportunities.component' ).then( ( m ) => m.OpportunitiesComponent ),
  },
  {
    path: 'opportunities/inbox',
    data: { pageTitle: 'RFP inbox' },
    loadComponent: () =>
      import( './features/rfp-inbox/rfp-inbox.component' ).then( ( m ) => m.RfpInboxComponent ),
  },
  {
    // Review & send (1f): from the person's own inbox, or a portal package.
    path: 'opportunities/:id/send',
    data: { pageTitle: 'Review & send' },
    loadComponent: () =>
      import( './features/review-send/review-send.component' ).then( ( m ) => m.ReviewSendComponent ),
  },
  {
    // The proposal editor: 16Ahead drafts, asks, and checks against the RFP.
    path: 'opportunities/:id/proposal',
    data: { pageTitle: 'Proposal' },
    loadComponent: () =>
      import( './features/proposal-editor/proposal-editor.component' ).then( ( m ) => m.ProposalEditorComponent ),
  },
  {
    path: 'opportunities/:id',
    data: { pageTitle: 'Opportunity' },
    loadComponent: () =>
      import( './features/opportunity-detail/opportunity-detail.component' ).then( ( m ) => m.OpportunityDetailComponent ),
  },
  {
    path: 'documents',
    data: { pageTitle: 'Documents' },
    loadComponent: () =>
      import( './features/document-list/document-list.component' ).then( ( m ) => m.DocumentListComponent ),
  },
  {
    path: 'documents/:id',
    data: { pageTitle: 'Document' },
    loadComponent: () =>
      import( './features/document-detail/document-detail.component' ).then( ( m ) => m.DocumentDetailComponent ),
  },
  {
    path: 'docs/documents',
    redirectTo: '/documents',
  },
  {
    path: 'upload',
    data: { pageTitle: 'Add files' },
    loadComponent: () =>
      import( './features/general-document-upload/general-document-upload.component' ).then( ( m ) => m.GeneralDocumentUploadComponent ),
  },
  {
    path: 'docs/upload',
    redirectTo: '/upload',
  },
  {
    // The header's New button (1j): 16Ahead writes a first draft, then the
    // editor - where every document opens - takes over.
    path: 'new',
    data: { pageTitle: 'New' },
    loadComponent: () =>
      import( './features/new-document/new-document.component' ).then( ( m ) => m.NewDocumentComponent ),
  },
  {
    path: 'docs/editor',
    loadComponent: () =>
      import( './features/document-editor/document-editor.component' ).then( ( m ) => m.DocumentEditorComponent ),
  },
  {
    path: 'docs/editor/:id',
    loadComponent: () =>
      import( './features/document-editor/document-editor.component' ).then( ( m ) => m.DocumentEditorComponent ),
  },
  {
    path: 'docs/proposal-history',
    redirectTo: '/opportunities',
  },
  {
    path: 'docs/rfp-list',
    redirectTo: '/opportunities',
  },
  {
    path: 'docs/rfp-upload',
    redirectTo: '/upload?rfp=1',
  },
  {
    // Add / Edit answer (3d): one page in place of the old wizard, at the
    // wizard's address so existing links keep working.
    path: 'knowledge/response-flow',
    data: { pageTitle: 'Answer' },
    loadComponent: () =>
      import( './features/answer-form/answer-form.component' ).then( ( m ) => m.AnswerFormComponent ),
  },
  {
    path: 'knowledge/response-flow/:id',
    data: { pageTitle: 'Answer' },
    loadComponent: () =>
      import( './features/answer-form/answer-form.component' ).then( ( m ) => m.AnswerFormComponent ),
  },
  {
    path: 'knowledge',
    data: { pageTitle: 'Knowledge' },
    loadComponent: () =>
      import( './features/repository/repository.component' ).then( ( m ) => m.RepositoryComponent ),
  },
  {
    // "Save to Knowledge" from Find; before 'knowledge/:id' so "save" isn't an id.
    path: 'knowledge/save',
    data: { pageTitle: 'Save to Knowledge' },
    loadComponent: () =>
      import( './features/find-save/find-save.component' ).then( ( m ) => m.FindSaveComponent ),
  },
  {
    path: 'knowledge/:id',
    data: { pageTitle: 'Answer' },
    loadComponent: () =>
      import( './features/knowledge-detail/knowledge-detail.component' ).then( ( m ) => m.KnowledgeDetailComponent ),
  },
  {
    // Pre-sign-in wizard: write a first Q&A answer, then name + company,
    // then sign in (web twin of docs-ios's OnboardingWizardView). /login
    // stays a direct handoff for returning users and deep links.
    path: 'get-started',
    loadComponent: () =>
      import( './features/get-started/get-started.component' ).then( ( m ) => m.GetStartedComponent ),
  },
  {
    // In-app profile (shared fields/API with the iOS apps' TODDProfileKit),
    // replacing the menu's link out to 16Ahead's /update-profile.
    path: 'profile',
    loadComponent: () =>
      import( './features/profile/profile.component' ).then( ( m ) => m.ProfileComponent ),
  },
  {
    path: 'login',
    loadComponent: () =>
      import( './features/sign-in/sign-in.component' ).then( ( m ) => m.SignInComponent ),
  },
  {
    // "Browse free, create with the app" (Ty, 2026-09-28) - shared wording
    // in @taliferro/ui/platform/get-the-app.model.ts.
    path: 'pricing',
    data: {
      product: 'docs',
      meta: {
        title: 'Docs Pricing | 16Ahead',
        description: 'Browse Docs free on the web, and create with the app: plans for proposals, RFP responses, and a reusable knowledge base.',
      },
    },
    loadComponent: () =>
      import( './features/get-the-app/get-the-app.component' ).then( ( m ) => m.GetTheAppComponent ),
  },
  {
    // Without a catch-all, an unmatched URL (e.g. /pricing before the
    // redirect above existed) failed to navigate and left a blank page
    // under the menu. Same convention as Network/Pulse.
    path: '**',
    loadComponent: () =>
      import( './features/not-found/not-found.component' ).then( ( m ) => m.NotFoundComponent ),
  },
];
