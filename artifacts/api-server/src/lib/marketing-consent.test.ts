import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// tokenSecret() reads the env lazily (at call time), so setting it in the
// module body — which runs after import evaluation but before any test — is safe.
process.env.SESSION_SECRET ||= "test-secret-for-token-tests";

import { classifySignup } from "./consent";
import {
  makeUnsubscribeToken,
  verifyUnsubscribeToken,
  makeResubscribeToken,
  verifyResubscribeToken,
} from "./marketing-email";

// ── classifySignup: an unauthenticated signup must never restore revoked consent ──

test("clean new address subscribes normally", () => {
  assert.deepEqual(classifySignup({ existingStatus: null, suppressionReasons: [] }), { action: "subscribe" });
});

test("active subscriber re-signup is a normal subscribe (idempotent refresh)", () => {
  assert.deepEqual(classifySignup({ existingStatus: "active", suppressionReasons: [] }), { action: "subscribe" });
});

test("unsubscribe suppression forces double opt-in — signup alone cannot reactivate", () => {
  assert.deepEqual(
    classifySignup({ existingStatus: "active", suppressionReasons: ["unsubscribe"] }),
    { action: "confirm_required" },
  );
});

test("subscriber row marked unsubscribed forces double opt-in even without a suppression row", () => {
  assert.deepEqual(
    classifySignup({ existingStatus: "unsubscribed", suppressionReasons: [] }),
    { action: "confirm_required" },
  );
});

test("bounced address is blocked outright — not even a confirmation email", () => {
  assert.deepEqual(classifySignup({ existingStatus: null, suppressionReasons: ["bounce"] }), { action: "blocked" });
});

test("complaint outranks unsubscribe (blocked, no confirmation email)", () => {
  assert.deepEqual(
    classifySignup({ existingStatus: "unsubscribed", suppressionReasons: ["unsubscribe", "complaint"] }),
    { action: "blocked" },
  );
});

// ── token domain separation: unsubscribe and re-subscribe tokens must never cross ──

test("resubscribe token round-trips", () => {
  const token = makeResubscribeToken("Person@Example.COM");
  assert.deepEqual(verifyResubscribeToken(token), { email: "person@example.com" });
});

test("an unsubscribe token is NOT accepted as a re-subscribe confirmation", () => {
  const unsubToken = makeUnsubscribeToken("victim@example.com", 42);
  assert.equal(verifyResubscribeToken(unsubToken), null);
});

test("a re-subscribe token is NOT accepted as an unsubscribe token", () => {
  const resubToken = makeResubscribeToken("someone@example.com");
  assert.equal(verifyUnsubscribeToken(resubToken), null);
});

test("tampered re-subscribe payload is rejected", () => {
  const token = makeResubscribeToken("a@example.com");
  const [, sig] = token.split(".");
  const forgedPayload = Buffer.from(
    JSON.stringify({ e: "b@example.com", p: "resub", t: Date.now() }),
  ).toString("base64url");
  assert.equal(verifyResubscribeToken(`${forgedPayload}.${sig}`), null);
});

test("expired re-subscribe token (8 days old) is rejected", () => {
  const payload = Buffer.from(
    JSON.stringify({ e: "old@example.com", p: "resub", t: Date.now() - 8 * 24 * 60 * 60 * 1000 }),
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", process.env.SESSION_SECRET!)
    .update(`resub.${payload}`)
    .digest()
    .toString("base64url");
  assert.equal(verifyResubscribeToken(`${payload}.${sig}`), null);
});
