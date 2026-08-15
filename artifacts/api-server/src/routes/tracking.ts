import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, shipmentsTable, customersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

const STATUSES = [
  { status: "pending", label: "Order Placed", description: "We received your order" },
  { status: "paid", label: "Payment Confirmed", description: "Payment processed successfully" },
  { status: "processing", label: "Processing", description: "Your order is being prepared" },
  { status: "shipped", label: "Shipped", description: "Your order is on its way" },
  { status: "delivered", label: "Delivered", description: "Your order has been delivered" },
];

const STATUS_ORDER = ["pending", "paid", "processing", "shipped", "delivered"];

// GET /api/tracking/lookup
router.get("/lookup", async (req, res) => {
  const { orderNumber, email } = req.query as { orderNumber?: string; email?: string };
  if (!orderNumber || !email) return res.status(400).json({ error: "orderNumber and email required" });

  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.orderNumber, orderNumber));
    if (!order) return res.status(404).json({ error: "Order not found" });

    const orderEmail = order.guestEmail ?? (
      order.customerId
        ? (await db.select({ email: customersTable.email }).from(customersTable).where(eq(customersTable.id, order.customerId)))[0]?.email
        : null
    );
    if (!orderEmail || orderEmail.toLowerCase() !== email.toLowerCase()) return res.status(404).json({ error: "Order not found" });

    const [shipment] = await db.select().from(shipmentsTable).where(eq(shipmentsTable.orderId, order.id)).orderBy(desc(shipmentsTable.createdAt));
    const currentIdx = STATUS_ORDER.indexOf(order.status);

    const events = STATUSES.map((s, i) => ({
      ...s,
      timestamp: i <= currentIdx ? (i === 0 ? order.createdAt.toISOString() : shipment?.shippedAt?.toISOString() ?? null) : null,
      isCompleted: i < currentIdx,
      isCurrent: i === currentIdx,
    }));

    res.json({
      orderNumber: order.orderNumber,
      status: order.status,
      trackingNumber: shipment?.trackingNumber ?? null,
      carrier: shipment?.carrier ?? null,
      trackingUrl: shipment?.trackingUrl ?? null,
      estimatedDelivery: shipment?.estimatedDelivery ?? null,
      events,
    });
  } catch {
    res.status(500).json({ error: "Failed to load tracking" });
  }
});

export default router;
