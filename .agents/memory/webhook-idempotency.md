---
name: Stripe webhook idempotency
description: Stripe retries webhooks on non-2xx responses; must guard against duplicate order creation with stripe_session_id.
---

# Stripe Webhook Idempotency

The `checkout.session.completed` webhook must be idempotent. Stripe retries if it doesn't receive a 2xx response within ~30 seconds.

**Guard pattern:**
1. Before any DB writes, query `SELECT id FROM orders WHERE stripe_session_id = $1`. If found, commit/rollback and return 200 immediately.
2. In the catch block, `ROLLBACK` and return `res.status(500).json(...)`. Do NOT return 200 on failure — Stripe must retry.
3. Use a database transaction wrapping all order creation, inventory deduction, and cart clearing.

**Why:** Without the guard, a Stripe retry (or a duplicate event) creates a duplicate order and double-decrements inventory. Without the 500 return on failure, Stripe assumes success and abandons retries, leaving the order unfulfilled.

**Relevant file:** `artifacts/api-server/src/routes/webhook.ts`
