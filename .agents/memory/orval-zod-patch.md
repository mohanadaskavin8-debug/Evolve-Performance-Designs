---
name: Orval Zod patch script
description: patch-generated-zod.mjs rewrites Zod v4 API calls to v3 post-codegen; must run after every orval generate.
---

# Orval Zod Patch Script

`lib/api-client-react/patch-generated-zod.mjs` must run after `orval generate` to rewrite Zod v4 API calls to v3 equivalents in the generated files.

**Why:** Orval generates code targeting Zod v4 syntax, but the project uses Zod v3. Without the patch, the generated validators throw at runtime.

**How to apply:** The `generate` script in `lib/api-client-react/package.json` should chain `orval` with `node patch-generated-zod.mjs`. Whenever the OpenAPI spec changes and codegen is re-run, the patch must also run.
