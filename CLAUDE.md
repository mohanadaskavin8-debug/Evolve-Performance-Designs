@README.md

## Working on this project

- The owner is non-technical. Explain changes in plain language and show screenshots of visual changes (Playwright, with `?intro=0`).
- Preview locally with `pnpm dev` (http://localhost:5173). Before pushing, run `pnpm run typecheck` and, for build/hosting changes, `pnpm run build:vercel`.
- Production deploys happen automatically on Vercel when `main` changes — there is no manual deploy step.
- Never put the Shopify token in code, commits or chat; it lives in Vercel's environment variables.
