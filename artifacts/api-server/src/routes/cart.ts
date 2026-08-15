import { Router } from "express";
import { db, pool } from "@workspace/db";
import {
  cartItemsTable, productVariantsTable, productsTable,
  productImagesTable, inventoryReservationsTable, inventoryTransactionsTable
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

async function buildCart(sessionId: string) {
  const items = await db
    .select({
      id: cartItemsTable.id,
      variantId: cartItemsTable.variantId,
      productId: cartItemsTable.productId,
      productSlug: productsTable.slug,
      productName: productsTable.name,
      variantSku: productVariantsTable.sku,
      size: productVariantsTable.size,
      color: productVariantsTable.color,
      priceInCents: productVariantsTable.priceInCents,
      quantity: cartItemsTable.quantity,
      imageUrl: sql<string | null>`(
        SELECT url FROM product_images pi WHERE pi.product_id = ${productsTable.id} AND pi.is_primary = true LIMIT 1
      )`,
    })
    .from(cartItemsTable)
    .innerJoin(productVariantsTable, eq(productVariantsTable.id, cartItemsTable.variantId))
    .innerJoin(productsTable, eq(productsTable.id, cartItemsTable.productId))
    .where(eq(cartItemsTable.sessionId, sessionId));

  const subtotalInCents = items.reduce((s, i) => s + i.priceInCents * i.quantity, 0);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  return {
    sessionId,
    items: items.map(i => ({ ...i, id: String(i.id) })),
    subtotalInCents,
    itemCount,
  };
}

// GET /api/cart
router.get("/", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });
  try {
    res.json(await buildCart(sessionId));
  } catch {
    res.status(500).json({ error: "Failed to load cart" });
  }
});

// POST /api/cart/items
router.post("/items", async (req, res) => {
  const { sessionId, variantId, quantity, clerkUserId } = req.body;
  if (!sessionId || !variantId || !quantity) return res.status(400).json({ error: "Missing fields" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock variant row for update
    const { rows } = await client.query(
      `SELECT id, product_id, stock_quantity, reserved_quantity, price_in_cents FROM product_variants WHERE id = $1 FOR UPDATE`,
      [variantId],
    );
    if (!rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Variant not found" }); }

    const variant = rows[0];
    const available = variant.stock_quantity - variant.reserved_quantity;
    if (available < quantity) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Insufficient stock", available });
    }

    // Expire reservation in 30 min
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const { rows: resRows } = await client.query(
      `INSERT INTO inventory_reservations (variant_id, cart_session_id, quantity, expires_at) VALUES ($1, $2, $3, $4) RETURNING id`,
      [variantId, sessionId, quantity, expiresAt],
    );

    // Update reserved quantity
    await client.query(
      `UPDATE product_variants SET reserved_quantity = reserved_quantity + $1, updated_at = NOW() WHERE id = $2`,
      [quantity, variantId],
    );

    // Log transaction
    await client.query(
      `INSERT INTO inventory_transactions (variant_id, type, quantity, previous_stock, new_stock, reference_type, reference_id) VALUES ($1, 'reserve', $2, $3, $3, 'cart', $4)`,
      [variantId, quantity, variant.stock_quantity, sessionId],
    );

    // Upsert cart item
    await client.query(
      `INSERT INTO cart_items (session_id, clerk_user_id, variant_id, product_id, quantity, reservation_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [sessionId, clerkUserId || null, variantId, variant.product_id, quantity, resRows[0].id],
    );

    await client.query("COMMIT");
    res.json(await buildCart(sessionId));
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ error: "Failed to add item" });
  } finally {
    client.release();
  }
});

// PATCH /api/cart/items/:itemId
router.patch("/items/:itemId", async (req, res) => {
  const { quantity, sessionId } = req.body;
  const itemId = Number(req.params.itemId);

  try {
    const [item] = await db.select().from(cartItemsTable).where(eq(cartItemsTable.id, itemId));
    if (!item) return res.status(404).json({ error: "Item not found" });

    const diff = quantity - item.quantity;
    if (diff !== 0) {
      // Update reservation
      await db
        .update(productVariantsTable)
        .set({ reservedQuantity: sql`reserved_quantity + ${diff}` })
        .where(eq(productVariantsTable.id, item.variantId));
    }
    await db.update(cartItemsTable).set({ quantity, updatedAt: new Date() }).where(eq(cartItemsTable.id, itemId));

    res.json(await buildCart(item.sessionId));
  } catch {
    res.status(500).json({ error: "Failed to update item" });
  }
});

// DELETE /api/cart/items/:itemId
router.delete("/items/:itemId", async (req, res) => {
  const itemId = Number(req.params.itemId);
  try {
    const [item] = await db.select().from(cartItemsTable).where(eq(cartItemsTable.id, itemId));
    if (!item) return res.status(404).json({ error: "Item not found" });

    const sessionId = item.sessionId;
    // Release reservation
    await db
      .update(productVariantsTable)
      .set({ reservedQuantity: sql`GREATEST(0, reserved_quantity - ${item.quantity})` })
      .where(eq(productVariantsTable.id, item.variantId));

    await db.delete(cartItemsTable).where(eq(cartItemsTable.id, itemId));
    res.json(await buildCart(sessionId));
  } catch {
    res.status(500).json({ error: "Failed to remove item" });
  }
});

// POST /api/cart/clear
router.post("/clear", async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });

  try {
    const items = await db.select().from(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
    for (const item of items) {
      await db
        .update(productVariantsTable)
        .set({ reservedQuantity: sql`GREATEST(0, reserved_quantity - ${item.quantity})` })
        .where(eq(productVariantsTable.id, item.variantId));
    }
    await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
    res.json(await buildCart(sessionId));
  } catch {
    res.status(500).json({ error: "Failed to clear cart" });
  }
});

export default router;
