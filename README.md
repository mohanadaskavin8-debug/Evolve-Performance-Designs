# Evolve Performance

E-commerce storefront for anime/game-inspired lifting straps. **Shopify is the system of record** — the owner manages products, inventory, orders, discounts and shipping in Shopify Admin; Shopify's hosted checkout handles payment, shipping and taxes. The custom storefront keeps its cinematic design and reads Shopify data server-side.

**Hosting:** Vercel (static site + one serverless function). **Development:** Claude Code. There is no database and nothing runs on Replit any more.

## Hosting on Vercel

- Vercel builds straight from GitHub: every push to `main` updates the live site; every other branch gets its own preview link.
- `vercel.json` pins pnpm and runs `pnpm run build:vercel` → `scripts/vercel-build.mjs`, which typechecks, then writes Vercel's [Build Output API](https://vercel.com/docs/build-output-api/v3) folder `.vercel/output/`:
  - `static/` — the storefront (Vite build)
  - `functions/api.func/` — the Express API bundled into one file; serves every `/api/*` request
  - `config.json` — routing: `/api/*` → function, real files as-is, everything else → `index.html` (single-page app)
- Required environment variables (Vercel → Project → Settings → Environment Variables):
  - `SHOPIFY_STORE_DOMAIN` = `ep-23446707.myshopify.com`
  - `SHOPIFY_STOREFRONT_ACCESS_TOKEN` = the Storefront API token from the store's headless/custom app
- A type error stops the build, so the previous version stays live until it is fixed.

### One-time Vercel setup

1. On vercel.com: **Add New → Project** → import the GitHub repo `mohanadaskavin8-debug/Evolve-Performance-Designs`.
2. Leave **Framework Preset** on "Other" and don't override the build/install commands — `vercel.json` sets them.
3. Add the two environment variables above (all environments), then **Deploy**.
4. Optional: **Settings → Domains** to attach the store's own domain, then update the domain's DNS as Vercel instructs.

## Run & develop

- `pnpm install`
- `pnpm dev` — storefront on http://localhost:5173 and API on :8080 (Vite proxies `/api`). Append `?intro=0` to skip the logo intro.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-server run test:unit` — API unit tests
- `pnpm run build:vercel` — the exact production build Vercel runs
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Products only load when `SHOPIFY_STORE_DOMAIN` and `SHOPIFY_STOREFRONT_ACCESS_TOKEN` are set **and** the machine can reach `*.myshopify.com`. In a Claude Code cloud environment that means adding the token as an environment secret and allowing `*.myshopify.com` in the environment's network access. Without them every non-product page still works, but product sections can't load.

## Stack

- pnpm workspaces, Node.js 22+, TypeScript 5.9
- Storefront: React 19 + Vite 7 + Tailwind 4, wouter routing, TanStack Query, framer-motion/GSAP
- API: Express 5 (runs as a Vercel serverless function in production)
- Commerce: Shopify Storefront API (GraphQL, version pinned in `shopifyStorefrontClient.ts`)
- API codegen: Orval from `lib/api-spec/openapi.yaml` → `lib/api-client-react` hooks + `lib/api-zod`
- No database, no email service, no user accounts

## Where things live

- `artifacts/storefront` — customer storefront: home shows two category panels (Lifting Straps / Wrist Wraps) → `/category/:slug` lists that category's designs → `/products/:handle` product detail; plus all-gear shop, collections, cart, support and content pages
- `artifacts/storefront/src/content/site.ts` — announcement bar text, business name, support email
- `artifacts/storefront/src/content/pages.ts` — FAQ, shipping/returns/privacy/terms, about, story (served at `/pages/:key`)
- `artifacts/api-server` — Express API (`/api`): `/healthz` and `/shop/*` (Shopify proxy)
- `artifacts/api-server/src/vercel.ts` — Vercel function entry point; `src/index.ts` is the local dev server
- `artifacts/api-server/src/lib/shopifyStorefrontClient.ts` — the ONLY module that talks to Shopify; env-based config, fails loudly (503) when unconfigured
- `artifacts/api-server/src/routes/shop.ts` — products/collections/cart endpoints; converts money to integer cents; cart mutations are RPC-style POSTs
- `scripts/vercel-build.mjs` — production build for Vercel

## Architecture decisions

- **Shopify token stays server-side**: the browser never sees `SHOPIFY_STOREFRONT_ACCESS_TOKEN`; the storefront calls `/api/shop/*` only.
- **No local commerce state**: cart lives in Shopify (cart id in browser localStorage `ep_shopify_cart_id`); checkout = redirect to `cart.checkoutUrl` (Shopify hosted checkout).
- **No database**: site copy lives in `src/content/*.ts` — change the text there and push to redeploy.
- **Support form** opens the customer's own email app (`mailto:`) addressed to the support email in `site.ts`, with subject, order number and message pre-filled. Nothing is stored on our side.
- **Money is integer cents** end-to-end in the API (`priceInCents` etc.), converted server-side from Shopify's decimal amounts.
- **Featured products** = Shopify tag `featured` (fallback: 4 newest). **Theme** = first non-"featured" tag.

## Product

- Storefront: cinematic dark theme (red-on-black, scanlines, glitch hover effects); two-panel animated category home, per-category design pages, product detail with size variants, cart, Shopify checkout handoff, support page.
- Product and homepage category cards use `object-contain` so Shopify photos are shown fully without cropping. Product detail purchase action says **Add to Cart**.
- Returns are all sales final except damaged, defective, incorrect items and non-excludable legal rights; that copy is in `src/content/pages.ts`.
- Product categorization: reads Shopify **Product type** first, then Shopify's taxonomy **Category** field. The store's category `Weight Lifting Wrist Wraps` maps to Wrist Wraps, and `Weight Lifting Straps` maps to Lifting Straps. Untyped products fall back to name matching and then Wrist Wraps. Logic lives in `artifacts/storefront/src/lib/categories.ts`.
- Storefront plays a ~2.5s cinematic logo intro on every full page load (`src/components/SiteIntro.tsx`); append `?intro=0` to skip it — tests and screenshots should do this. It auto-skips for users with reduced-motion enabled.
- Store owner works in Shopify Admin (`https://admin.shopify.com/store/ep-23446707`); the store is pre-launch and password-protected until launched.

## User preferences

- The owner is non-technical: explain things in plain language, avoid jargon.

## Gotchas

- After editing `lib/api-spec/openapi.yaml`, always run `pnpm --filter @workspace/api-spec run codegen` (regenerates hooks + zod, patches Zod v4 calls to v3, then typechecks libs).
- Cart GIDs contain `?key=…` — pass cart ids in query params/POST bodies only, never as path params.
- A stale/expired cart id must return the empty-cart shape (`id: null`), and the client clears localStorage when it sees it.
- Shopify "Online Store channel is locked" or 401/403 from the Storefront API ⇒ bad/missing token (or store not accessible), not a code bug. Products visible in Shopify Admin but missing from the API ⇒ not published to the headless/custom app's sales channel.
- Don't query `quantityAvailable`: it needs an extra token scope and fails the whole query without it; `availableForSale` is enough.
- Shopify keeps a product's original handle when its title is renamed, so handles can be misleading (e.g. title "Knight At Night" has handle `soccer`).
- Vercel routes `/api/*` to the function as `/api?__ep_path=<sub-path>`; `src/vercel.ts` restores the real URL before Express sees it (covered by `src/vercel.test.ts`).
