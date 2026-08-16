---
name: DB dist must be built
description: lib/db TypeScript project references require dist/*.d.ts to exist; run tsc in lib/db before api-server typecheck.
---

# DB dist must be built

`lib/db` has `composite: true` and `emitDeclarationOnly: true` in its tsconfig. The `artifacts/api-server/tsconfig.json` references it via project references.

When `lib/db/dist/` is missing or stale (e.g., `dist/schema/index.d.ts` contains only `export {}`), the api-server typecheck will fail with 90+ errors about missing exports from `@workspace/db`.

**Why:** TypeScript project references require compiled `.d.ts` files to exist in the referenced package's `outDir`.

**How to apply:** Run `cd lib/db && npx tsc -p tsconfig.json` whenever schema files change or after a fresh clone. The `dist/schema/index.d.ts` should export all tables after a successful build.
