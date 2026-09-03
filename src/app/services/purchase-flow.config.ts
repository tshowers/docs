/**
 * Trimmed from taliferrotech's services/purchase-flow.config.ts - only the
 * Docs and Knowledge entries (this app's two products), and
 * postConfirmRoute/loginReturnUrl kept exactly as they were in the
 * monorepo since this app preserves the same /docs/* and /knowledge/*
 * route prefixes. Mirrors web-products/network's own trimmed copy of
 * this file (one entry there, two here since this app hosts two products).
 */
export interface ProductPurchaseFlowConfig {
  productKey: 'docs' | 'knowledge';
  loginReturnUrl: string;
  checkoutEndpoint: string;
  confirmEndpoint: string;
  successRoute: string;
  postConfirmRoute: string;
  checkoutUrlField?: string;
  checkoutCredentials?: RequestCredentials;
  confirmCredentials?: RequestCredentials;
  legacyAccessStorageKey?: string;
}

export const DOCS_PURCHASE_FLOW: ProductPurchaseFlowConfig = {
  productKey: 'docs',
  loginReturnUrl: '/docs/pricing',
  checkoutEndpoint: '/docs/checkout',
  confirmEndpoint: '/docs/checkout/confirm',
  successRoute: '/docs/success',
  postConfirmRoute: '/docs',
};

export const KNOWLEDGE_PURCHASE_FLOW: ProductPurchaseFlowConfig = {
  productKey: 'knowledge',
  loginReturnUrl: '/knowledge/pricing',
  checkoutEndpoint: '/knowledge/checkout',
  confirmEndpoint: '/knowledge/checkout/confirm',
  successRoute: '/knowledge/success',
  postConfirmRoute: '/knowledge',
};
