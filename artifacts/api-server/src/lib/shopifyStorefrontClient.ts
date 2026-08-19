/**
 * Shopify Storefront API client for the owner's own store.
 *
 * Configuration comes from environment variables — this app points at the
 * store owner's real Shopify store, not at a Replit-provisioned dev store:
 *
 *   SHOPIFY_STORE_DOMAIN            e.g. "ep-23446707.myshopify.com"
 *   SHOPIFY_STOREFRONT_ACCESS_TOKEN Storefront API public access token from
 *                                   the owner's headless/custom app
 *
 * There is intentionally NO fallback to the Replit Shopify connector: if the
 * env vars are missing the API fails loudly with a clear message instead of
 * silently serving another store's catalog. Shopify treats the Storefront
 * access token as a public buyer-facing credential, but it still never ships
 * to the browser — all Storefront API calls happen server-side here.
 */

// Pinned to a known-good Shopify API release.
const STOREFRONT_API_VERSION = "2026-04";
const FETCH_TIMEOUT_MS = 10_000;

/** Thrown when the store env vars are missing — routes map this to HTTP 503. */
export class ShopifyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopifyConfigError";
  }
}

export type ShopifyStorefrontConfig = {
  shopDomain: string;
  storefrontAccessToken: string;
};

/**
 * Accepts pasted values like "https://my-store.myshopify.com/", 
 * "my-store.myshopify.com" or "admin.shopify.com/store/my-store" and
 * normalizes to the bare myshopify.com host.
 */
export function normalizeShopDomain(raw: string): string {
  let value = raw.trim().toLowerCase();
  if (!value) return "";
  value = value.replace(/^https?:\/\//, "");
  // admin.shopify.com/store/<handle> → <handle>.myshopify.com
  const adminMatch = value.match(/^admin\.shopify\.com\/store\/([a-z0-9][a-z0-9-]*)/);
  if (adminMatch) return `${adminMatch[1]}.myshopify.com`;
  value = value.split("/")[0]!.split("?")[0]!;
  if (!value.includes(".")) value = `${value}.myshopify.com`;
  return value;
}

export function getShopifyStorefrontConfig(): ShopifyStorefrontConfig {
  const shopDomain = normalizeShopDomain(process.env.SHOPIFY_STORE_DOMAIN ?? "");
  const storefrontAccessToken = (process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ?? "").trim();

  const missing: string[] = [];
  if (!shopDomain) missing.push("SHOPIFY_STORE_DOMAIN");
  if (!storefrontAccessToken) missing.push("SHOPIFY_STOREFRONT_ACCESS_TOKEN");
  if (missing.length > 0) {
    throw new ShopifyConfigError(
      `Shopify store is not connected yet — missing ${missing.join(" and ")}. ` +
        `Set the store's .myshopify.com domain and its Storefront API access token to go live.`,
    );
  }

  return { shopDomain, storefrontAccessToken };
}

type StorefrontGraphQLError = { message?: string };

export async function shopifyStorefrontRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const config = getShopifyStorefrontConfig();

  const resp = await fetch(
    `https://${config.shopDomain}/api/${STOREFRONT_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": config.storefrontAccessToken,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    },
  );

  if (resp.status === 401 || resp.status === 403) {
    throw new Error(
      `Shopify rejected the Storefront access token (${resp.status}). ` +
        `Check SHOPIFY_STOREFRONT_ACCESS_TOKEN — it must be the Storefront API token from the store's headless/custom app, with unauthenticated read scopes enabled.`,
    );
  }

  const text = await resp.text();
  const json = text ? safeJsonParse(text) : {};
  const errors: StorefrontGraphQLError[] = Array.isArray(json.errors) ? json.errors : [];

  if (errors.some((e) => /online store channel is locked/i.test(e.message ?? ""))) {
    // Shopify returns this for requests WITHOUT a valid token on locked/password
    // stores — with a valid Storefront token the API works even pre-launch.
    throw new Error(
      "Shopify rejected the request (Online Store channel is locked). This means the Storefront access token was missing or invalid for this store — verify SHOPIFY_STOREFRONT_ACCESS_TOKEN.",
    );
  }

  if (!resp.ok || errors.length > 0) {
    throw new Error(
      `Shopify Storefront API error (${resp.status}): ${JSON.stringify(errors.length ? errors : json)}`,
    );
  }

  return json.data as T;
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return { errors: [{ message: text.slice(0, 300) }] };
  }
}
