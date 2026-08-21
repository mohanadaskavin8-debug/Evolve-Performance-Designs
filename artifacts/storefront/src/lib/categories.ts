/**
 * Product categories for the two-sided storefront flow:
 * Home (2 category cards) → Category page (design cards) → Product detail.
 *
 * Categorization is driven by the Shopify "Product type" field (productType).
 * Products with no type fall back to a title/handle keyword match so the
 * store keeps working even before the owner sets types in Shopify Admin.
 */

export type CategorySlug = 'lifting-straps' | 'wrist-wraps';

export interface CategoryDef {
  slug: CategorySlug;
  name: string;
  /** Short cinematic unit code used as a design accent, e.g. "EP-01". */
  code: string;
  tagline: string;
  /** Shopify "Product type" value that assigns a product to this category. */
  productType: string;
}

export const CATEGORIES: CategoryDef[] = [
  {
    slug: 'lifting-straps',
    name: 'Lifting Straps',
    code: 'EP-01',
    tagline: 'Cinematic straps. Maximum grip. Zero compromise.',
    productType: 'Lifting Straps',
  },
  {
    slug: 'wrist-wraps',
    name: 'Wrist Wraps',
    code: 'EP-02',
    tagline: 'Lock in your wrists. Lift with conviction.',
    productType: 'Wrist Wraps',
  },
];

export function getCategory(slug: string | undefined): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

interface CategorizableProduct {
  productType?: string | null;
  title?: string;
  handle?: string;
}

/** Decide which category a product belongs to. Defaults to lifting straps. */
export function categorizeProduct(p: CategorizableProduct): CategorySlug {
  const type = (p.productType ?? '').toLowerCase();
  if (type.includes('wrist')) return 'wrist-wraps';
  if (type.includes('strap') || type.includes('lifting')) return 'lifting-straps';

  // No explicit type set in Shopify — fall back to name matching.
  const text = `${p.title ?? ''} ${p.handle ?? ''}`.toLowerCase();
  if (text.includes('wrist')) return 'wrist-wraps';
  return 'lifting-straps';
}
