---
name: Clerk v6 breaking changes
description: Props and components removed in Clerk v6; causes runtime 404s or TS errors if used.
---

# Clerk v6 Breaking Changes

- `afterSignInUrl` / `afterSignUpUrl` on `<ClerkProvider>` → **removed**. Use `fallbackRedirectUrl` or omit.
- `proxyUrl` on `<ClerkProvider>` → **removed** in v6. Using it causes 404s in dev because Clerk no longer proxies through the app in v6.
- `<SignedIn>` / `<SignedOut>` wrapper components → still exist but prefer `useUser()` with conditional rendering for fine-grained control inside pages.

**Why:** Clerk v6 is a major breaking release with a streamlined API surface.

**How to apply:** Always check `@clerk/clerk-react` version before using ClerkProvider props. In this project, all three patterns were removed and replaced with the correct v6 equivalents.
