---
name: Shopify storefront integration
description: How this project talks to Shopify, token gotchas, and how to smoke-test without the owner's token
---

# Shopify storefront integration

**Rule:** All Shopify access is server-side through one env-based client (`SHOPIFY_STORE_DOMAIN` + `SHOPIFY_STOREFRONT_ACCESS_TOKEN`), failing loudly with 503 "not connected" when unconfigured. No connector fallback in app code.

**Why:** The target store is the owner's own store, not the Replit connector's dev store — silently falling back to the connector would show the wrong catalog. The public token must never reach the browser anyway, since the custom design hides that Shopify is behind it.

**How to apply:** New Shopify features go through the existing client module; never fetch Shopify from the frontend.

## Gotchas
- Storefront API error "Online Store channel is locked"or 401/403 ⇒ token/store-access problem (wrong token type, unpublished sales channel, or store transferred), not a code bug. Products invisible via API but visible in admin ⇒ not published to the headless/custom app's sales channel.
- Cart GIDs embed `?key=…` — cart ids only travel in query params or POST bodies, never path params.
- Expired/invalid carts: Shopify returns null — API returns an empty-cart shape (`id: null`) and the client clears its stored cart id.

## Smoke-testing without the owner's token
The Replit Shopify connector (slug `shopify-store` for `listConnections`) exposes Admin API access to a populated dev store. Pattern: mint an ephemeral Storefront API token via Admin GraphQL `storefrontAccessTokenCreate`, run a throwaway server instance with the token + dev-store domain inline (nothing persisted), curl the endpoints, then `storefrontAccessTokenDelete` it. A repo-root helper script wraps Admin GraphQL calls through the connector proxy.
