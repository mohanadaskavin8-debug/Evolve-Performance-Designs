---
name: Products route raw SQL
description: Why the products route uses pool.query instead of Drizzle for aggregation queries
---

## Rule
Use `pool.query` (raw SQL) for product listing queries that require GROUP BY with MIN/MAX over a joined table.

**Why:** Drizzle's `innerJoin` names the joined table "product_variants" (its real name), not a short alias like "pv". Raw SQL template expressions like `MIN(pv.price_in_cents)` cause a Postgres error: "missing FROM-clause entry for table 'pv'". The fix is to use `pool` (exported from `@workspace/db`) and write the full SQL with the real table name.

**How to apply:** Any route in `artifacts/api-server/src/routes/products.ts` that groups products with variant price aggregation should use `pool.query()` directly. The helper function `queryProductCards(where, params, limit, offset)` encapsulates this pattern.
