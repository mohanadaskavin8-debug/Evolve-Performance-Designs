import { Router } from "express";
import { db } from "@workspace/db";
import { supportRequestsTable, ordersTable, customersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// POST /api/support/requests
router.post("/requests", async (req, res) => {
  try {
    const { email, name, subject, message, orderNumber, clerkUserId } = req.body;

    let orderId: number | null = null;
    let customerId: number | null = null;

    if (orderNumber) {
      const [order] = await db.select({ id: ordersTable.id }).from(ordersTable).where(eq(ordersTable.orderNumber, orderNumber));
      orderId = order?.id ?? null;
    }

    if (clerkUserId) {
      const [customer] = await db.select({ id: customersTable.id }).from(customersTable).where(eq(customersTable.clerkUserId, clerkUserId));
      customerId = customer?.id ?? null;
    }

    const [request] = await db.insert(supportRequestsTable).values({
      customerId,
      orderId,
      email,
      name,
      subject,
      message,
      status: "open",
      priority: "normal",
    }).returning();

    res.status(201).json({
      id: request.id,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Failed to submit support request" });
  }
});

export default router;
