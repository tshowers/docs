import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'auth/callback',
    loadComponent: () =>
      import( './features/auth-callback/auth-callback.component' ).then( ( m ) => m.AuthCallbackComponent ),
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
    path: 'docs/pricing',
    loadComponent: () =>
      import( './features/docs-pricing/docs-pricing.component' ).then( ( m ) => m.DocsPricingComponent ),
  },
  {
    path: 'knowledge/pricing',
    loadComponent: () =>
      import( './features/knowledge-pricing/knowledge-pricing.component' ).then( ( m ) => m.KnowledgePricingComponent ),
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
];
