/** Ported unchanged from web-products/network's models/page-actions.models.ts. */
export interface PageAction {
  id: string;
  label: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  onClick: () => void;
}

export interface PageActionsConfig {
  pageId: string;
  title?: string;
  actions: PageAction[];
}
