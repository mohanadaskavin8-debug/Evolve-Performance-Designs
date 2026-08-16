import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  customersTable, addressesTable, returnsTable, returnItemsTable,
  ordersTable, orderItemsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

async function requireCustomer(req: any, res: any): Promise<number | null> {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  const [c] = await db.select().from(customersTable).where(eq(customersTable.clerkUserId, userId));
  if (!c) { res.status(404).json({ error: "Customer not found" }); return null; }
  return c.id;
}

// GET /api/account/profile
router.get("/profile", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.clerkUserId, userId));
  if (!customer) return res.status(404).json({ error: "Customer not found" });

  res.json({
    id: customer.id,
    clerkUserId: customer.clerkUserId,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    marketingConsent: customer.marketingConsent,
    createdAt: customer.createdAt.toISOString(),
  });
});

// PATCH /api/account/profile
router.patch("/profile", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { firstName, lastName, phone, marketingConsent } = req.body;
  const [customer] = await db
    .update(customersTable)
    .set({ firstName, lastName, phone, marketingConsent, updatedAt: new Date() })
    .where(eq(customersTable.clerkUserId, userId))
    .returning();

  if (!customer) return res.status(404).json({ error: "Customer not found" });

  res.json({
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    marketingConsent: customer.marketingConsent,
  });
});

// GET /api/account/addresses
router.get("/addresses", async (req, res) => {
  const customerId = await requireCustomer(req, res);
  if (!customerId) return;

  const addresses = await db.select().from(addressesTable).where(eq(addressesTable.customerId, customerId));
  res.json(addresses);
});

// POST /api/account/addresses
router.post("/addresses", async (req, res) => {
  const customerId = await requireCustomer(req, res);
  if (!customerId) return;

  const [address] = await db.insert(addressesTable).values({
    ...req.body, customerId,
  }).returning();

  res.status(201).json(address);
});

// DELETE /api/account/addresses/:addressId
router.delete("/addresses/:addressId", async (req, res) => {
  const customerId = await requireCustomer(req, res);
  if (!customerId) return;
  // Ownership check: only delete if address belongs to this customer
  const [deleted] = await db
    .delete(addressesTable)
    .where(and(eq(addressesTable.id, Number(req.params.addressId)), eq(addressesTable.customerId, customerId)))
    .returning({ id: addressesTable.id });
  if (!deleted) { res.status(404).json({ error: "Address not found" }); return; }
  res.status(204).end();
});

// GET /api/account/returns
router.get("/returns", async (req, res) => {
  const customerId = await requireCustomer(req, res);
  if (!customerId) return;

  const returns = await db.select().from(returnsTable)
    .where(eq(returnsTable.customerId, customerId))
    .orderBy(desc(returnsTable.createdAt));

  const result = await Promise.all(returns.map(async (r) => {
    const items = await db.select().from(returnItemsTable).where(eq(returnItemsTable.returnId, r.id));
    const [order] = await db.select({ orderNumber: ordersTable.orderNumber }).from(ordersTable).where(eq(ordersTable.id, r.orderId));
    return {
      id: r.id,
      orderNumber: order?.orderNumber ?? "",
      status: r.status,
      reason: r.reason,
      items,
      refundAmountInCents: r.refundAmountInCents,
      createdAt: r.createdAt.toISOString(),
    };
  }));

  res.json(result);
});

// POST /api/account/returns
router.post("/returns", async (req, res) => {
  const customerId = await requireCustomer(req, res);
  if (!customerId) return;

  const { orderId, items, reason, preferExchange } = req.body;

  // Ownership check: verify order belongs to this customer
  const [order] = await db
    .select({ id: ordersTable.id, orderNumber: ordersTable.orderNumber })
    .from(ordersTable)
    .where(and(eq(ordersTable.id, Number(orderId)), eq(ordersTable.customerId, customerId)));
  if (!order) { res.status(403).json({ error: "Order not found or does not belong to your account" }); return; }

  // Validate that every submitted orderItemId belongs to this specific order
  if (Array.isArray(items) && items.length > 0) {
    for (const item of items) {
      const [oi] = await db
        .select({ id: orderItemsTable.id })
        .from(orderItemsTable)
        .where(and(eq(orderItemsTable.id, Number(item.orderItemId)), eq(orderItemsTable.orderId, order.id)));
      if (!oi) {
        res.status(403).json({ error: `Order item ${item.orderItemId} does not belong to this order` });
        return;
      }
    }
  }

  const [ret] = await db.insert(returnsTable).values({
    orderId: order.id, customerId, reason, preferExchange: preferExchange ?? false, status: "requested",
  }).returning();

  for (const item of items ?? []) {
    await db.insert(returnItemsTable).values({
      returnId: ret.id,
      orderItemId: item.orderItemId,
      quantity: item.quantity,
      reason: item.reason,
      notes: item.notes,
    });
  }

  res.status(201).json({
    id: ret.id,
    orderNumber: order.orderNumber,
    status: ret.status,
    reason: ret.reason,
    items: items ?? [],
    createdAt: ret.createdAt.toISOString(),
  });
});

// GET /api/account/orders/:id — returns order with items for authenticated customer
router.get("/orders/:id", async (req, res) => {
  const customerId = await requireCustomer(req, res);
  if (!customerId) return;

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.id, Number(req.params.id)), eq(ordersTable.customerId, customerId)));

  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));

  res.json({ ...order, items, createdAt: order.createdAt.toISOString() });
});

export default router;
