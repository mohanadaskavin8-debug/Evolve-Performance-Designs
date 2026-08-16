import { Router } from "express";
import Stripe from "stripe";
import { db, pool } from "@workspace/db";
import {
  cartItemsTable, productVariantsTable, productsTable,
  discountsTable, shippingZonesTable, shippingRatesTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import * as shipstation from "../lib/shipstation";
import { ALLOWED_COUNTRIES, quoteDestination } from "../lib/shipping-destination";

const router = Router();

function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-04-30.basil" as any });
}

// POST /api/checkout/shipping-rates
const LIVE_RATE_DEADLINE_MS = 5_000;

async function cartWeightGrams(sessionId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(COALESCE(p.weight_grams, 250) * ci.quantity), 0) AS grams
     FROM cart_items ci LEFT JOIN products p ON p.id = ci.product_id
     WHERE ci.session_id = $1`,
    [sessionId],
  );
  return parseInt(rows[0]?.grams ?? "0");
}

async function cartSubtotalCents(sessionId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(pv.price_in_cents * ci.quantity), 0) AS cents
     FROM cart_items ci JOIN product_variants pv ON pv.id = ci.variant_id
     WHERE ci.session_id = $1`,
    [sessionId],
  );
  return parseInt(rows[0]?.cents ?? "0");
}

async function zoneForCountry(countryCode: string) {
  const zones = await db
    .select()
    .from(shippingZonesTable)
    .where(eq(shippingZonesTable.active, true));
  return (
    zones.find((z) => z.countries.includes(countryCode) || z.countries.includes("*")) ??
    zones.find((z) => z.name.toLowerCase().includes("world")) ??
    null
  );
}

/**
 * Live-quote a single carrier-calculated rate for a cart. Returns cents, or
 * null on ANY failure (bounded by LIVE_RATE_DEADLINE_MS) — callers fall back
 * to the rate's stored flat price so checkout is never blocked by ShipStation.
 */
async function liveRateQuote(
  carrierCode: string,
  serviceCode: string,
  sessionId: string,
  countryCode: string,
  postalCode: string | null,
): Promise<number | null> {
  const dest = quoteDestination(countryCode, postalCode);
  if (!dest) return null;
  try {
    return await Promise.race([
      (async () => {
        const grams = await cartWeightGrams(sessionId);
        if (grams <= 0) return null;
        const quotes = await shipstation.getCarrierRates({
          carrierCode,
          // Carriers rate on origin/destination postal + weight; street line is
          // not used for rating, so a placeholder is fine — but the postal code
          // and country must be the customer's real destination.
          shipTo: { name: "Rate Quote", line1: "Rate Quote", city: "", state: null, postalCode: dest.postalCode, countryCode: dest.countryCode },
          weightGrams: grams,
        });
        return quotes.find((q) => q.serviceCode === serviceCode)?.amountCents ?? null;
      })(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), LIVE_RATE_DEADLINE_MS)),
    ]);
  } catch {
    return null;
  }
}

