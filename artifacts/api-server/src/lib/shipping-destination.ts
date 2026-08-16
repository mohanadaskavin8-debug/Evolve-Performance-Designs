/**
 * Destination normalization for carrier rate quotes — the single source of
 * truth used by EVERY quote path. Carrier quotes must only ever be requested
 * with a REAL destination: a customer-provided postal code, or a country that
 * has no postal codes. Anything else returns null and callers fall back to
 * stored flat prices instead of quoting against a fabricated destination.
 */

/** Countries the store ships to — also pins Stripe's allowed_countries. The cart UI mirrors this list. */
export const ALLOWED_COUNTRIES = ["US", "CA", "GB", "AU", "DE", "FR", "JP", "SG", "AE"];

/** Countries without postal codes: live quotes are allowed with no postal value. */
export const NO_POSTAL_COUNTRIES = new Set(["AE"]);

/** Trimmed postal code, or null when absent/blank/non-string. Never the string "undefined". */
export function normalizePostal(postalCode: unknown): string | null {
  if (typeof postalCode !== "string") return null;
  const trimmed = postalCode.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export interface QuoteDestination {
  countryCode: string;
  /** null only for no-postal countries — a quotable destination never fabricates a postal value. */
  postalCode: string | null;
}

/**
 * Returns a live-quotable destination, or null when carrier quotes must not
 * be attempted (unknown country, or a postal-code country without a postal).
 */
export function quoteDestination(countryCode: unknown, postalCode: unknown): QuoteDestination | null {
  if (typeof countryCode !== "string") return null;
  const country = countryCode.trim().toUpperCase();
  if (!ALLOWED_COUNTRIES.includes(country)) return null;
  const postal = normalizePostal(postalCode);
  if (postal) return { countryCode: country, postalCode: postal };
  if (NO_POSTAL_COUNTRIES.has(country)) return { countryCode: country, postalCode: null };
  return null;
}
