# Evolve Performance

E-commerce storefront for anime/game-inspired lifting straps. **Shopify is the system of record** — the owner manages products, inventory, orders, discounts and shipping in Shopify Admin; Shopify's hosted checkout handles payment, shipping and taxes. The custom storefront keeps its cinematic design and reads Shopify data server-side.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (binds `PORT`; dev script = esbuild build + start, so restart the workflow to pick up changes)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run seed` — seed website content (settings/pages/homepage sections only)
- Required env: `DATABASE_URL`, `SHOPIFY_STORE_DOMAIN` (e.g. `ep-23446707.myshopify.com`), `SHOPIFY_STOREFRONT_ACCESS_TOKEN` (Storefront API public token)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 · DB: PostgreSQL + Drizzle ORM (website content + support/newsletter only)
- Commerce: Shopify Storefront API (GraphQL, version pinned in `shopifyStorefrontClient.ts`)
- API codegen: Orval from `lib/api-spec/openapi.yaml` → `lib/api-client-react` hooks + `lib/api-zod`
- Email: Resend via Replit integration (owner notifications for support requests, newsletter/marketing loop)

## Where things live

- `artifacts/storefront` — customer storefront (root path `/`): three-step shopping flow — home shows two category panels (Lifting Straps / Wrist Wraps) → `/category/:slug` lists that category's designs → `/products/:handle` product detail; plus all-gear shop, collections, cart, support, newsletter pages
- `artifacts/admin` — static notice page pointing to Shopify Admin (the old custom admin portal was retired)
- `artifacts/api-server` — Express API (`/api`): `/shop/*` (Shopify proxy), `/support`, `/newsletter`, `/marketing`, `/content`
- `artifacts/api-server/src/lib/shopifyStorefrontClient.ts` — the ONLY module that talks to Shopify; env-based config, fails loudly (503) when unconfigured
- `artifacts/api-server/src/routes/shop.ts` — products/collections/cart endpoints; converts money to integer cents; cart mutations are RPC-style POSTs

## Architecture decisions

- **Shopify token stays server-side**: the browser never sees `SHOPIFY_STOREFRONT_ACCESS_TOKEN`; the storefront calls `/api/shop/*` only.
- **No local commerce state**: cart lives in Shopify (cart id in browser localStorage `ep_shopify_cart_id`); checkout = redirect to `cart.checkoutUrl` (Shopify hosted checkout). No Stripe, no ShipStation, no user accounts (Clerk removed).
- **Money is integer cents** end-to-end in the API (`priceInCents` etc.), converted server-side from Shopify's decimal amounts.
- **Featured products** = Shopify tag `featured` (fallback: 4 newest). **Theme** = first non-"featured" tag.
- **Old commerce DB tables were kept** (orders, products, etc.) — non-destructive migration; only website-content tables are actively used (site_settings, homepage_sections, website_pages, support_requests, newsletter_subscribers + marketing tables).
- **Support requests**: DB insert + fire-and-forget email to owner (Resend, Reply-To = customer).

## Product

- Storefront: cinematic dark theme (red-on-black, scanlines, glitch hover effects); two-panel animated category home, per-category design pages, product detail with size variants, cart, Shopify checkout handoff, support form, newsletter signup with double opt-in.
- Product categorization: driven by the Shopify **"Product type"** field — set it to `Lifting Straps` or `Wrist Wraps` on each product in Shopify Admin (the CSV import sets it automatically). Products with no type fall back to name matching ("wrist" in the name → Wrist Wraps side), defaulting to Lifting Straps. Logic lives in `artifacts/storefront/src/lib/categories.ts`.
- Storefront plays a ~2.5s cinematic logo intro on every full page load (`src/components/SiteIntro.tsx`); append `?intro=0` to skip it — tests and screenshots should do this. It auto-skips for users with reduced-motion enabled.
- Store owner works in Shopify Admin (`https://admin.shopify.com/store/ep-23446707`); the store is pre-launch and password-protected until launched.

## User preferences

- The owner is non-technical: explain things in plain language, avoid jargon.

## Gotchas

- After editing `lib/api-spec/openapi.yaml`, always run `pnpm --filter @workspace/api-spec run codegen` (regenerates hooks + zod, then typechecks libs).
- Cart GIDs contain `?key=…` — pass cart ids in query params/POST bodies only, never as path params.
- A stale/expired cart id must return the empty-cart shape (`id: null`), and the client clears localStorage when it sees it.
- Shopify "Online Store channel is locked" or 401/403 from the Storefront API ⇒ bad/missing token (or store not accessible), not a code bug.
- Drizzle: never interpolate JS arrays into raw ``sql`… = ANY(${arr})` `` — use `inArray()` (raw `pool.query` with a real array param is fine).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