router.post("/shipping-rates", async (req, res) => {
  const { countryCode, sessionId, postalCode } = req.body;
  try {
    const matchingZone = await zoneForCountry(countryCode);
    if (!matchingZone) return res.json([]);

    const allRates = await db
      .select()
      .from(shippingRatesTable)
      .where(and(eq(shippingRatesTable.zoneId, matchingZone.id), eq(shippingRatesTable.active, true)));

    // Enforce per-rate order minimums server-side (e.g. "Free shipping on
    // $75+"): ineligible rates are never offered here, and /session rejects
    // them if a client submits one anyway.
    const subtotal = sessionId ? await cartSubtotalCents(sessionId) : 0;
    const rates = allRates.filter((r) => !r.minimumOrderInCents || subtotal >= r.minimumOrderInCents);

    // Live carrier quotes for "calculated" rates — only with a real destination
    // (postal code, or a no-postal country); we never quote carriers against a
    // fabricated address. Best-effort with a hard deadline; ANY failure falls
    // back to the stored flat price so checkout is never blocked by ShipStation.
    const liveByService = new Map<string, number>();
    const calculated = rates.filter((r) => r.rateType === "calculated" && r.carrierCode && r.serviceCode);
    const dest = quoteDestination(countryCode, postalCode);
    if (calculated.length && sessionId && dest) {
      try {
        await Promise.race([
          (async () => {
            const grams = await cartWeightGrams(sessionId);
            if (grams <= 0) return;
            const carriers = [...new Set(calculated.map((r) => r.carrierCode!))];
            await Promise.all(carriers.map(async (carrierCode) => {
              const quotes = await shipstation.getCarrierRates({
                carrierCode,
                shipTo: { name: "Rate Quote", line1: "Rate Quote", city: "", state: null, postalCode: dest.postalCode, countryCode: dest.countryCode },
                weightGrams: grams,
              });
              for (const q of quotes) liveByService.set(`${carrierCode}:${q.serviceCode}`, q.amountCents);
            }));
          })(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("live rate deadline")), LIVE_RATE_DEADLINE_MS)),
        ]);
      } catch {
        // fall through with flat prices
      }
    }

    res.json(rates.map(r => {
      const liveKey = `${r.carrierCode}:${r.serviceCode}`;
      const live = r.rateType === "calculated" && r.carrierCode && r.serviceCode ? liveByService.get(liveKey) : undefined;
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        priceInCents: live ?? r.priceInCents,
        estimatedDays: r.estimatedDays,
      };
    }));
  } catch {
    res.status(500).json({ error: "Failed to query shipping rates" });
  }
});

// POST /api/checkout/validate-discount
router.post("/validate-discount", async (req, res) => {
  const { code, sessionId } = req.body;
  try {
    const [discount] = await db
      .select()
      .from(discountsTable)
      .where(and(eq(discountsTable.code, code.toUpperCase()), eq(discountsTable.active, true)));

    if (!discount) return res.json({ valid: false, code, error: "Invalid or expired discount code" });
    if (discount.expiresAt && discount.expiresAt < new Date()) return res.json({ valid: false, code, error: "Discount code expired" });
    if (discount.maxUses && discount.usedCount >= discount.maxUses) return res.json({ valid: false, code, error: "Discount code exhausted" });

    res.json({
      valid: true,
      code: discount.code,
      discountType: discount.discountType,
      value: discount.value,
      discountInCents: null,
    });
  } catch {
    res.status(500).json({ error: "Failed to validate discount" });
  }
});

