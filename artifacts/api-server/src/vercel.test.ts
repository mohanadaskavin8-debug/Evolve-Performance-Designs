import { test } from "node:test";
import assert from "node:assert/strict";
import { restoreApiUrl } from "./vercel";

test("rebuilds the path when Vercel passes the rewritten URL", () => {
  assert.equal(
    restoreApiUrl("/api?__ep_path=shop/products&limit=5"),
    "/api/shop/products?limit=5",
  );
});

test("rebuilds the path when Vercel passes the original URL plus the param", () => {
  assert.equal(
    restoreApiUrl("/api/shop/cart?cartId=gid%3A%2F%2Fshopify%2FCart%2Fabc%3Fkey%3D1&__ep_path=shop/cart"),
    "/api/shop/cart?cartId=gid%3A%2F%2Fshopify%2FCart%2Fabc%3Fkey%3D1",
  );
});

test("leaves URLs without the param untouched (local dev server)", () => {
  assert.equal(restoreApiUrl("/api/healthz"), "/api/healthz");
});

test("handles the bare /api path and re-encodes segments", () => {
  assert.equal(restoreApiUrl("/api?__ep_path="), "/api/");
  assert.equal(
    restoreApiUrl("/api?__ep_path=shop%2Fproducts%2Fnight%20ops"),
    "/api/shop/products/night%20ops",
  );
});
