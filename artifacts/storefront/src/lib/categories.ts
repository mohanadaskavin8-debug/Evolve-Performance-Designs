/**
 * Product categories for the two-sided storefront flow:
 * Home (2 category cards) → Category page (design cards) → Product detail.
 *
 * Categorization is driven by the Shopify "Product type" field (productType).
 * Products with no type fall back to a title/handle keyword match, then to
 * Wrist Wraps because the owner's current catalog consists of wrist wraps.
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

/**
 * Designs the owner has confirmed are Wrist Wraps even though their
 * Shopify "Product type" is still empty. Matched against title + handle
 * (lowercase). Setting Product type = "Wrist Wraps" in Shopify Admin
 * always takes priority over this list.
 */
const WRIST_WRAP_DESIGNS = ['knight at night', 'tokyo drift'];

/** Decide which category a product belongs to. Untyped products default to wrist wraps. */
export function categorizeProduct(p: CategorizableProduct): CategorySlug {
  const type = (p.productType ?? '').toLowerCase();
  // Shopify taxonomy names used by this store:
  // "Weight Lifting Wrist Wrap" and "Weight Lifting Straps".
  // Check wrist first because both names contain "weight lifting".
  if (type.includes('wrist wrap') || type.includes('wrist')) return 'wrist-wraps';
  if (type.includes('lifting strap') || type.includes('strap')) return 'lifting-straps';

  // No explicit type set in Shopify — fall back to name matching.
  // Note: Shopify keeps the original handle when a product is renamed, so a
  // stale handle can still carry meaning — e.g. the design now titled
  // "Soccer" kept its original "wrist-wraps" handle and is intentionally
  // kept in Wrist Wraps by this match.
  const text = `${p.title ?? ''} ${p.handle ?? ''}`.toLowerCase();
  if (text.includes('wrist')) return 'wrist-wraps';
  if (WRIST_WRAP_DESIGNS.some((name) => text.includes(name))) return 'wrist-wraps';
  return 'wrist-wraps';
}
