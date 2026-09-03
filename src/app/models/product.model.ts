/**
 * Trimmed from shared/data/interfaces/product.model.ts - only the fields
 * the pricing pages actually read (per-tenant custom pricing overrides
 * stored on the tenant's own contact.company.products). Ported unchanged
 * from web-products/network's models/product.model.ts.
 */
export interface Product {
  name?: string;
  active?: boolean;
  discontinued?: boolean;
  description: string;
  shortDescription?: string;
  priceLabel?: string;
  stripePriceIdMonthly?: string;
}
