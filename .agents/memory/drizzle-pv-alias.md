---
name: Drizzle pv-alias SQL bug
description: Drizzle innerJoin uses full table name not short alias; raw SQL strings with pv. fail with Postgres error 42P01.
---

# Drizzle pv-alias SQL bug

When using Drizzle's `innerJoin(productVariantsTable, ...)`, Drizzle names the joined table `"product_variants"` (the full table name). Any raw `sql<>` template strings that reference `pv.price_in_cents` or similar short aliases will fail with Postgres error `42P01: missing FROM-clause entry for table "pv"`.

**Why:** Drizzle ORM does not support custom alias names on joins in the same way as raw SQL.

**How to apply:** For any route that needs GROUP BY aggregations over joined variant data (MIN price, MAX price, stock sums), rewrite the handler to use `pool.query()` with raw parametrized SQL using the `pv` alias explicitly in the FROM/JOIN clause. Affected routes: `products.ts`, `collections.ts`. Do not attempt Drizzle-style `sql<>` templates with short join aliases.
