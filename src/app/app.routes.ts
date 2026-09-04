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
];
