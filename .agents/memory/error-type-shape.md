---
name: ErrorType is ApiError shape
description: ErrorType<T> = ApiError<T> with .data/.status/.message, not .error; accessing .error causes TS errors.
---

# ErrorType / ApiError Shape

The generated Orval client uses `ErrorType<T> = ApiError<T>` from `lib/api-client-react/src/custom-fetch.ts`.

`ApiError<T>` has: `.data: T | null`, `.status: number`, `.statusText: string`, `.message: string` (inherited from Error), `.headers`, `.response`.

It does NOT have `.error`. When the backend returns `{ error: "..." }`, that string is in `err.data.error`.

**How to apply:** Replace `err.error` → `(err.data as any)?.error || err.message`. This pattern appears in Cart.tsx, ProductDetail.tsx, Support.tsx, AccountReturnsNew.tsx.
