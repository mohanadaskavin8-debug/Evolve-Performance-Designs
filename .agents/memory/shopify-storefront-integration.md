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
- Optional scopes: querying `quantityAvailable` requires `unauthenticated_read_product_inventory` and hard-errors the whole query when the token lacks it — don't query it; `availableForSale` is sufficient for storefront controls.
- Cart GIDs embed `?key=…` — cart ids only travel in query params or POST bodies, never path params.
- Expired/invalid carts: Shopify returns null — API returns an empty-cart shape (`id: null`) and the client clears its stored cart id.

## Smoke-testing without the owner's token
The Replit Shopify connector's dev store can stand in for the owner's store: mint an ephemeral Storefront token via Admin GraphQL (`storefrontAccessTokenCreate`), test, then delete it (`storefrontAccessTokenDelete`) — never persist it.
- Shopify keeps the original handle when a title is renamed — this catalog has renamed products (title "Knight At Night" has handle "soccer"; title "Soccer" has handle "wrist-wraps"), so keyword fallbacks on handles can mislead. Owner-confirmed override list in storefront categories.ts pins Knight At Night + Tokyo Drift to Wrist Wraps until Product types are set in Shopify Admin.
