---
name: API proxy setup
description: How the API server is reached from the storefront in dev vs prod
---

## Rule
Add a Vite dev proxy rule forwarding `/api` → `http://localhost:8080` in `artifacts/storefront/vite.config.ts`.

**Why:** In development, the Vite dev server runs on a different port than the API server (8080). Without a proxy, browser API calls go to the Vite server and fail. In production, Replit's path routing (artifact.toml: `paths = ["/api"]`) handles this automatically.

**How to apply:**
```ts
server: {
  proxy: {
    '/api': { target: 'http://localhost:8080', changeOrigin: true }
  }
}
```

Note: The Screenshot tool's headless browser can't reach the Clerk CDN or external resources — ERR_CONNECTION_CLOSED in screenshots is expected and harmless for actual users.
