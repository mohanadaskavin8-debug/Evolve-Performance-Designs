---
name: Express noImplicitReturns override
description: Express route handlers trigger TS7030 with noImplicitReturns:true; override to false in api-server tsconfig.
---

# Express noImplicitReturns Override

The tsconfig.base.json has `"noImplicitReturns": true`. Express async route handlers use the idiom `return res.json({...})` to exit early — this returns a non-void value in some code paths and void in others, triggering TS7030.

**Why:** Express handlers are typed as `(req, res) => void`, but `res.json()` returns a `Response` object. With `noImplicitReturns: true`, TypeScript requires all paths to either always return a value or never return one.

**How to apply:** `artifacts/api-server/tsconfig.json` must include `"noImplicitReturns": false` to override the base config. This is intentional and correct for Express-style code.
