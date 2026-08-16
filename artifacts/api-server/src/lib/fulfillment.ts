/**
 * Fulfillment engine: order → ShipStation push → label/tracking sync →
 * internal status ladder → milestone emails.
 *
 * Invariants:
 * - Local orders are never blocked or corrupted by ShipStation failures.
 *   Payment success always wins; pushes retry with backoff.
 * - Orders held for fraud review are never auto-pushed.
 * - Tracking events are idempotent (unique per shipment + external id).
 * - Milestone emails are idempotent (unique per order + milestone).
 */
import { createHash } from "node:crypto";
import { db, pool } from "@workspace/db";
import {
  ordersTable,
  shipmentsTable,
  shipmentEventsTable,
  activityLogTable,
  type Shipment,
} from "@workspace/db";
import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { logger } from "./logger";
import * as shipstation from "./shipstation";
import { sendMilestoneEmail, retryFailedEmails, type MilestoneEmailType } from "./email";

// Order statuses eligible for auto-push (pre-shipping, payment settled).
const PUSH_ELIGIBLE_ORDER_STATUSES = ["paid", "processing", "packaged"] as const;

// Backoff schedule for failed pushes, in minutes.
const PUSH_BACKOFF_MINUTES = [1, 5, 15, 60, 360, 1440];

const POLL_INTERVAL_MS = 10 * 60_000; // per-shipment tracking poll cadence
const ACTIVE_STATUSES = ["pushed", "label_created", "shipped", "in_transit", "out_for_delivery", "exception"];

const MILESTONE_RANK: Record<string, number> = {
  pending_push: 0,
  push_failed: 0,
  pushed: 1,
  label_created: 2,
  shipped: 3,
  in_transit: 4,
  out_for_delivery: 5,
  delivered: 6,
};

function backoffDate(attempts: number): Date {
  const idx = Math.min(attempts, PUSH_BACKOFF_MINUTES.length - 1);
  return new Date(Date.now() + PUSH_BACKOFF_MINUTES[idx]! * 60_000);
}

async function systemActivity(action: string, entityId: string, entityLabel: string, details: Record<string, unknown>): Promise<void> {
  try {
    await db.insert(activityLogTable).values({
      actorClerkUserId: "system",
      actorName: "Fulfillment Automation",
      actorEmail: null,
      action,
      entityType: "order",
      entityId,
      entityLabel,
      details,
    });
  } catch (err) {
    logger.warn({ err }, "Failed to write fulfillment activity entry");
  }
}

interface OrderPushContext {
  id: number;
  orderNumber: string;
  status: string;
  currency: string;
  requiresManualReview: boolean;
  customerEmail: string | null;
  shippingAddress: any;
}