// POST /api/checkout/session
router.post("/session", async (req, res) => {
  const { sessionId, clerkUserId, customerEmail, discountCode, shippingZoneRateId, countryCode, postalCode } = req.body;

  // Derive redirect URLs server-side from a trusted origin — never accept from client
  const storefrontOrigin = process.env.STOREFRONT_ORIGIN
    || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null)
    || "http://localhost:5173";
  const basePath = process.env.STOREFRONT_BASE_PATH ?? "";
  const successUrl = `${storefrontOrigin}${basePath}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${storefrontOrigin}${basePath}/cart`;

  try {
    const items = await db
      .select({
        variantId: cartItemsTable.variantId,
        productName: productsTable.name,
        variantSku: productVariantsTable.sku,
        quantity: cartItemsTable.quantity,
        priceInCents: productVariantsTable.priceInCents,
        imageUrl: sql<string | null>`(SELECT url FROM product_images pi WHERE pi.product_id = ${productsTable.id} AND pi.is_primary = true LIMIT 1)`,
      })
      .from(cartItemsTable)
      .innerJoin(productVariantsTable, eq(productVariantsTable.id, cartItemsTable.variantId))
      .innerJoin(productsTable, eq(productsTable.id, cartItemsTable.productId))
      .where(eq(cartItemsTable.sessionId, sessionId));

    if (!items.length) return res.status(400).json({ error: "Cart is empty" });
    const subtotalInCents = items.reduce((s, i) => s + i.priceInCents * i.quantity, 0);

    // ── Server-side shipping validation ────────────────────────────────────
    // Never trust the client's rate id, price, or destination: the destination
    // must be one we ship to, the rate must exist, be active, belong to the
    // zone covering that destination, and satisfy its order minimum. The
    // Stripe session then pins address collection to the validated country so
    // the customer can't quote one destination and ship to another.
    const destCountry = typeof countryCode === "string" ? countryCode.trim().toUpperCase() : "";
    if (!ALLOWED_COUNTRIES.includes(destCountry)) {
      return res.status(400).json({ error: "Select a shipping destination" });
    }

    const zone = await zoneForCountry(destCountry);
    const zoneRates = zone
      ? await db
          .select()
          .from(shippingRatesTable)
          .where(and(eq(shippingRatesTable.zoneId, zone.id), eq(shippingRatesTable.active, true)))
      : [];
    const eligibleRates = zoneRates.filter((r) => !r.minimumOrderInCents || subtotalInCents >= r.minimumOrderInCents);

    let shippingRate: { priceInCents: number; name: string; estimatedDays: string } | null = null;
    if (eligibleRates.length > 0 && shippingZoneRateId == null) {
      return res.status(400).json({ error: "Select a shipping option" });
    }
    if (shippingZoneRateId != null) {
      const rate = eligibleRates.find((r) => r.id === shippingZoneRateId);
      if (!rate) {
        return res.status(400).json({ error: "That shipping option is not available for this destination" });
      }
      let priceInCents = rate.priceInCents;
      // Carrier-calculated rates are re-quoted live at session time with the
      // real destination (country + postal), so the amount actually charged
      // matches the carrier's price. Any failure falls back to the stored
      // flat price; checkout is never blocked by ShipStation.
      if (rate.rateType === "calculated" && rate.carrierCode && rate.serviceCode) {
        const live = await liveRateQuote(rate.carrierCode, rate.serviceCode, sessionId, destCountry, typeof postalCode === "string" ? postalCode : null);
        if (live != null) priceInCents = live;
      }
      shippingRate = { priceInCents, name: rate.name, estimatedDays: rate.estimatedDays };
    }

    const stripe = getStripe();
    if (!stripe) return res.status(503).json({ error: "Payment processing unavailable" });

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(item => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.productName,
          ...(item.imageUrl ? { images: [item.imageUrl] } : {}),
        },
        unit_amount: item.priceInCents,
      },
      quantity: item.quantity,
    }));

    const shippingInCents = shippingRate?.priceInCents ?? 0;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      automatic_tax: { enabled: true },
      // Pin address collection to the validated destination: the customer
      // cannot select a rate quoted for one country and ship to another.
      shipping_address_collection: { allowed_countries: [destCountry] as any[] },
      // Shipping is a real Stripe shipping option (not a line item), so
      // amount_subtotal stays product-only and total_details.amount_shipping
      // carries the shipping charge for accurate order bookkeeping.
      ...(shippingRate
        ? {
            shipping_options: [{
              shipping_rate_data: {
                display_name: shippingRate.name,
                type: "fixed_amount" as const,
                fixed_amount: { amount: shippingRate.priceInCents, currency: "usd" },
              },
            }],
          }
        : {}),
      metadata: {
        sessionId,
        clerkUserId: clerkUserId ?? "",
        discountCode: discountCode ?? "",
        quotedCountry: destCountry,
        quotedPostal: typeof postalCode === "string" ? postalCode.trim() : "",
        quotedRateId: shippingZoneRateId != null ? String(shippingZoneRateId) : "",
      },
    };

    if (customerEmail) sessionParams.customer_email = customerEmail;

    const stripeSession = await stripe.checkout.sessions.create(sessionParams);

    res.json({
      checkoutUrl: stripeSession.url,
      subtotalInCents,
      shippingInCents,
      taxInCents: 0,
      discountInCents: 0,
      totalInCents: subtotalInCents + shippingInCents,
    });
    return;
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

export default router;
