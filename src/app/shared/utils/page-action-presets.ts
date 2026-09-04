import { PageAction } from '../../models/page-actions.models';

/**
 * Trimmed from taliferrotech's shared/utils/page-action-presets.ts - only
 * buildDocumentPageActions (this app's two products, Docs + Knowledge,
 * both use it) is kept; buildOutreachPageActions and its Outreach-specific
 * action set are dropped as out of scope. Routes rewritten for this app's
 * own tree.
 */
interface DocumentPageActionOptions {
  includeNotes?: boolean;
  noteVisible?: () => boolean;
  noteHandler?: () => void;
  includeMenuEditor?: boolean;
}

export function buildDocumentPageActions ( options: DocumentPageActionOptions = {} ): PageAction[] {
  const actions: PageAction[] = [
    {
      id: 'documents-knowledge-base',
      label: 'Knowledge Base',
      icon: 'fa-solid fa-book-open',
      kind: 'route',
      route: '/knowledge',
      order: 20,
      feature: 'docs',
      group: 'context',
    },
    {
      id: 'documents-home',
      label: 'Documents',
      icon: 'fa-regular fa-folder',
      kind: 'route',
      route: '/docs',
      order: 0,
      feature: 'docs',
      group: 'context',
    },
    {
      id: 'documents-response-flow',
      label: 'Response Flow',
      icon: 'fa-solid fa-layer-group',
      kind: 'route',
      route: '/knowledge/response-flow',
      order: 30,
      feature: 'docs',
      group: 'context',
    },
    {
      id: 'documents-editor',
      label: 'Editor',
      icon: 'fa-solid fa-file-lines',
      kind: 'route',
      route: '/docs/editor',
      order: 40,
      feature: 'docs',
      group: 'context',
    },
    {
      id: 'documents-proposal-history',
      label: 'Proposal History',
      icon: 'fa-solid fa-clock-rotate-left',
      kind: 'route',
      route: '/docs/proposal-history',
      order: 50,
      feature: 'docs',
      group: 'context',
    },
    {
      id: 'documents-rfp-upload',
      label: 'RFP Upload',
      icon: 'fa-solid fa-upload',
      kind: 'route',
      route: '/docs/rfp-upload',
      order: 60,
      feature: 'docs',
      group: 'context',
    },
    {
      id: 'documents-rfp-list',
      label: 'RFPs',
      icon: 'fa-solid fa-folder-open',
      kind: 'route',
      route: '/docs/rfp-list',
      order: 70,
      feature: 'docs',
      group: 'context',
    },
  ];

  if ( options.includeNotes && options.noteHandler ) {
    actions.push( {
      id: 'documents-notes',
      label: 'Notes',
      icon: 'fa-regular fa-note-sticky',
      kind: 'callback',
      handler: options.noteHandler,
      visible: options.noteVisible,
      order: 80,
      group: 'context',
    } );
  }

  if ( options.includeMenuEditor ) {
    actions.push( {
      id: 'documents-menu-editor',
      label: 'Menu Editor',
      icon: 'fa-solid fa-bars',
      kind: 'route',
      route: '/knowledge',
      order: 90,
      group: 'context',
    } );
  }

  return actions;
}
