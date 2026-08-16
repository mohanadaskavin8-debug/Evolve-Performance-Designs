---
name: Drizzle ANY() array bug
description: JS arrays interpolated into drizzle sql`` templates become row constructors, not Postgres arrays
---

Rule: In Drizzle, never write ``sql`${col} = ANY(${jsArray})` `` — drizzle expands the array to `($1, $2, $3)` (a row constructor), and Postgres fails with `op ANY/ALL (array) requires array on right side` (code 42809). Use `inArray(col, jsArray)` instead.

**Why:** Hit this in the fulfillment engine: queries typechecked fine but failed at runtime on every tick. Raw `pool.query("… = ANY($1)", [jsArray])` is fine because node-pg serializes a real array parameter.

**How to apply:** Any status-set / id-set filter in a Drizzle query builder chain → `inArray()`. Only use `= ANY($1)` in raw pool.query strings.
