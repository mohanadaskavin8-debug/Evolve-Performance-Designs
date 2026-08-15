#!/usr/bin/env node
/**
 * Post-processes Orval-generated Zod schema files to replace Zod v4 API calls
 * with Zod v3 equivalents. Orval v8.23+ generates v4 syntax; this script makes
 * the output compatible with the workspace's Zod v3 install.
 *
 * Transformations:
 *   zod.int()        → zod.number().int()
 *   zod.email()      → zod.string().email()
 *   zod.looseObject( → zod.object(
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(__dirname, "..", "..");
const generated = resolve(root, "lib", "api-zod", "src", "generated", "api.ts");

let content = readFileSync(generated, "utf8");
const before = content;

// zod.int() → zod.number().int()
content = content.replaceAll("zod.int()", "zod.number().int()");
// zod.email() → zod.string().email()
content = content.replaceAll("zod.email()", "zod.string().email()");
// zod.looseObject( → zod.object(
content = content.replaceAll("zod.looseObject(", "zod.object(");

if (content !== before) {
  writeFileSync(generated, content, "utf8");
  console.log("✓ Patched api-zod/src/generated/api.ts for Zod v3 compatibility");
} else {
  console.log("✓ api-zod/src/generated/api.ts — no patches needed");
}