async function loadOrderContext(orderId: number): Promise<OrderPushContext | null> {
  const { rows } = await pool.query(
    `SELECT o.id, o.order_number, o.status, o.currency, o.requires_manual_review, o.shipping_address,
            COALESCE(c.email, o.guest_email) AS customer_email
     FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
     WHERE o.id = $1`,
    [orderId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    orderNumber: r.order_number,
    status: r.status,
    currency: r.currency ?? "usd",
    requiresManualReview: r.requires_manual_review,
    customerEmail: r.customer_email ?? null,
    shippingAddress: r.shipping_address,
  };
}

async function loadPushItems(orderId: number): Promise<shipstation.PushItem[]> {
  const { rows } = await pool.query(
    `SELECT oi.product_name, oi.variant_sku, oi.quantity, oi.unit_price_in_cents,
            p.weight_grams, p.hs_code, p.country_of_origin, p.customs_description, p.customs_value_cents
     FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1 ORDER BY oi.id`,
    [orderId],
  );
  return rows.map((r: any) => ({
    name: r.product_name,
    sku: r.variant_sku,
    quantity: r.quantity,
    unitPriceCents: r.unit_price_in_cents,
    weightGrams: r.weight_grams,
    hsCode: r.hs_code,
    countryOfOrigin: r.country_of_origin,
    customsDescription: r.customs_description,
    customsValueCents: r.customs_value_cents,
  }));
}

function shipToFromAddress(address: any): shipstation.ShipToAddress | null {
  if (!address || typeof address !== "object" || !address.line1 || !address.countryCode) return null;
  return {
    name: address.name ?? "Customer",
    line1: address.line1,
    line2: address.line2 ?? null,
    city: address.city ?? "",
    state: address.state ?? null,
    postalCode: address.postalCode ?? null,
    countryCode: address.countryCode,
    phone: address.phone ?? null,
  };
}

/** Create the local shipment record for an order if it doesn't have one yet. */
export async function ensureShipmentForOrder(orderId: number): Promise<Shipment> {
  const existing = await db.select().from(shipmentsTable).where(eq(shipmentsTable.orderId, orderId)).limit(1);
  if (existing[0]) return existing[0];
  // The unique index on order_id makes concurrent creates safe: exactly one
  // insert wins and everyone else reads the winner's row.
  const inserted = await db
    .insert(shipmentsTable)
    .values({ orderId, status: "pending_push" })
    .onConflictDoNothing({ target: shipmentsTable.orderId })
    .returning();
  if (inserted[0]) return inserted[0];
  const raced = await db.select().from(shipmentsTable).where(eq(shipmentsTable.orderId, orderId)).limit(1);
  return raced[0]!;
}

export interface PushResult {
  pushed: boolean;
  error: string | null;
  blocked?: string;
}

// Same-instance dedupe: concurrent triggers (payment hook, tick, webhook tick,
// admin button) share one in-flight push per order. The DB claim inside
// doAttemptPush guards cross-instance races.
const inFlightPushes = new Map<number, Promise<PushResult>>();

const PUSH_CLAIM_WINDOW_MS = 3 * 60_000;

/**
 * Attempt to push one order to ShipStation. Never throws — all failure modes
 * are recorded on the shipment row as retry state.
 */
export function attemptPush(orderId: number, opts: { manual?: boolean } = {}): Promise<PushResult> {
  const inFlight = inFlightPushes.get(orderId);
  if (inFlight) return inFlight;
  const run = doAttemptPush(orderId, opts).finally(() => inFlightPushes.delete(orderId));
  inFlightPushes.set(orderId, run);
  return run;
}

async function doAttemptPush(orderId: number, opts: { manual?: boolean }): Promise<PushResult> {
  const order = await loadOrderContext(orderId);
  if (!order) return { pushed: false, error: "Order not found" };

  if (order.requiresManualReview) {
    return { pushed: false, error: null, blocked: "Order is held for fraud review" };
  }
  if (!PUSH_ELIGIBLE_ORDER_STATUSES.includes(order.status as any)) {
    return { pushed: false, error: null, blocked: `Order status "${order.status}" is not eligible for fulfillment push` };
  }

  const shipment = await ensureShipmentForOrder(orderId);
  if (shipment.shipstationShipmentId) {
    return { pushed: true, error: null };
  }

  // Atomically claim the push by moving nextPushAt into the future: row-level
  // locking guarantees exactly one concurrent claimer wins. If the process
  // dies mid-push the claim simply expires and the tick retries later.
  // Manual pushes skip the retry-window check but still take the claim.
  const now = new Date();
  const claimed = await db
    .update(shipmentsTable)
    .set({ nextPushAt: new Date(now.getTime() + PUSH_CLAIM_WINDOW_MS), updatedAt: now })
    .where(
      and(
        eq(shipmentsTable.id, shipment.id),
        inArray(shipmentsTable.status, ["pending_push", "push_failed"]),
        isNull(shipmentsTable.shipstationShipmentId),
        ...(opts.manual ? [] : [or(isNull(shipmentsTable.nextPushAt), lte(shipmentsTable.nextPushAt, now))!]),
      ),
    )
    .returning({ id: shipmentsTable.id });
  if (!claimed.length) {
    return { pushed: false, error: null, blocked: "A push for this order is already in progress or waiting for its retry window" };
  }

  const shipTo = shipToFromAddress(order.shippingAddress);
  if (!shipTo) {
    await db
      .update(shipmentsTable)
      .set({
        status: "push_failed",
        pushAttempts: shipment.pushAttempts + 1,
        lastPushError: "Order has no usable shipping address",
        lastPushAt: new Date(),
        nextPushAt: null, // unrecoverable without admin action — no auto-retry
        updatedAt: new Date(),
      })
      .where(eq(shipmentsTable.id, shipment.id));
    await systemActivity("fulfillment.push_failed", String(orderId), order.orderNumber, { reason: "missing shipping address" });
    return { pushed: false, error: "Order has no usable shipping address" };
  }

  try {
    const items = await loadPushItems(orderId);
    const result = await shipstation.pushOrder({
      orderNumber: order.orderNumber,
      customerEmail: order.customerEmail,
      shipTo,
      items,
      currency: order.currency,
      serviceCode: shipment.serviceCode,
    });
    await db
      .update(shipmentsTable)
      .set({
        status: "pushed", // the claim guarantees we started from pending_push/push_failed
        shipstationShipmentId: result.shipmentId,
        pushAttempts: shipment.pushAttempts + 1,
        lastPushError: null,
        lastPushAt: new Date(),
        nextPushAt: null,
        lastPolledAt: null, // poll soon to pick up labels
        updatedAt: new Date(),
      })
      .where(eq(shipmentsTable.id, shipment.id));
    logger.info({ orderId, shipstationShipmentId: result.shipmentId }, "Order pushed to ShipStation");
    return { pushed: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const attempts = shipment.pushAttempts + 1;
    await db
      .update(shipmentsTable)
      .set({
        status: "push_failed",
        pushAttempts: attempts,
        lastPushError: msg.slice(0, 500),
        lastPushAt: new Date(),
        // Not-connected is transient like any other failure: keep a retry date
        // so the tick picks the order up as soon as ShipStation is connected.
        // (nextPushAt stays null only for unrecoverable states, e.g. no address.)
        nextPushAt: backoffDate(attempts),
        updatedAt: new Date(),
      })
      .where(eq(shipmentsTable.id, shipment.id));
    await systemActivity("fulfillment.push_failed", String(orderId), order.orderNumber, { attempt: attempts, error: msg.slice(0, 300) });
    logger.warn({ orderId, attempts, err: msg }, "ShipStation push failed; scheduled retry");
    return { pushed: false, error: msg };
  }
}

/** Fire-and-forget entry point used right after payment lands. */
export function triggerOrderFulfillment(orderId: number): void {
  setImmediate(() => {
    attemptPush(orderId).catch((err) => logger.error({ err, orderId }, "Unexpected fulfillment push error"));
  });
}

// ── Inbound: labels + tracking → events → statuses → emails ──────────────────

function eventExternalId(evt: { occurredAt: string; description: string; cityLocality: string | null }): string {
  return createHash("sha1").update(`${evt.occurredAt}|${evt.description}|${evt.cityLocality ?? ""}`).digest("hex");
}

function trackingUrlFor(carrierCode: string | null, trackingNumber: string): string {
  switch ((carrierCode ?? "").toLowerCase()) {
    case "usps":
    case "stamps_com":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
    case "ups":
      return `https://www.ups.com/track?tracknum=${trackingNumber}`;
    case "fedex":
      return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
    case "dhl_express":
    case "dhl_ecommerce":
      return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${trackingNumber}`;
    default:
      return `https://www.google.com/search?q=${encodeURIComponent(`${trackingNumber} tracking`)}`;
  }
}

async function recordEvent(
  shipment: Shipment,
  evt: { eventType: string; description: string | null; location: string | null; externalId: string; occurredAt: Date },
): Promise<boolean> {
  const inserted = await db
    .insert(shipmentEventsTable)
    .values({
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      eventType: evt.eventType,
      description: evt.description,
      location: evt.location,
      externalId: evt.externalId,
      occurredAt: evt.occurredAt,
    })
    .onConflictDoNothing()
    .returning({ id: shipmentEventsTable.id });
  return inserted.length > 0;
}

async function advanceMilestone(shipment: Shipment, milestone: shipstation.Milestone, occurredAt: Date): Promise<void> {
  const currentRank = MILESTONE_RANK[shipment.status] ?? 0;
  const newRank = MILESTONE_RANK[milestone] ?? 0;
  const isException = milestone === "exception";

  // Monotonic ladder with an explicit exception policy:
  // - delivered is terminal — nothing overwrites it, not even an exception;
  // - an exception freezes the ladder until real carrier movement (shipped or
  //   later) proves the package is moving again;
  // - otherwise only forward transitions apply.
  if (isException) {
    if (currentRank >= MILESTONE_RANK.delivered!) return;
  } else if (shipment.status === "exception") {
    if (newRank < MILESTONE_RANK.shipped!) return;
  } else if (newRank <= currentRank) {
    return;
  }

  const patch: Record<string, unknown> = { status: milestone, updatedAt: new Date() };
  if (milestone === "shipped" && !shipment.shippedAt) patch.shippedAt = occurredAt;
  if (milestone === "delivered") {
    patch.deliveredAt = occurredAt;
    if (!shipment.shippedAt) patch.shippedAt = occurredAt;
  }
  // Compare-and-set on the status we ranked against: if a concurrent writer
  // advanced the shipment first, this matches zero rows and we defer to it —
  // a stale poll can never move the ladder backwards.
  const updated = await db
    .update(shipmentsTable)
    .set(patch)
    .where(and(eq(shipmentsTable.id, shipment.id), eq(shipmentsTable.status, shipment.status)))
    .returning({ id: shipmentsTable.id });
  if (!updated.length) return;

  // Mirror the customer-facing order status at the two big transitions.
  if (milestone === "shipped" || milestone === "delivered") {
    const orderStatus = milestone === "shipped" ? "shipped" : "delivered";
    await db
      .update(ordersTable)
      .set({ status: orderStatus, updatedAt: new Date() })
      .where(
        and(
          eq(ordersTable.id, shipment.orderId),
          sql`${ordersTable.status} NOT IN ('cancelled', 'refunded', 'delivered')`,
        ),
      );
  }
}

async function emailForMilestone(shipment: Shipment, milestone: shipstation.Milestone): Promise<void> {
  const order = await loadOrderContext(shipment.orderId);
  if (!order?.customerEmail) return;
  const fresh = (await db.select().from(shipmentsTable).where(eq(shipmentsTable.id, shipment.id)).limit(1))[0] ?? shipment;
  await sendMilestoneEmail({
    orderId: shipment.orderId,
    shipmentId: shipment.id,
    orderNumber: order.orderNumber,
    emailType: milestone as MilestoneEmailType,
    recipient: order.customerEmail,
    trackingNumber: fresh.trackingNumber,
    trackingUrl: fresh.trackingUrl,
    carrier: fresh.carrier ?? fresh.carrierCode,
  });
}

/** Check ShipStation for a purchased label on a pushed shipment. */
async function syncLabel(shipment: Shipment): Promise<void> {
  if (!shipment.shipstationShipmentId) return;
  const labels = await shipstation.getLabelsForShipment(shipment.shipstationShipmentId);
  const label = labels[0];
  await db.update(shipmentsTable).set({ lastPolledAt: new Date(), updatedAt: new Date() }).where(eq(shipmentsTable.id, shipment.id));
  if (!label) return;

  const carrierName = label.carrierCode ? label.carrierCode.replace(/_/g, " ").toUpperCase() : shipment.carrier;
  await db
    .update(shipmentsTable)
    .set({
      carrier: carrierName ?? null,
      carrierCode: label.carrierCode ?? shipment.carrierCode,
      serviceCode: label.serviceCode ?? shipment.serviceCode,
      trackingNumber: label.trackingNumber ?? shipment.trackingNumber,
      trackingUrl: label.trackingNumber ? trackingUrlFor(label.carrierCode, label.trackingNumber) : shipment.trackingUrl,
      labelUrl: label.labelUrl ?? shipment.labelUrl,
      updatedAt: new Date(),
    })
    .where(eq(shipmentsTable.id, shipment.id));

  const occurredAt = label.createdAt ? new Date(label.createdAt) : new Date();
  const externalId = `label:${label.labelId}`;
  const isNew = await recordEvent(shipment, {
    eventType: "label_created",
    description: "Shipping label created",
    location: null,
    externalId,
    occurredAt,
  });
  await advanceMilestone(shipment, "label_created", occurredAt);
  if (isNew) await emailForMilestone(shipment, "label_created");
}

/** Pull carrier tracking for an in-flight shipment and normalize into events/statuses. */
async function syncTracking(shipment: Shipment): Promise<void> {
  if (!shipment.trackingNumber || !shipment.carrierCode) return;
  const tracking = await shipstation.getTracking(shipment.carrierCode, shipment.trackingNumber);

  const patch: Record<string, unknown> = { lastPolledAt: new Date(), updatedAt: new Date() };
  if (tracking.estimatedDeliveryDate) {
    patch.estimatedDelivery = new Date(tracking.estimatedDeliveryDate).toDateString();
  }
  await db.update(shipmentsTable).set(patch).where(eq(shipmentsTable.id, shipment.id));

  // Record every new carrier scan as an event (idempotent), collecting fresh milestones.
  const newMilestones = new Set<shipstation.Milestone>();
  const sorted = [...tracking.events].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  for (const evt of sorted) {
    const milestone = shipstation.normalizeEventDescription(evt.description);
    const location = [evt.cityLocality, evt.stateProvince, evt.countryCode].filter(Boolean).join(", ") || null;
    const isNew = await recordEvent(shipment, {
      eventType: milestone,
      description: evt.description,
      location,
      externalId: eventExternalId(evt),
      occurredAt: new Date(evt.occurredAt),
    });
    if (isNew) newMilestones.add(milestone);
  }

  // The authoritative current milestone comes from the top-level status code.
  const topMilestone = shipstation.normalizeTrackingStatus(tracking.statusCode);
  const occurredAt = tracking.actualDeliveryDate ? new Date(tracking.actualDeliveryDate) : new Date();
  if (topMilestone) {
    await advanceMilestone(shipment, topMilestone, occurredAt);
    newMilestones.add(topMilestone);
  }

  // Milestone emails: idempotent per (order, milestone) — the email module dedupes,
  // so re-sending a Set that includes an already-emailed milestone is a no-op.
  const emailOrder: shipstation.Milestone[] = ["shipped", "in_transit", "out_for_delivery", "delivered", "exception"];
  for (const milestone of emailOrder) {
    if (newMilestones.has(milestone)) {
      await emailForMilestone(shipment, milestone);
    }
  }
}

// ── The tick ───────────────────────────────────────────────────────────────────

let tickRunning = false;
let notConnectedLogged = false;

export async function runFulfillmentTick(): Promise<void> {
  if (tickRunning) return;
  tickRunning = true;
  try {
    // 1) Ensure shipment records exist for every eligible paid order.
    const { rows: missing } = await pool.query(
      `SELECT o.id FROM orders o
       WHERE o.status = ANY($1) AND o.requires_manual_review = false
         AND NOT EXISTS (SELECT 1 FROM shipments s WHERE s.order_id = o.id)
       ORDER BY o.created_at ASC LIMIT 20`,
      [PUSH_ELIGIBLE_ORDER_STATUSES],
    );
    for (const row of missing) {
      await ensureShipmentForOrder(row.id);
    }

    const health = await shipstation.checkConnection();
    if (!health.connected) {
      if (!notConnectedLogged) {
        logger.info("ShipStation not connected — fulfillment automation idle (orders remain safe locally)");
        notConnectedLogged = true;
      }
      // Still retry failed emails even without ShipStation.
      await retryFailedEmails(emailRetryContext);
      return;
    }
    notConnectedLogged = false;

    // 2) Push pending/retry-due shipments for eligible, cleared orders.
    const due = await db
      .select({ orderId: shipmentsTable.orderId })
      .from(shipmentsTable)
      .innerJoin(ordersTable, eq(ordersTable.id, shipmentsTable.orderId))
      .where(
        and(
          or(
            and(
              eq(shipmentsTable.status, "pending_push"),
              // respect an active push claim (nextPushAt in the future)
              or(isNull(shipmentsTable.nextPushAt), lte(shipmentsTable.nextPushAt, new Date())),
            ),
            and(eq(shipmentsTable.status, "push_failed"), lte(shipmentsTable.nextPushAt, new Date())),
          ),
          isNull(shipmentsTable.shipstationShipmentId),
          eq(ordersTable.requiresManualReview, false),
          inArray(ordersTable.status, PUSH_ELIGIBLE_ORDER_STATUSES as unknown as string[]),
        ),
      )
      .limit(10);
    for (const row of due) {
      await attemptPush(row.orderId);
    }

    // 3) Poll pushed shipments without tracking for purchased labels.
    const pollCutoff = new Date(Date.now() - POLL_INTERVAL_MS);
    const needLabel = await db
      .select()
      .from(shipmentsTable)
      .where(
        and(
          eq(shipmentsTable.status, "pushed"),
          isNull(shipmentsTable.trackingNumber),
          or(isNull(shipmentsTable.lastPolledAt), lte(shipmentsTable.lastPolledAt, pollCutoff)),
        ),
      )
      .limit(10);
    for (const shipment of needLabel) {
      try {
        await syncLabel(shipment);
      } catch (err) {
        logger.warn({ shipmentId: shipment.id, err }, "Label sync failed");
      }
    }

    // 4) Poll in-flight shipments for tracking updates.
    const inFlight = await db
      .select()
      .from(shipmentsTable)
      .where(
        and(
          inArray(shipmentsTable.status, ["label_created", "shipped", "in_transit", "out_for_delivery", "exception"]),
          or(isNull(shipmentsTable.lastPolledAt), lte(shipmentsTable.lastPolledAt, pollCutoff)),
        ),
      )
      .limit(10);
    for (const shipment of inFlight) {
      try {
        if (!shipment.trackingNumber) {
          await syncLabel(shipment);
        } else {
          await syncTracking(shipment);
        }
      } catch (err) {
        await db.update(shipmentsTable).set({ lastPolledAt: new Date() }).where(eq(shipmentsTable.id, shipment.id));
        logger.warn({ shipmentId: shipment.id, err }, "Tracking sync failed");
      }
    }

    // 5) Retry failed milestone emails.
    await retryFailedEmails(emailRetryContext);
  } catch (err) {
    logger.error({ err }, "Fulfillment tick failed");
  } finally {
    tickRunning = false;
  }
}

async function emailRetryContext(orderId: number) {
  const order = await loadOrderContext(orderId);
  if (!order) return null;
  const [shipment] = await db.select().from(shipmentsTable).where(eq(shipmentsTable.orderId, orderId)).limit(1);
  return {
    orderNumber: order.orderNumber,
    trackingNumber: shipment?.trackingNumber ?? null,
    trackingUrl: shipment?.trackingUrl ?? null,
    carrier: shipment?.carrier ?? shipment?.carrierCode ?? null,
  };
}

/**
 * Webhook entry: ShipStation payloads are treated as untrusted poll hints.
 * We never write webhook data directly — we mark active shipments stale and
 * re-fetch the authoritative state from the API. Forged payloads can only
 * cause an extra poll.
 */
export async function onShipStationWebhook(): Promise<void> {
  shipstation.invalidateHealthCache();
  await db
    .update(shipmentsTable)
    .set({ lastPolledAt: null })
    .where(inArray(shipmentsTable.status, ACTIVE_STATUSES as unknown as string[]));
  setImmediate(() => {
    runFulfillmentTick().catch((err) => logger.error({ err }, "Webhook-triggered tick failed"));
  });
}

/** Counts for the admin fulfillment dashboard. */
export async function getFulfillmentCounts(): Promise<{
  pendingPushes: number;
  failedPushes: number;
  activeShipments: number;
  deliveredLast30Days: number;
}> {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE s.status = 'pending_push') AS pending,
      COUNT(*) FILTER (WHERE s.status = 'push_failed') AS failed,
      COUNT(*) FILTER (WHERE s.status IN ('pushed','label_created','shipped','in_transit','out_for_delivery','exception')) AS active,
      COUNT(*) FILTER (WHERE s.status = 'delivered' AND s.delivered_at > NOW() - INTERVAL '30 days') AS delivered30
    FROM shipments s
  `);
  const r = rows[0] ?? {};
  return {
    pendingPushes: parseInt(r.pending ?? "0"),
    failedPushes: parseInt(r.failed ?? "0"),
    activeShipments: parseInt(r.active ?? "0"),
    deliveredLast30Days: parseInt(r.delivered30 ?? "0"),
  };
}

let intervalHandle: NodeJS.Timeout | null = null;

/** Start the background fulfillment loop (call once at server boot). */
export function startFulfillmentLoop(): void {
  if (intervalHandle) return;
  intervalHandle = setInterval(() => {
    runFulfillmentTick().catch((err) => logger.error({ err }, "Fulfillment tick crashed"));
  }, 60_000);
  // First pass shortly after boot, once routes are serving.
  setTimeout(() => {
    runFulfillmentTick().catch((err) => logger.error({ err }, "Initial fulfillment tick crashed"));
  }, 5_000);
  logger.info("Fulfillment loop started (60s tick)");
}
