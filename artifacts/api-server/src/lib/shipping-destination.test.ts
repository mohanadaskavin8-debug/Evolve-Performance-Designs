import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteDestination, normalizePostal, ALLOWED_COUNTRIES, NO_POSTAL_COUNTRIES } from "./shipping-destination";

test("AE (no-postal country) with no postal quotes with postalCode null — never a fabricated value", () => {
  for (const postal of [undefined, null, "", "   "]) {
    const dest = quoteDestination("AE", postal);
    assert.ok(dest, `AE should be quotable with postal=${JSON.stringify(postal)}`);
    assert.equal(dest!.postalCode, null);
  }
});

test("postal-code countries do NOT live-quote until a real postal is supplied (fallback pricing)", () => {
  for (const country of ALLOWED_COUNTRIES.filter((c) => !NO_POSTAL_COUNTRIES.has(c))) {
    assert.equal(quoteDestination(country, undefined), null);
    assert.equal(quoteDestination(country, null), null);
    assert.equal(quoteDestination(country, "   "), null);
  }
});

test("postal-code countries quote with the trimmed real postal", () => {
  assert.deepEqual(quoteDestination("US", " 10001 "), { countryCode: "US", postalCode: "10001" });
  assert.deepEqual(quoteDestination("gb", "SW1A 1AA"), { countryCode: "GB", postalCode: "SW1A 1AA" });
});

test("unknown or non-string destinations are never quotable", () => {
  assert.equal(quoteDestination("XX", "10001"), null);
  assert.equal(quoteDestination(undefined, "10001"), null);
  assert.equal(quoteDestination(42, "10001"), null);
});

test("normalizePostal never yields the string 'undefined' or blank values", () => {
  assert.equal(normalizePostal(undefined), null);
  assert.equal(normalizePostal(null), null);
  assert.equal(normalizePostal("  "), null);
  assert.equal(normalizePostal(123), null);
  assert.equal(normalizePostal(" 90210 "), "90210");
});
