---
name: Replit connectors proxy pattern
description: How server code calls connector APIs (ShipStation, Resend) via @replit/connectors-sdk
---

Rule: Server-side connector calls go through `new ReplitConnectors().proxy(slug, path, init)` created fresh per call (tokens expire). The return value behaves like a fetch Response but needs a single cast; keep that cast in ONE choke-point function per service (e.g. `ssFetch` in the ShipStation module) so SDK changes have one fix point.

**Why:** Casting at every call site scattered `as unknown as Response` through the codebase and made auth-error classification inconsistent; centralizing gave one place for timeouts, 401/403 → "not connected" classification, and retries.

**How to apply:** New connector integration in api-server → one module, one private fetch helper with the cast + timeout + typed errors; everything else in the module calls that helper. Never cache the client/connector instance.

**Proxy 404 = not connected:** the connectors proxy reports a missing/unbound connection as HTTP 404 with body `{"error":{"message":"No <connector> connection found for this customer"}}` — NOT 401/403. Treat 404 + /no .*connection (found|for)/i body as not-connected; let genuine API 404s (unknown resource) pass through as API errors. Health checks that only classify 401/403 will report "connected" against a dead proxy.
