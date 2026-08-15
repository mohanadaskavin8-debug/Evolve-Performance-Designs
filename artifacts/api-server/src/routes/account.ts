import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  customersTable, addressesTable, returnsTable, returnItemsTable, ordersTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

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
  res.json({ ...customer, createdAt: customer.createdAt.toISOString() });
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
  const { name, line1, line2, city, state, postalCode, countryCode, isDefault } = req.body;

  if (isDefault) {
    await db.update(addressesTable).set({ isDefault: false }).where(eq(addressesTable.customerId, customerId));
  }

  const [address] = await db.insert(addressesTable).values({
    customerId, name, line1, line2, city, state, postalCode, countryCode,
    isDefault: isDefault ?? false,
  }).returning();

  res.status(201).json(address);
});

// DELETE /api/account/addresses/:addressId
router.delete("/addresses/:addressId", async (req, res) => {
  const customerId = await requireCustomer(req, res);
  if (!customerId) return;
  await db.delete(addressesTable).where(eq(addressesTable.id, Number(req.params.addressId)));
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
  const [ret] = await db.insert(returnsTable).values({
    orderId, customerId, reason, preferExchange: preferExchange ?? false, status: "requested",
  }).returning();

  for (const item of items ?? []) {
    await db.insert(returnItemsTable).values({ returnId: ret.id, orderItemId: item.orderItemId, quantity: item.quantity, reason: item.reason, notes: item.notes });
  }

  const [order] = await db.select({ orderNumber: ordersTable.orderNumber }).from(ordersTable).where(eq(ordersTable.id, orderId));
  res.status(201).json({ id: ret.id, orderNumber: order?.orderNumber ?? "", status: ret.status, reason: ret.reason, items: items ?? [], createdAt: ret.createdAt.toISOString() });
});

export default router;
