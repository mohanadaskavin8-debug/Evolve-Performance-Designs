---
name: Clerk v6 compatibility
description: What changed in Clerk React v6 vs v5 and how to adapt
---

## Rule
`SignedIn` and `SignedOut` wrapper components do not exist in `@clerk/react` v6. Use `useUser()` hook and conditional rendering instead.

**Why:** These components were removed in v6. Importing them causes a runtime error: "Importing binding name 'SignedIn' is not found."

**How to apply:**
```tsx
// Before (v5)
import { SignedIn, SignedOut } from '@clerk/react';
// <SignedOut><SignIn /></SignedOut><SignedIn><Dashboard /></SignedIn>

// After (v6)
import { useUser } from '@clerk/react';
const { isSignedIn, isLoaded } = useUser();
if (!isLoaded) return null;
return isSignedIn ? <Dashboard /> : <SignIn routing="hash" />;
```

Also: remove `proxyUrl` from ClerkProvider in dev — the Clerk proxy only works for production instances and causes 404s in dev.
