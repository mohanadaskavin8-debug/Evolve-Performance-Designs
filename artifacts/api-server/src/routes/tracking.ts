import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, shipmentsTable, shipmentEventsTable, customersTable } from "@workspace/db";
import { eq, desc, asc } from "drizzle-orm";

const router = Router();

// Synthetic ladder used when no real carrier events exist yet.
const BASE_STATUSES = [
  { status: "pending", label: "Order Placed", description: "We received your order" },
  { status: "paid", label: "Payment Confirmed", description: "Payment processed successfully" },
  { status: "processing", label: "Processing", description: "Your order is being prepared" },
  { status: "shipped", label: "Shipped", description: "Your order is on its way" },
  { status: "delivered", label: "Delivered", description: "Your order has been delivered" },
];

// Map order statuses onto the synthetic ladder (packaged/fulfilled are internal
// prep states — customers see them as "Processing").
const STATUS_INDEX: Record<string, number> = {
  pending: 0,
  paid: 1,
  processing: 2,
  packaged: 2,
  fulfilled: 2,
  shipped: 3,
  delivered: 4,
};

// Customer-facing labels for real shipment milestones.
const MILESTONE_STEPS = [
  { status: "label_created", label: "Preparing Shipment", description: "Shipping label created" },
  { status: "shipped", label: "Shipped", description: "Carrier picked up your order" },
  { status: "in_transit", label: "In Transit", description: "Moving through the carrier network" },
  { status: "out_for_delivery", label: "Out for Delivery", description: "On the delivery vehicle" },
  { status: "delivered", label: "Delivered", description: "Your order has arrived" },
];

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
    const realEvents = shipment
      ? await db.select().from(shipmentEventsTable).where(eq(shipmentEventsTable.shipmentId, shipment.id)).orderBy(asc(shipmentEventsTable.occurredAt))
      : [];

    let events;
    if (realEvents.length > 0 && shipment) {
      // Real carrier data: order lifecycle head + actual milestone timeline.
      const firstAt = new Map<string, { occurredAt: Date; description: string | null; location: string | null }>();
      for (const evt of realEvents) {
        if (!firstAt.has(evt.eventType)) {
          firstAt.set(evt.eventType, { occurredAt: evt.occurredAt, description: evt.description, location: evt.location });
        }
      }

      const milestoneRank: Record<string, number> = { label_created: 0, shipped: 1, in_transit: 2, out_for_delivery: 3, delivered: 4 };
      const currentRank = shipment.status in milestoneRank ? milestoneRank[shipment.status]! : shipment.status === "exception" ? -1 : 0;
      const isException = shipment.status === "exception";

      const head = [
        { status: "pending", label: "Order Placed", description: "We received your order", location: null, timestamp: order.createdAt.toISOString(), isCompleted: true, isCurrent: false },
        { status: "paid", label: "Payment Confirmed", description: "Payment processed successfully", location: null, timestamp: order.createdAt.toISOString(), isCompleted: true, isCurrent: false },
      ];

      const milestoneEvents = MILESTONE_STEPS.map((step, i) => {
        const seen = firstAt.get(step.status);
        const reached = seen !== undefined || (!isException && i <= currentRank);
        const isCurrent = !isException && i === currentRank;
        return {
          status: step.status,
          label: step.label,
          description: seen?.description ?? step.description,
          location: seen?.location ?? null,
          timestamp: seen ? seen.occurredAt.toISOString() : null,
          isCompleted: reached && !isCurrent,
          isCurrent,
        };
      }).filter((e) => e.isCompleted || e.isCurrent || e.timestamp !== null || !isException);

      events = [...head, ...milestoneEvents];

      if (isException) {
        const exc = [...realEvents].reverse().find((e) => e.eventType === "exception");
        events.push({
          status: "exception",
          label: "Delivery Exception",
          description: exc?.description ?? "The carrier reported an issue — check tracking for details",
          location: exc?.location ?? null,
          timestamp: exc ? exc.occurredAt.toISOString() : null,
          isCompleted: false,
          isCurrent: true,
        });
      }
    } else {
      // No carrier data yet: synthetic ladder from the order status.
      const currentIdx = STATUS_INDEX[order.status] ?? 0;
      events = BASE_STATUSES.map((s, i) => ({
        ...s,
        location: null,
        timestamp: i <= currentIdx ? (i === 0 ? order.createdAt.toISOString() : i === 3 ? shipment?.shippedAt?.toISOString() ?? null : i === 4 ? shipment?.deliveredAt?.toISOString() ?? null : null) : null,
        isCompleted: i < currentIdx,
        isCurrent: i === currentIdx,
      }));
    }

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
