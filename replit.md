# Evolve Performance

E-commerce platform for anime/game-inspired lifting straps: customer storefront, admin operations portal, and automated fulfillment pipeline.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/storefront` — customer storefront (root path `/`)
- `artifacts/admin` — admin portal (`/admin`), Clerk-gated
- `artifacts/api-server` — Express API (`/api`)
- `lib/db/src/schema/commerce.ts` — source of truth for DB schema (orders, shipments, shipment_events, transactional_emails, …)
- `lib/api-spec/openapi.yaml` — source of truth for API contracts; codegen produces `lib/api-client-react` hooks + `lib/api-zod`
- `artifacts/api-server/src/lib/shipstation.ts` — the ONLY module allowed to call the ShipStation API
- `artifacts/api-server/src/lib/fulfillment.ts` — fulfillment engine (push queue, label/tracking sync, milestone emails, 60s loop)
- `artifacts/api-server/src/lib/email.ts` — Resend transactional emails (idempotent per order+type)

## Architecture decisions

- **Payment success always wins**: Stripe webhook records the order first; ShipStation push happens async afterwards with retry/backoff — fulfillment being down can never fail a sale.
- **Fraud holds block automation**: orders with `requiresManualReview` are never auto-pushed; clearing the flag in admin resumes fulfillment.
- **Labels are bought by the owner in the ShipStation UI**, never via API. The app only pushes orders and reads back labels/tracking. `SHIPSTATION_TEST_MODE` defaults to `true`.
- **ShipStation webhooks are untrusted hints**: they only trigger an immediate re-poll; all persisted data comes from authenticated API reads.
- **Milestone emails are DB-idempotent**: `transactional_emails` claim-first unique insert on (orderId, emailType) — six milestones, no duplicates.
- **Calculated shipping rates fail open**: any ShipStation error at checkout silently falls back to the rate's stored flat price.

## Product

- Storefront: shop, cart, Stripe checkout, order tracking timeline (real carrier events once shipped), account & returns.
- Admin ("EVOLVE OS"): dashboard, orders (fraud review, fulfillment automation panel, manual push/retry), products (incl. logistics & customs fields), inventory, shipping zones/rates (flat, free, live carrier-calculated), fulfillment center (connection state, pipeline stats, shipments table), system status, reports, team roles.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After editing `lib/api-spec/openapi.yaml`, always run `pnpm --filter @workspace/api-spec run codegen` (regenerates hooks + zod, then typechecks libs).
- Stripe webhook route is raw-body mounted before JSON middleware; keep it that way.
- Admin API status values are `healthy | degraded | unhealthy` (ShipStation not connected ⇒ `degraded`, not an outage).
- Drizzle: never interpolate JS arrays into raw ``sql`… = ANY(${arr})` `` — use `inArray()` (raw `pool.query` with a real array param is fine).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
