import { Router } from "express";
import Stripe from "stripe";
import { db, pool } from "@workspace/db";
import {
  ordersTable, orderItemsTable, cartItemsTable,
  productVariantsTable, inventoryTransactionsTable,
  customersTable, inventoryReservationsTable, productsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.post("/", async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(200).json({ received: true }); // graceful dev fallback
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-04-30.basil" as any });
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return res.status(400).json({ error: "Webhook signature verification failed" });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const cartSessionId = session.metadata?.sessionId;
    if (!cartSessionId) return res.json({ received: true });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Idempotency guard: skip if this session was already processed
      const { rows: existing } = await client.query(
        `SELECT id FROM orders WHERE stripe_session_id = $1 LIMIT 1`,
        [session.id],
      );
      if (existing.length > 0) {
        await client.query("ROLLBACK");
        return res.json({ received: true });
      }

      // Find or create customer
      const email = session.customer_details?.email ?? (session as any).customer_email ?? "";
      let customerId: number | null = null;
      if (email) {
        const { rows } = await client.query(
          `INSERT INTO customers (email, stripe_customer_id) VALUES ($1, $2)
           ON CONFLICT (email) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id
           RETURNING id`,
          [email, typeof session.customer === "string" ? session.customer : null],
        );
        customerId = rows[0]?.id ?? null;
      }

      // Generate order number
      const orderNum = `EP-${Date.now().toString(36).toUpperCase()}`;
      const sessionAny = session as any;
      const shippingDetails = sessionAny.shipping_details ?? sessionAny.shipping ?? null;
      const addr = shippingDetails?.address ?? null;
      const shippingAddress = addr ? {
        name: shippingDetails?.name ?? "",
        line1: addr.line1 ?? "",
        line2: addr.line2 ?? null,
        city: addr.city ?? "",
        state: addr.state ?? null,
        postalCode: addr.postal_code ?? null,
        countryCode: addr.country ?? "",
      } : null;

      const { rows: orderRows } = await client.query(
        `INSERT INTO orders (order_number, customer_id, guest_email, status, subtotal_in_cents, shipping_in_cents, tax_in_cents, total_in_cents, currency, shipping_address, stripe_session_id, stripe_payment_intent_id)
         VALUES ($1,$2,$3,'paid',$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [
          orderNum, customerId, customerId ? null : email,
          session.amount_subtotal ?? 0,
          0,
          session.total_details?.amount_tax ?? 0,
          session.amount_total ?? 0,
          session.currency?.toUpperCase() ?? "USD",
          JSON.stringify(shippingAddress),
          session.id,
          typeof session.payment_intent === "string" ? session.payment_intent : null,
        ],
      );
      const orderId = orderRows[0].id;

      // Get cart items and create order items
      const cartItems = await db.select({
        variantId: cartItemsTable.variantId,
        productId: cartItemsTable.productId,
        quantity: cartItemsTable.quantity,
      }).from(cartItemsTable).where(eq(cartItemsTable.sessionId, cartSessionId));

      for (const item of cartItems) {
        const [variant] = await db.select()
          .from(productVariantsTable)
          .where(eq(productVariantsTable.id, item.variantId));
        if (!variant) continue;

        const [product] = await db.select({ name: productsTable.name, slug: productsTable.slug })
          .from(productsTable)
          .where(eq(productsTable.id, item.productId));

        await client.query(
          `INSERT INTO order_items (order_id, variant_id, product_id, product_name, product_slug, variant_sku, size, color, quantity, unit_price_in_cents, total_price_in_cents)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            orderId, item.variantId, item.productId,
            product?.name ?? "Product", product?.slug ?? null,
            variant.sku, variant.size, variant.color,
            item.quantity, variant.priceInCents, variant.priceInCents * item.quantity,
          ],
        );

        // Commit reservation: reduce actual stock, clear reserved
        await client.query(
          `UPDATE product_variants SET stock_quantity = stock_quantity - $1, reserved_quantity = GREATEST(0, reserved_quantity - $1), updated_at = NOW() WHERE id = $2`,
          [item.quantity, item.variantId],
        );

        await client.query(
          `INSERT INTO inventory_transactions (variant_id, type, quantity, previous_stock, new_stock, reference_type, reference_id)
           VALUES ($1,'commit',$2,$3,$3 - $2,'order',$4)`,
          [item.variantId, item.quantity, variant.stockQuantity, String(orderId)],
        );
      }

      // Clear cart and commit
      await client.query(`DELETE FROM cart_items WHERE session_id = $1`, [cartSessionId]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("Webhook order create failed:", e);
      return res.status(500).json({ error: "Order fulfillment failed" });
    } finally {
      client.release();
    }
  }

  res.json({ received: true });
});

export default router;
