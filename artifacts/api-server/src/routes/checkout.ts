import { Router } from "express";
import Stripe from "stripe";
import { db } from "@workspace/db";
import {
  cartItemsTable, productVariantsTable, productsTable,
  discountsTable, shippingZonesTable, shippingRatesTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-04-30.basil" as any });
}

// POST /api/checkout/shipping-rates
router.post("/shipping-rates", async (req, res) => {
  const { countryCode } = req.body;
  try {
    const zones = await db
      .select()
      .from(shippingZonesTable)
      .where(eq(shippingZonesTable.active, true));

    // Find matching zone (country in list or "Worldwide")
    const matchingZone = zones.find(z =>
      z.countries.includes(countryCode) || z.countries.includes("*")
    ) || zones.find(z => z.name.toLowerCase().includes("world"));

    if (!matchingZone) return res.json([]);

    const rates = await db
      .select()
      .from(shippingRatesTable)
      .where(and(eq(shippingRatesTable.zoneId, matchingZone.id), eq(shippingRatesTable.active, true)));

    res.json(rates.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      priceInCents: r.priceInCents,
      estimatedDays: r.estimatedDays,
    })));
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
  const { sessionId, clerkUserId, customerEmail, discountCode, shippingZoneRateId, successUrl, cancelUrl } = req.body;
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: "Payment processing unavailable" });

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

    let shippingRate: { priceInCents: number; name: string } | null = null;
    if (shippingZoneRateId) {
      const [rate] = await db.select().from(shippingRatesTable).where(eq(shippingRatesTable.id, shippingZoneRateId));
      if (rate) shippingRate = { priceInCents: rate.priceInCents, name: rate.name };
    }

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

    if (shippingRate && shippingRate.priceInCents > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: shippingRate.name },
          unit_amount: shippingRate.priceInCents,
        },
        quantity: 1,
      });
    }

    const subtotalInCents = items.reduce((s, i) => s + i.priceInCents * i.quantity, 0);
    const shippingInCents = shippingRate?.priceInCents ?? 0;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      automatic_tax: { enabled: true },
      shipping_address_collection: { allowed_countries: ["US", "CA", "GB", "AU", "DE", "FR", "JP", "SG", "AE"] as any[] },
      metadata: { sessionId, clerkUserId: clerkUserId ?? "", discountCode: discountCode ?? "" },
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
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

export default router;
