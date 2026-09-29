import { Routes } from '@angular/router';
import { landingRedirectGuard } from './services/landing-redirect.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [landingRedirectGuard],
    loadComponent: () =>
      import( './features/landing/landing.component' ).then( ( m ) => m.LandingComponent ),
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
    loadComponent: () =>
      import( './features/app-showcase/app-showcase.component' ).then( ( m ) => m.AppShowcaseComponent ),
  },
  {
    path: 'help',
    loadComponent: () =>
      import( './features/help/help.component' ).then( ( m ) => m.HelpComponent ),
  },
  {
    path: 'docs/success',
    loadComponent: () =>
      import( './features/docs-paid-success/docs-paid-success.component' ).then( ( m ) => m.DocsPaidSuccessComponent ),
  },
  {
    path: 'knowledge/success',
    loadComponent: () =>
      import( './features/knowledge-paid-success/knowledge-paid-success.component' ).then( ( m ) => m.KnowledgePaidSuccessComponent ),
  },
  {
    // The old Stripe plan pages now forward to the one "browse free,
    // create with the app" pricing page.
    path: 'docs/pricing',
    redirectTo: 'pricing',
  },
  {
    path: 'knowledge/pricing',
    redirectTo: 'pricing',
  },
  {
    path: 'docs',
    loadComponent: () =>
      import( './features/document-home/document-home.component' ).then( ( m ) => m.DocumentHomeComponent ),
  },
  {
    path: 'docs/landing',
    redirectTo: 'docs',
  },
  {
    path: 'docs/upload',
    loadComponent: () =>
      import( './features/general-document-upload/general-document-upload.component' ).then( ( m ) => m.GeneralDocumentUploadComponent ),
  },
  {
    path: 'docs/documents',
    loadComponent: () =>
      import( './features/document-list/document-list.component' ).then( ( m ) => m.DocumentListComponent ),
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
    loadComponent: () =>
      import( './features/proposal-history/proposal-history.component' ).then( ( m ) => m.ProposalHistoryComponent ),
  },
  {
    path: 'docs/rfp-list',
    loadComponent: () =>
      import( './features/rfp-list/rfp-list.component' ).then( ( m ) => m.RfpListComponent ),
  },
  {
    path: 'docs/rfp-upload',
    loadComponent: () =>
      import( './features/rfp-upload/rfp-upload.component' ).then( ( m ) => m.RfpUploadComponent ),
  },
  {
    path: 'knowledge/response-flow',
    loadComponent: () =>
      import( './features/response-flow/response-flow.component' ).then( ( m ) => m.ResponseFlowComponent ),
  },
  {
    path: 'knowledge/response-flow/:id',
    loadComponent: () =>
      import( './features/response-flow/response-flow.component' ).then( ( m ) => m.ResponseFlowComponent ),
  },
  {
    path: 'knowledge',
    loadComponent: () =>
      import( './features/repository/repository.component' ).then( ( m ) => m.RepositoryComponent ),
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
    // replacing the menu's link out to TODD's /update-profile.
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
    data: { product: 'docs' },
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
