import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  ordersTable, orderItemsTable, shipmentsTable,
  customersTable, returnsTable, returnItemsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

// GET /api/orders/lookup — public lookup by order number + email
router.get("/lookup", async (req, res) => {
  const { orderNumber, email } = req.query as { orderNumber?: string; email?: string };
  if (!orderNumber || !email) return res.status(400).json({ error: "orderNumber and email required" });

  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.orderNumber, orderNumber));
    if (!order) return res.status(404).json({ error: "Order not found" });

    const orderEmail = order.guestEmail ?? (await db.select({ email: customersTable.email }).from(customersTable).where(eq(customersTable.id, order.customerId!)))[0]?.email;
    if (!orderEmail || orderEmail.toLowerCase() !== email.toLowerCase()) return res.status(404).json({ error: "Order not found" });

    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
    const [shipment] = await db.select().from(shipmentsTable).where(eq(shipmentsTable.orderId, order.id)).orderBy(desc(shipmentsTable.createdAt));

    res.json({
      ...order,
      items,
      trackingNumber: shipment?.trackingNumber ?? null,
      carrier: shipment?.carrier ?? null,
      trackingUrl: shipment?.trackingUrl ?? null,
      estimatedDelivery: shipment?.estimatedDelivery ?? null,
      shippingAddress: order.shippingAddress,
      requiresManualReview: order.requiresManualReview,
    });
  } catch {
    res.status(500).json({ error: "Failed to look up order" });
  }
});

// GET /api/account/orders — authenticated
router.get("/account/orders", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.clerkUserId, userId));
    if (!customer) return res.json([]);

    const orders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.customerId, customer.id))
      .orderBy(desc(ordersTable.createdAt))
      .limit(Number(req.query.limit) || 20)
      .offset(Number(req.query.offset) || 0);

    const result = await Promise.all(
      orders.map(async (o) => {
        const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, o.id));
        const [shipment] = await db.select().from(shipmentsTable).where(eq(shipmentsTable.orderId, o.id)).orderBy(desc(shipmentsTable.createdAt));
        return {
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          totalInCents: o.totalInCents,
          currency: o.currency,
          itemCount: items.reduce((s, i) => s + i.quantity, 0),
          trackingNumber: shipment?.trackingNumber ?? null,
          carrier: shipment?.carrier ?? null,
          createdAt: o.createdAt.toISOString(),
        };
      }),
    );

    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to load orders" });
  }
});

export default router;
