/**
 * Builds the whole site for Vercel (run by `pnpm run build:vercel`, which
 * vercel.json uses as the build command).
 *
 * Produces Vercel's Build Output API layout:
 *   .vercel/output/static/         storefront (Vite build)
 *   .vercel/output/functions/api.func/
 *                                  Express API bundle → handles /api/*
 *   .vercel/output/config.json     routing rules
 *
 * Docs: https://vercel.com/docs/build-output-api/v3
 */
import { spawnSync } from "node:child_process";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, ".vercel", "output");
const funcDir = path.join(out, "functions", "api.func");

// Re-use the pnpm that is running this script (vercel.json pins its version).
const pnpm = process.env.npm_execpath
  ? [process.execPath, process.env.npm_execpath]
  : ["pnpm"];

function run(cmd, args, env = {}) {
  console.log(`\n▶ ${[cmd, ...args].join(" ")}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${[cmd, ...args].join(" ")}`);
  }
}

const runPnpm = (args, env) => run(pnpm[0], [...pnpm.slice(1), ...args], env);

await rm(out, { recursive: true, force: true });

// 1. Type-check everything first — a failed check stops the deploy and the
//    previous version stays live.
runPnpm(["run", "typecheck"]);

// 2. Storefront → static files.
runPnpm(["--filter", "@workspace/storefront", "run", "build"], {
  NODE_ENV: "production",
  BASE_PATH: "/",
});
await cp(path.join(root, "artifacts/storefront/dist/public"), path.join(out, "static"), {
  recursive: true,
});

// 3. API → one serverless function (single bundled file, no node_modules needed).
run(process.execPath, [path.join(root, "artifacts/api-server/build.mjs"), "--vercel", funcDir]);
const nodeMajor = process.versions.node.split(".")[0];
await writeFile(
  path.join(funcDir, ".vc-config.json"),
  JSON.stringify(
    {
      // Same Node version the build ran on, which is the one set in Vercel.
      runtime: `nodejs${nodeMajor}.x`,
      handler: "index.mjs",
      launcherType: "Nodejs",
      // Express parses the request body itself.
      shouldAddHelpers: false,
    },
    null,
    2,
  ),
);

// 4. Routing: /api/* → function, real files as-is, everything else → the
//    single-page app (so deep links like /products/night-ops work).
await mkdir(out, { recursive: true });
await writeFile(
  path.join(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        // The sub-path travels in a query param; src/vercel.ts restores it.
        { src: "^/api(?:/(.*))?$", dest: "/api?__ep_path=$1" },
        {
          src: "^/assets/(.*)$",
          headers: { "cache-control": "public, max-age=31536000, immutable" },
          continue: true,
        },
        { handle: "filesystem" },
        { src: "^/(.*)$", dest: "/index.html" },
      ],
    },
    null,
    2,
  ),
);

console.log("\n✓ Vercel build output ready in .vercel/output");
