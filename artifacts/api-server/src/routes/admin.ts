import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, pool } from "@workspace/db";
import {
  adminRolesTable, activityLogTable,
  ordersTable, orderItemsTable, shipmentsTable,
  returnsTable, returnItemsTable,
  productsTable, productVariantsTable, productImagesTable, productCollectionsTable, collectionsTable,
  inventoryTransactionsTable,
  customersTable, discountsTable,
  shippingZonesTable, shippingRatesTable,
  supportRequestsTable, reviewsTable,
  websitePagesTable, homepageSectionsTable, siteSettingsTable,
} from "@workspace/db";
import { eq, and, desc, asc, or, ilike, sql, lt, gte, inArray, ne } from "drizzle-orm";
import Stripe from "stripe";
import * as shipstation from "../lib/shipstation";
import { attemptPush, getFulfillmentCounts, triggerOrderFulfillment } from "../lib/fulfillment";
import { checkResendHealth } from "../lib/email";

const router = Router();

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env["STRIPE_SECRET_KEY"] ?? "";
    _stripe = new Stripe(key, { apiVersion: "2025-04-30.basil" as any });
  }
  return _stripe;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type AdminUser = {
  id: number;
  clerkUserId: string;
  email: string;
  name: string | null;
  role: string;
};

async function getAdminUser(userId: string): Promise<AdminUser | null> {
  const [a] = await db.select().from(adminRolesTable).where(eq(adminRolesTable.clerkUserId, userId));
  return a ?? null;
}

async function reconcilePendingInvite(userId: string): Promise<AdminUser | null> {
  // When an invited user signs in, their clerkUserId won't match any admin_roles row yet.
  // Fetch their email from Clerk and look for a pending invite row (clerkUserId starts with "pending_").
  try {
    const clerkRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${process.env["CLERK_SECRET_KEY"]}` },
    });
    if (!clerkRes.ok) return null;
    const clerkUser = await clerkRes.json() as any;
    const email: string | undefined = clerkUser.email_addresses?.[0]?.email_address;
    if (!email) return null;

    // Look for a pending invite row with this email
    const pending = await db.select().from(adminRolesTable)
      .where(and(ilike(adminRolesTable.email, email), sql`${adminRolesTable.clerkUserId} LIKE 'pending_%'`));
    if (!pending[0]) return null;

    // Reconcile: update the placeholder clerkUserId to the real one
    const name = [clerkUser.first_name, clerkUser.last_name].filter(Boolean).join(" ") || pending[0].name;
    const [updated] = await db.update(adminRolesTable)
      .set({ clerkUserId: userId, name, email, updatedAt: new Date() })
      .where(eq(adminRolesTable.id, pending[0].id))
      .returning();
    return updated ?? null;
  } catch {
    return null;
  }
}

async function requireAdmin(req: any, res: any, next: any, minRole?: "owner" | "manager"): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  let adminUser = await getAdminUser(userId);

  // If no direct match, attempt to reconcile a pending invite
  if (!adminUser) {
    adminUser = await reconcilePendingInvite(userId);
  }

  if (!adminUser) {
    // Check if zero admins (first setup)
    const count = await pool.query("SELECT COUNT(*) FROM admin_roles");
    const total = parseInt(count.rows[0].count);
    if (total === 0) {
      res.status(403).json({ error: "Not an admin", isFirstSetup: true });
    } else {
      res.status(403).json({ error: "Not an admin" });
    }
    return;
  }

  if (minRole === "owner" && adminUser.role !== "owner") {
    res.status(403).json({ error: "Owner access required" });
    return;
  }
  if (minRole === "manager" && adminUser.role === "staff") {
    res.status(403).json({ error: "Manager or owner access required" });
    return;
  }

  req.adminUser = adminUser;
  next();
}

async function logActivity(params: {
  actor: AdminUser;
  action: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(activityLogTable).values({
    actorClerkUserId: params.actor.clerkUserId,
    actorName: params.actor.name,
    actorEmail: params.actor.email,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    entityLabel: params.entityLabel,
    details: params.details ?? {},
  });
}

function formatAdminUser(u: AdminUser) {
  return {
    id: u.id,
    clerkUserId: u.clerkUserId,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: (u as any).createdAt?.toISOString?.() ?? new Date().toISOString(),
    updatedAt: (u as any).updatedAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

// ── /admin/me ─────────────────────────────────────────────────────────────────

router.get("/me", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const total = await pool.query("SELECT COUNT(*) FROM admin_roles");
  res.json({
    clerkUserId: req.adminUser.clerkUserId,
    email: req.adminUser.email,
    name: req.adminUser.name,
    role: req.adminUser.role,
    isFirstSetup: parseInt(total.rows[0].count) === 0,
  });
});

// ── /admin/users/bootstrap ────────────────────────────────────────────────────

router.post("/users/bootstrap", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { secretKey } = req.body as { secretKey: string };
  const expectedKey = process.env["BOOTSTRAP_SECRET"];
  if (!expectedKey || secretKey !== expectedKey) {
    return res.status(403).json({ error: "Invalid bootstrap key" });
  }

  const existing = await pool.query("SELECT COUNT(*) FROM admin_roles");
  if (parseInt(existing.rows[0].count) > 0) {
    return res.status(409).json({ error: "Admin users already exist. Contact an owner to grant access." });
  }

  // Get Clerk user info from Clerk API
  let email = "admin@example.com";
  let name: string | null = null;
  try {
    const clerkRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${process.env["CLERK_SECRET_KEY"]}` },
    });
    if (clerkRes.ok) {
      const clerkUser = await clerkRes.json() as any;
      email = clerkUser.email_addresses?.[0]?.email_address ?? email;
      name = [clerkUser.first_name, clerkUser.last_name].filter(Boolean).join(" ") || null;
    }
  } catch { /* ignore */ }

  const [newAdmin] = await db.insert(adminRolesTable).values({
    clerkUserId: userId,
    email,
    name,
    role: "owner",
  }).returning();

  res.json(formatAdminUser(newAdmin));
});

// ── /admin/users ──────────────────────────────────────────────────────────────

router.get("/users", async (req, res, next) => requireAdmin(req, res, next, "owner"), async (req: any, res) => {
  const users = await db.select().from(adminRolesTable).orderBy(asc(adminRolesTable.createdAt));
  res.json(users.map(formatAdminUser));
});

router.post("/users", async (req, res, next) => requireAdmin(req, res, next, "owner"), async (req: any, res) => {
  const { email, role, name } = req.body as { email: string; role: string; name?: string };
  if (!email || !role) return res.status(400).json({ error: "email and role required" });
  if (!["manager", "staff"].includes(role)) return res.status(400).json({ error: "Invalid role" });

  // Create a pending admin_roles entry with email (clerkUserId will be reconciled on first sign-in)
  const placeholderClerkId = `pending_${Date.now()}_${email.replace(/[^a-z0-9]/gi, "_").slice(0, 30)}`;
  const [newAdmin] = await db.insert(adminRolesTable).values({
    clerkUserId: placeholderClerkId,
    email,
    name: name ?? null,
    role,
  }).returning();

  // Send a Clerk invitation so the user gets an email with a sign-up link
  try {
    await fetch("https://api.clerk.com/v1/invitations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env["CLERK_SECRET_KEY"]}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email_address: email }),
    });
  } catch { /* invitation send failure is non-fatal */ }

  await logActivity({ actor: req.adminUser, action: "admin.user.invited", entityType: "admin_user", entityLabel: email, details: { email, role } });
  res.status(201).json(formatAdminUser(newAdmin));
});

router.patch("/users/:clerkUserId", async (req, res, next) => requireAdmin(req, res, next, "owner"), async (req: any, res) => {
  const { clerkUserId } = req.params;
  const { role, name } = req.body as { role: string; name?: string };
  if (!["owner", "manager", "staff"].includes(role)) return res.status(400).json({ error: "Invalid role" });

  const [updated] = await db.update(adminRolesTable)
    .set({ role, ...(name !== undefined ? { name } : {}), updatedAt: new Date() })
    .where(eq(adminRolesTable.clerkUserId, clerkUserId))
    .returning();
  if (!updated) return res.status(404).json({ error: "Admin user not found" });

  await logActivity({ actor: req.adminUser, action: "admin.user.role_changed", entityType: "admin_user", entityLabel: updated.email, details: { newRole: role } });
  res.json(formatAdminUser(updated));
});

router.delete("/users/:clerkUserId", async (req, res, next) => requireAdmin(req, res, next, "owner"), async (req: any, res) => {
  const { clerkUserId } = req.params;
  if (clerkUserId === req.adminUser.clerkUserId) {
    return res.status(400).json({ error: "Cannot remove yourself" });
  }
  const [deleted] = await db.delete(adminRolesTable).where(eq(adminRolesTable.clerkUserId, clerkUserId)).returning();
  if (!deleted) return res.status(404).json({ error: "Admin user not found" });
  await logActivity({ actor: req.adminUser, action: "admin.user.removed", entityType: "admin_user", entityLabel: deleted.email });
  res.status(204).send();
});

// ── /admin/dashboard ──────────────────────────────────────────────────────────

router.get("/dashboard", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
  const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const prevMonthStart = new Date(monthStart); prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

  const [todayRev, weekRev, monthRev, prevMonthRev, orderCounts, customerCount, newCustomers, lowStock, outOfStock, attentionFraud, attentionReturns, recentOrdersRaw, salesByDay] = await Promise.all([
    pool.query("SELECT COALESCE(SUM(total_in_cents),0) as total FROM orders WHERE created_at >= $1 AND status != 'cancelled'", [todayStart]),
    pool.query("SELECT COALESCE(SUM(total_in_cents),0) as total FROM orders WHERE created_at >= $1 AND status != 'cancelled'", [weekStart]),
    pool.query("SELECT COALESCE(SUM(total_in_cents),0) as total FROM orders WHERE created_at >= $1 AND status != 'cancelled'", [monthStart]),
    pool.query("SELECT COALESCE(SUM(total_in_cents),0) as total FROM orders WHERE created_at >= $1 AND created_at < $2 AND status != 'cancelled'", [prevMonthStart, monthStart]),
    pool.query("SELECT status, COUNT(*) as count FROM orders GROUP BY status"),
    pool.query("SELECT COUNT(*) FROM customers"),
    pool.query("SELECT COUNT(*) FROM customers WHERE created_at >= $1", [weekStart]),
    pool.query("SELECT COUNT(*) FROM product_variants WHERE stock_quantity > 0 AND stock_quantity <= 5"),
    pool.query("SELECT COUNT(*) FROM product_variants WHERE stock_quantity = 0 AND active = true"),
    pool.query("SELECT COUNT(*) FROM orders WHERE requires_manual_review = true AND status NOT IN ('cancelled','fulfilled')"),
    pool.query("SELECT COUNT(*) FROM returns WHERE status = 'requested'"),
    pool.query(`
      SELECT o.id, o.order_number, o.status, o.total_in_cents, o.currency,
             o.requires_manual_review, o.stripe_risk_level, o.created_at,
             COALESCE(c.email, o.guest_email) as customer_email,
             CONCAT(c.first_name, ' ', c.last_name) as customer_name,
             COUNT(oi.id) as item_count,
             s.tracking_number
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN shipments s ON s.order_id = o.id
      GROUP BY o.id, c.email, c.first_name, c.last_name, s.tracking_number
      ORDER BY o.created_at DESC LIMIT 10
    `),
    pool.query(`
      SELECT DATE(created_at) as date, 
             COALESCE(SUM(total_in_cents),0) as revenue_in_cents,
             COUNT(*) as order_count
      FROM orders WHERE created_at >= $1 AND status != 'cancelled'
      GROUP BY DATE(created_at) ORDER BY date ASC
    `, [weekStart]),
  ]);

  const orderCountMap: Record<string, number> = {};
  for (const row of orderCounts.rows) orderCountMap[row.status] = parseInt(row.count);

  const currMonth = parseInt(monthRev.rows[0].total);
  const prevMonth = parseInt(prevMonthRev.rows[0].total);
  const growthPct = prevMonth > 0 ? ((currMonth - prevMonth) / prevMonth) * 100 : 0;

  const attention = [];
  const fraudCount = parseInt(attentionFraud.rows[0].count);
  if (fraudCount > 0) attention.push({ type: "fraud", label: "Orders Needing Review", count: fraudCount, severity: "high", href: "/orders?requiresReview=true" });
  const returnCount = parseInt(attentionReturns.rows[0].count);
  if (returnCount > 0) attention.push({ type: "returns", label: "Pending Return Requests", count: returnCount, severity: "medium", href: "/returns?status=requested" });
  const lowStockCount = parseInt(lowStock.rows[0].count);
  if (lowStockCount > 0) attention.push({ type: "inventory", label: "Low Stock Variants", count: lowStockCount, severity: "medium", href: "/inventory?filter=low_stock" });
  const outCount = parseInt(outOfStock.rows[0].count);
  if (outCount > 0) attention.push({ type: "out_of_stock", label: "Out of Stock", count: outCount, severity: "high", href: "/inventory?filter=out_of_stock" });

  res.json({
    revenue: {
      todayInCents: parseInt(todayRev.rows[0].total),
      weekInCents: parseInt(weekRev.rows[0].total),
      monthInCents: currMonth,
      monthGrowthPct: Math.round(growthPct * 10) / 10,
    },
    orders: {
      pending: orderCountMap["pending"] ?? 0,
      processing: orderCountMap["processing"] ?? 0,
      readyToShip: orderCountMap["packaged"] ?? 0,
      total: Object.values(orderCountMap).reduce((a, b) => a + b, 0),
    },
    customers: {
      total: parseInt(customerCount.rows[0].count),
      newThisWeek: parseInt(newCustomers.rows[0].count),
    },
    inventory: { lowStockCount: parseInt(lowStock.rows[0].count), outOfStockCount: parseInt(outOfStock.rows[0].count) },
    attentionItems: attention,
    recentOrders: recentOrdersRaw.rows.map((r: any) => ({
      id: r.id, orderNumber: r.order_number, status: r.status,
      totalInCents: r.total_in_cents, currency: r.currency ?? "usd",
      customerEmail: r.customer_email, customerName: r.customer_name?.trim() || null,
      itemCount: parseInt(r.item_count), requiresManualReview: r.requires_manual_review,
      stripeRiskLevel: r.stripe_risk_level, trackingNumber: r.tracking_number,
      createdAt: r.created_at?.toISOString(),
    })),
    salesByDay: salesByDay.rows.map((r: any) => ({
      date: r.date?.toISOString?.()?.slice(0, 10) ?? String(r.date),
      revenueInCents: parseInt(r.revenue_in_cents),
      orderCount: parseInt(r.order_count),
    })),
  });
});

// ── /admin/orders ─────────────────────────────────────────────────────────────

router.get("/orders", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const { status, search, requiresReview, limit = "50", offset = "0" } = req.query as any;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (status) { conditions.push(`o.status = $${p++}`); params.push(status); }
  if (requiresReview === "true") { conditions.push(`o.requires_manual_review = true`); }
  if (search) {
    conditions.push(`(o.order_number ILIKE $${p} OR c.email ILIKE $${p} OR o.guest_email ILIKE $${p})`);
    params.push(`%${search}%`); p++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows, countRow] = await Promise.all([
    pool.query(`
      SELECT o.id, o.order_number, o.status, o.total_in_cents, o.currency,
             o.requires_manual_review, o.stripe_risk_level, o.created_at,
             COALESCE(c.email, o.guest_email) as customer_email,
             COALESCE(CONCAT(c.first_name, ' ', c.last_name), '') as customer_name,
             COUNT(oi.id) as item_count, s.tracking_number
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN shipments s ON s.order_id = o.id
      ${where}
      GROUP BY o.id, c.email, c.first_name, c.last_name, s.tracking_number
      ORDER BY o.created_at DESC LIMIT $${p} OFFSET $${p + 1}
    `, [...params, parseInt(limit), parseInt(offset)]),
    pool.query(`SELECT COUNT(DISTINCT o.id) FROM orders o LEFT JOIN customers c ON c.id = o.customer_id ${where}`, params),
  ]);

  res.json({
    orders: rows.rows.map((r: any) => ({
      id: r.id, orderNumber: r.order_number, status: r.status,
      totalInCents: r.total_in_cents, currency: r.currency ?? "usd",
      customerEmail: r.customer_email, customerName: r.customer_name?.trim() || null,
      itemCount: parseInt(r.item_count), requiresManualReview: r.requires_manual_review,
      stripeRiskLevel: r.stripe_risk_level, trackingNumber: r.tracking_number,
      createdAt: r.created_at?.toISOString(),
    })),
    total: parseInt(countRow.rows[0].count),
  });
});

router.get("/orders/:orderId", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const orderId = parseInt(req.params.orderId);
  const [orderRow, itemRows, shipmentRows, eventRows] = await Promise.all([
    pool.query(`
      SELECT o.*, COALESCE(c.email, o.guest_email) as customer_email,
             COALESCE(CONCAT(c.first_name, ' ', c.last_name), '') as customer_name
      FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id = $1
    `, [orderId]),
    pool.query("SELECT * FROM order_items WHERE order_id = $1 ORDER BY id", [orderId]),
    pool.query("SELECT * FROM shipments WHERE order_id = $1 ORDER BY created_at DESC", [orderId]),
    pool.query("SELECT * FROM shipment_events WHERE order_id = $1 ORDER BY occurred_at", [orderId]),
  ]);
  if (!orderRow.rows[0]) return res.status(404).json({ error: "Order not found" });
  const o = orderRow.rows[0];
  res.json({
    id: o.id, orderNumber: o.order_number, status: o.status,
    items: itemRows.rows.map((i: any) => ({
      id: i.id, productName: i.product_name, productSlug: i.product_slug,
      variantSku: i.variant_sku, size: i.size, color: i.color,
      quantity: i.quantity, unitPriceInCents: i.unit_price_in_cents,
      totalPriceInCents: i.total_price_in_cents, imageUrl: i.image_url,
    })),
    subtotalInCents: o.subtotal_in_cents, shippingInCents: o.shipping_in_cents,
    taxInCents: o.tax_in_cents, discountInCents: o.discount_in_cents, totalInCents: o.total_in_cents,
    currency: o.currency ?? "usd", customerEmail: o.customer_email, customerName: o.customer_name?.trim() || null,
    customerId: o.customer_id,
    shippingAddress: o.shipping_address, billingAddress: o.billing_address,
    discountCode: o.discount_code, notes: o.notes,
    stripeSessionId: o.stripe_session_id, stripePaymentIntentId: o.stripe_payment_intent_id,
    stripeRiskLevel: o.stripe_risk_level, stripeRiskScore: o.stripe_risk_score,
    requiresManualReview: o.requires_manual_review,
    shipments: shipmentRows.rows.map((s: any) =>
      mapAdminShipment(s, eventRows.rows.filter((e: any) => e.shipment_id === s.id)),
    ),
    createdAt: o.created_at?.toISOString(), updatedAt: o.updated_at?.toISOString(),
  });
});

router.post("/orders/:orderId/actions", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  const orderId = parseInt(req.params.orderId);
  const { action, carrier, trackingNumber, trackingUrl, estimatedDelivery, refundAmountInCents, reason, notes } = req.body as any;

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) return res.status(404).json({ error: "Order not found" });

  let newStatus = order.status;

  if (action === "mark_processing") {
    newStatus = "processing";
  } else if (action === "mark_packaged") {
    newStatus = "packaged";
  } else if (action === "clear_fraud_flag") {
    await db.update(ordersTable).set({ requiresManualReview: false, updatedAt: new Date() }).where(eq(ordersTable.id, orderId));
    await logActivity({ actor: req.adminUser, action: "order.fraud_cleared", entityType: "order", entityId: String(orderId), entityLabel: order.orderNumber });
    // The hold is lifted — the order is now eligible for automatic fulfillment.
    triggerOrderFulfillment(orderId);
  } else if (action === "fulfill") {
    newStatus = "fulfilled";
    if (carrier || trackingNumber) {
      await db.insert(shipmentsTable).values({
        orderId, carrier: carrier ?? null, trackingNumber: trackingNumber ?? null,
        trackingUrl: trackingUrl ?? null, estimatedDelivery: estimatedDelivery ?? null,
        shippedAt: new Date(),
      });
    }
    await logActivity({ actor: req.adminUser, action: "order.fulfilled", entityType: "order", entityId: String(orderId), entityLabel: order.orderNumber, details: { carrier, trackingNumber } });
  } else if (action === "cancel") {
    newStatus = "cancelled";
    await logActivity({ actor: req.adminUser, action: "order.cancelled", entityType: "order", entityId: String(orderId), entityLabel: order.orderNumber, details: { reason } });
  } else if (action === "refund") {
    if (order.stripePaymentIntentId) {
      try {
        await getStripe().refunds.create({
          payment_intent: order.stripePaymentIntentId,
          ...(refundAmountInCents ? { amount: refundAmountInCents } : {}),
          reason: "requested_by_customer",
        });
      } catch (e: any) {
        return res.status(400).json({ error: `Stripe refund failed: ${e.message}` });
      }
    }
    newStatus = "refunded";
    await logActivity({ actor: req.adminUser, action: "order.refunded", entityType: "order", entityId: String(orderId), entityLabel: order.orderNumber, details: { refundAmountInCents } });
  } else {
    return res.status(400).json({ error: "Unknown action" });
  }

  await db.update(ordersTable).set({ status: newStatus, ...(notes ? { notes } : {}), updatedAt: new Date() }).where(eq(ordersTable.id, orderId));
  if (action !== "clear_fraud_flag") {
    await logActivity({ actor: req.adminUser, action: `order.${action}`, entityType: "order", entityId: String(orderId), entityLabel: order.orderNumber });
  }

  // Return updated order
  const updatedOrderResult = await pool.query(`
    SELECT o.*, COALESCE(c.email, o.guest_email) as customer_email
    FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = $1
  `, [orderId]);
  const updO = updatedOrderResult.rows[0];
  res.json({ id: updO.id, orderNumber: updO.order_number, status: updO.status, requiresManualReview: updO.requires_manual_review });
});

// ── /admin/returns ────────────────────────────────────────────────────────────

router.get("/returns", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const { status, limit = "50", offset = "0" } = req.query as any;
  const rows = await pool.query(`
    SELECT r.*, o.order_number, COALESCE(c.email, o.guest_email) as customer_email,
           COALESCE(CONCAT(c.first_name, ' ', c.last_name), '') as customer_name,
           COUNT(ri.id) as item_count
    FROM returns r
    JOIN orders o ON o.id = r.order_id
    LEFT JOIN customers c ON c.id = r.customer_id
    LEFT JOIN return_items ri ON ri.return_id = r.id
    ${status ? "WHERE r.status = $1" : ""}
    GROUP BY r.id, o.order_number, c.email, c.first_name, c.last_name, o.guest_email
    ORDER BY r.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
  `, status ? [status] : []);

  const countRow = await pool.query(`SELECT COUNT(*) FROM returns r ${status ? "WHERE r.status = $1" : ""}`, status ? [status] : []);

  res.json({
    returns: rows.rows.map((r: any) => ({
      id: r.id, orderNumber: r.order_number, customerEmail: r.customer_email,
      customerName: r.customer_name?.trim() || null, status: r.status, reason: r.reason,
      preferExchange: r.prefer_exchange, refundAmountInCents: r.refund_amount_in_cents,
      itemCount: parseInt(r.item_count), createdAt: r.created_at?.toISOString(),
    })),
    total: parseInt(countRow.rows[0].count),
  });
});

router.get("/returns/:returnId", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const returnId = parseInt(req.params.returnId);
  const [retRow, itemRows] = await Promise.all([
    pool.query(`
      SELECT r.*, o.order_number, COALESCE(c.email, o.guest_email) as customer_email
      FROM returns r
      JOIN orders o ON o.id = r.order_id
      LEFT JOIN customers c ON c.id = r.customer_id
      WHERE r.id = $1
    `, [returnId]),
    pool.query(`
      SELECT ri.*, oi.product_name, oi.variant_sku, oi.quantity as ordered_qty
      FROM return_items ri JOIN order_items oi ON oi.id = ri.order_item_id
      WHERE ri.return_id = $1
    `, [returnId]),
  ]);
  if (!retRow.rows[0]) return res.status(404).json({ error: "Return not found" });
  const r = retRow.rows[0];
  res.json({
    id: r.id, orderNumber: r.order_number, orderId: r.order_id, customerId: r.customer_id,
    customerEmail: r.customer_email, status: r.status, reason: r.reason,
    preferExchange: r.prefer_exchange, refundAmountInCents: r.refund_amount_in_cents,
    notes: r.notes,
    items: itemRows.rows.map((i: any) => ({
      id: i.id, returnId: i.return_id, orderItemId: i.order_item_id,
      productName: i.product_name, variantSku: i.variant_sku,
      quantity: i.quantity, reason: i.reason ?? r.reason, notes: i.notes,
    })),
    processedAt: r.processed_at?.toISOString() ?? null, createdAt: r.created_at?.toISOString(),
  });
});

router.post("/returns/:returnId/actions", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  const returnId = parseInt(req.params.returnId);
  const { action, refundAmountInCents, notes } = req.body as any;

  const [ret] = await db.select().from(returnsTable).where(eq(returnsTable.id, returnId));
  if (!ret) return res.status(404).json({ error: "Return not found" });

  let newStatus = ret.status;
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (action === "approve") { newStatus = "approved"; }
  else if (action === "deny") { newStatus = "denied"; updates.processedAt = new Date(); }
  else if (action === "receive_items") { newStatus = "received"; }
  else if (action === "issue_refund") {
    // Issue Stripe refund
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, ret.orderId));
    if (order?.stripePaymentIntentId) {
      try {
        await getStripe().refunds.create({
          payment_intent: order.stripePaymentIntentId,
          ...(refundAmountInCents ? { amount: refundAmountInCents } : {}),
          reason: "requested_by_customer",
        });
      } catch (e: any) {
        return res.status(400).json({ error: `Stripe refund failed: ${e.message}` });
      }
    }
    newStatus = "refunded";
    updates.refundAmountInCents = refundAmountInCents ?? ret.refundAmountInCents;
    updates.processedAt = new Date();
  } else if (action === "issue_exchange") {
    newStatus = "exchanged"; updates.processedAt = new Date();
  } else {
    return res.status(400).json({ error: "Unknown action" });
  }

  if (notes) updates.notes = notes;
  updates.status = newStatus;
  await db.update(returnsTable).set(updates as any).where(eq(returnsTable.id, returnId));
  await logActivity({ actor: req.adminUser, action: `return.${action}`, entityType: "return", entityId: String(returnId) });

  const updatedRetResult = await pool.query(`
    SELECT r.*, o.order_number, COALESCE(c.email, o.guest_email) as customer_email
    FROM returns r JOIN orders o ON o.id = r.order_id LEFT JOIN customers c ON c.id = r.customer_id
    WHERE r.id = $1
  `, [returnId]);
  const r = updatedRetResult.rows[0];
  res.json({ id: r.id, orderNumber: r.order_number, status: r.status, reason: r.reason, createdAt: r.created_at?.toISOString() });
});

// ── /admin/products ───────────────────────────────────────────────────────────

router.get("/products", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const { status, search, limit = "50", offset = "0" } = req.query as any;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (status) { conditions.push(`p.status = $${p++}`); params.push(status); }
  if (search) { conditions.push(`(p.name ILIKE $${p} OR p.slug ILIKE $${p})`); params.push(`%${search}%`); p++; }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows, countRow] = await Promise.all([
    pool.query(`
      SELECT p.id, p.slug, p.name, p.theme, p.status, p.is_featured, p.created_at,
             COUNT(DISTINCT pv.id) as variant_count,
             COALESCE(SUM(pv.stock_quantity),0) as total_stock,
             MIN(pv.price_in_cents) as price_min, MAX(pv.price_in_cents) as price_max,
             (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = true LIMIT 1) as primary_image_url,
             ARRAY_AGG(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL) as collections
      FROM products p
      LEFT JOIN product_variants pv ON pv.product_id = p.id
      LEFT JOIN product_collections pc ON pc.product_id = p.id
      LEFT JOIN collections c ON c.id = pc.collection_id
      ${where}
      GROUP BY p.id ORDER BY p.created_at DESC
      LIMIT $${p} OFFSET $${p + 1}
    `, [...params, parseInt(limit), parseInt(offset)]),
    pool.query(`SELECT COUNT(*) FROM products p ${where}`, params),
  ]);

  res.json({
    products: rows.rows.map((r: any) => ({
      id: r.id, slug: r.slug, name: r.name, theme: r.theme, status: r.status,
      isFeatured: r.is_featured, variantCount: parseInt(r.variant_count),
      totalStock: parseInt(r.total_stock), priceMin: r.price_min ? parseInt(r.price_min) : 0,
      priceMax: r.price_max ? parseInt(r.price_max) : 0, primaryImageUrl: r.primary_image_url,
      collections: r.collections?.filter(Boolean) ?? [], createdAt: r.created_at?.toISOString(),
    })),
    total: parseInt(countRow.rows[0].count),
  });
});

router.post("/products", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  const { collectionIds, ...productData } = req.body;
  const [product] = await db.insert(productsTable).values(productData).returning();

  if (collectionIds?.length) {
    for (const cid of collectionIds) {
      await db.insert(productCollectionsTable).values({ productId: product.id, collectionId: cid }).onConflictDoNothing();
    }
  }

  await logActivity({ actor: req.adminUser, action: "product.created", entityType: "product", entityId: String(product.id), entityLabel: product.name });
  const detail = await getProductDetail(product.id);
  res.status(201).json(detail);
});

async function getProductDetail(productId: number) {
  const [productRow, variantRows, imageRows, colRows] = await Promise.all([
    pool.query("SELECT * FROM products WHERE id = $1", [productId]),
    pool.query("SELECT * FROM product_variants WHERE product_id = $1 ORDER BY sort_order, id", [productId]),
    pool.query("SELECT * FROM product_images WHERE product_id = $1 ORDER BY position, id", [productId]),
    pool.query(`SELECT c.* FROM collections c JOIN product_collections pc ON pc.collection_id = c.id WHERE pc.product_id = $1`, [productId]),
  ]);
  if (!productRow.rows[0]) return null;
  const p = productRow.rows[0];
  return {
    id: p.id, slug: p.slug, name: p.name, theme: p.theme, description: p.description,
    materials: p.materials, benefits: p.benefits, shippingInfo: p.shipping_info, returnsInfo: p.returns_info,
    status: p.status, isFeatured: p.is_featured, sortOrder: p.sort_order,
    weightGrams: p.weight_grams, dimensionsCm: p.dimensions_cm, hsCode: p.hs_code, countryOfOrigin: p.country_of_origin,
    customsDescription: p.customs_description, customsValueCents: p.customs_value_cents,
    variants: variantRows.rows.map((v: any) => ({
      id: v.id, sku: v.sku, size: v.size, color: v.color,
      priceInCents: v.price_in_cents, compareAtPriceInCents: v.compare_at_price_in_cents,
      stockQuantity: v.stock_quantity, reservedQuantity: v.reserved_quantity,
      availableQuantity: Math.max(0, v.stock_quantity - v.reserved_quantity),
      imageUrl: v.image_url, active: v.active, sortOrder: v.sort_order,
    })),
    images: imageRows.rows.map((i: any) => ({ id: i.id, url: i.url, altText: i.alt_text, position: i.position })),
    collections: colRows.rows.map((c: any) => ({ id: c.id, slug: c.slug, name: c.name, description: c.description, imageUrl: c.image_url, productCount: 0 })),
    createdAt: p.created_at?.toISOString(), updatedAt: p.updated_at?.toISOString(),
  };
}

router.get("/products/:productId", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const detail = await getProductDetail(parseInt(req.params.productId));
  if (!detail) return res.status(404).json({ error: "Product not found" });
  res.json(detail);
});

router.patch("/products/:productId", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  const productId = parseInt(req.params.productId);
  const { collectionIds, ...updates } = req.body;
  await db.update(productsTable).set({ ...updates, updatedAt: new Date() }).where(eq(productsTable.id, productId));

  if (collectionIds !== undefined) {
    await db.delete(productCollectionsTable).where(eq(productCollectionsTable.productId, productId));
    for (const cid of collectionIds) {
      await db.insert(productCollectionsTable).values({ productId, collectionId: cid }).onConflictDoNothing();
    }
  }

  await logActivity({ actor: req.adminUser, action: "product.updated", entityType: "product", entityId: String(productId) });
  const detail = await getProductDetail(productId);
  if (!detail) return res.status(404).json({ error: "Product not found" });
  res.json(detail);
});

router.post("/products/:productId/actions", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  const productId = parseInt(req.params.productId);
  const { action } = req.body as { action: string };
  const statusMap: Record<string, string> = { publish: "active", unpublish: "draft", archive: "archived", restore: "draft" };
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (statusMap[action]) updates.status = statusMap[action];
  if (action === "feature") updates.isFeatured = true;
  if (action === "unfeature") updates.isFeatured = false;
  await db.update(productsTable).set(updates as any).where(eq(productsTable.id, productId));
  await logActivity({ actor: req.adminUser, action: `product.${action}`, entityType: "product", entityId: String(productId) });
  const detail = await getProductDetail(productId);
  if (!detail) return res.status(404).json({ error: "Product not found" });
  res.json(detail);
});

router.post("/products/:productId/variants", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  const productId = parseInt(req.params.productId);
  const [variant] = await db.insert(productVariantsTable).values({ ...req.body, productId }).returning();
  res.status(201).json({
    id: variant.id, sku: variant.sku, size: variant.size, color: variant.color,
    priceInCents: variant.priceInCents, compareAtPriceInCents: variant.compareAtPriceInCents,
    stockQuantity: variant.stockQuantity, reservedQuantity: variant.reservedQuantity,
    availableQuantity: Math.max(0, variant.stockQuantity - variant.reservedQuantity),
    imageUrl: variant.imageUrl, active: variant.active, sortOrder: variant.sortOrder,
  });
});

router.patch("/products/:productId/variants/:variantId", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  const variantId = parseInt(req.params.variantId);
  const [v] = await db.update(productVariantsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(productVariantsTable.id, variantId)).returning();
  if (!v) return res.status(404).json({ error: "Variant not found" });
  res.json({ id: v.id, sku: v.sku, size: v.size, color: v.color, priceInCents: v.priceInCents, stockQuantity: v.stockQuantity, reservedQuantity: v.reservedQuantity, availableQuantity: Math.max(0, v.stockQuantity - v.reservedQuantity), imageUrl: v.imageUrl, active: v.active, sortOrder: v.sortOrder });
});

router.delete("/products/:productId/variants/:variantId", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  await db.delete(productVariantsTable).where(eq(productVariantsTable.id, parseInt(req.params.variantId)));
  res.status(204).send();
});

router.post("/products/:productId/images", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  const productId = parseInt(req.params.productId);
  const [img] = await db.insert(productImagesTable).values({ ...req.body, productId }).returning();
  res.status(201).json({ id: img.id, url: img.url, altText: img.altText, position: img.position });
});

router.delete("/products/:productId/images/:imageId", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  await db.delete(productImagesTable).where(and(eq(productImagesTable.id, parseInt(req.params.imageId)), eq(productImagesTable.productId, parseInt(req.params.productId))));
  res.status(204).send();
});

// ── /admin/inventory ──────────────────────────────────────────────────────────

router.get("/inventory", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const { filter, search, limit = "100", offset = "0" } = req.query as any;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (filter === "low_stock") { conditions.push(`pv.stock_quantity > 0 AND pv.stock_quantity <= 5`); }
  else if (filter === "out_of_stock") { conditions.push(`pv.stock_quantity = 0 AND pv.active = true`); }
  if (search) { conditions.push(`(p.name ILIKE $${p} OR pv.sku ILIKE $${p})`); params.push(`%${search}%`); p++; }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows, countRow, lowRow, outRow] = await Promise.all([
    pool.query(`
      SELECT pv.id as variant_id, pv.product_id, p.name as product_name,
             pv.sku, pv.size, pv.color, pv.stock_quantity, pv.reserved_quantity,
             pv.image_url,
             (pv.stock_quantity - pv.reserved_quantity) as available_quantity,
             CASE WHEN pv.stock_quantity > 0 AND pv.stock_quantity <= 5 THEN true ELSE false END as is_low_stock,
             CASE WHEN pv.stock_quantity = 0 AND pv.active = true THEN true ELSE false END as is_out_of_stock
      FROM product_variants pv JOIN products p ON p.id = pv.product_id
      ${where}
      ORDER BY p.name, pv.sku
      LIMIT $${p} OFFSET $${p + 1}
    `, [...params, parseInt(limit), parseInt(offset)]),
    pool.query(`SELECT COUNT(*) FROM product_variants pv JOIN products p ON p.id = pv.product_id ${where}`, params),
    pool.query("SELECT COUNT(*) FROM product_variants WHERE stock_quantity > 0 AND stock_quantity <= 5"),
    pool.query("SELECT COUNT(*) FROM product_variants WHERE stock_quantity = 0 AND active = true"),
  ]);

  res.json({
    items: rows.rows.map((r: any) => ({
      variantId: r.variant_id, productId: r.product_id, productName: r.product_name,
      sku: r.sku, size: r.size, color: r.color, stockQuantity: parseInt(r.stock_quantity),
      reservedQuantity: parseInt(r.reserved_quantity), availableQuantity: Math.max(0, parseInt(r.available_quantity)),
      isLowStock: r.is_low_stock, isOutOfStock: r.is_out_of_stock, imageUrl: r.image_url,
    })),
    total: parseInt(countRow.rows[0].count),
    lowStockCount: parseInt(lowRow.rows[0].count),
    outOfStockCount: parseInt(outRow.rows[0].count),
  });
});

router.post("/inventory/adjust", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  const { variantId, quantity, notes } = req.body as { variantId: number; quantity: number; notes: string };
  const [variant] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, variantId));
  if (!variant) return res.status(404).json({ error: "Variant not found" });

  const newStock = variant.stockQuantity + quantity;
  if (newStock < 0) return res.status(400).json({ error: "Adjustment would result in negative stock" });

  await db.update(productVariantsTable).set({ stockQuantity: newStock, updatedAt: new Date() }).where(eq(productVariantsTable.id, variantId));
  await db.insert(inventoryTransactionsTable).values({
    variantId, type: "adjustment", quantity, previousStock: variant.stockQuantity, newStock, referenceType: "admin", notes,
  });

  await logActivity({ actor: req.adminUser, action: "inventory.adjusted", entityType: "variant", entityId: String(variantId), entityLabel: variant.sku, details: { quantity, newStock, notes } });

  const pResult = await pool.query("SELECT p.name FROM products p JOIN product_variants pv ON pv.product_id = p.id WHERE pv.id = $1", [variantId]);
  res.json({
    variantId, productId: variant.productId, productName: pResult?.rows[0]?.name ?? "",
    sku: variant.sku, size: variant.size, color: variant.color,
    stockQuantity: newStock, reservedQuantity: variant.reservedQuantity,
    availableQuantity: Math.max(0, newStock - variant.reservedQuantity),
    isLowStock: newStock > 0 && newStock <= 5, isOutOfStock: newStock === 0, imageUrl: variant.imageUrl,
  });
});

router.get("/inventory/history", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const { variantId, type, limit = "50", offset = "0" } = req.query as any;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (variantId) { conditions.push(`it.variant_id = $${p++}`); params.push(parseInt(variantId)); }
  if (type) { conditions.push(`it.type = $${p++}`); params.push(type); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows, countRow] = await Promise.all([
    pool.query(`
      SELECT it.*, pv.sku, p.name as product_name
      FROM inventory_transactions it
      JOIN product_variants pv ON pv.id = it.variant_id
      JOIN products p ON p.id = pv.product_id
      ${where} ORDER BY it.created_at DESC
      LIMIT $${p} OFFSET $${p + 1}
    `, [...params, parseInt(limit), parseInt(offset)]),
    pool.query(`SELECT COUNT(*) FROM inventory_transactions it ${where}`, params),
  ]);

  res.json({
    transactions: rows.rows.map((r: any) => ({
      id: r.id, variantId: r.variant_id, productName: r.product_name, sku: r.sku,
      type: r.type, quantity: r.quantity, previousStock: r.previous_stock, newStock: r.new_stock,
      referenceType: r.reference_type, referenceId: r.reference_id, notes: r.notes,
      createdAt: r.created_at?.toISOString(),
    })),
    total: parseInt(countRow.rows[0].count),
  });
});

// ── /admin/customers ──────────────────────────────────────────────────────────

router.get("/customers", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const { search, limit = "50", offset = "0" } = req.query as any;
  const where = search ? `WHERE c.email ILIKE $1 OR c.first_name ILIKE $1 OR c.last_name ILIKE $1` : "";
  const params = search ? [`%${search}%`] : [];

  const [rows, countRow] = await Promise.all([
    pool.query(`
      SELECT c.id, c.email, c.first_name, c.last_name, c.phone, c.status, c.marketing_consent, c.created_at,
             COUNT(DISTINCT o.id) as order_count,
             COALESCE(SUM(o.total_in_cents) FILTER (WHERE o.status != 'cancelled'), 0) as total_spent
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      ${where}
      GROUP BY c.id ORDER BY c.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `, params),
    pool.query(`SELECT COUNT(*) FROM customers c ${where}`, params),
  ]);

  res.json({
    customers: rows.rows.map((r: any) => ({
      id: r.id, email: r.email, firstName: r.first_name, lastName: r.last_name, phone: r.phone,
      orderCount: parseInt(r.order_count), totalSpentInCents: parseInt(r.total_spent),
      status: r.status, marketingConsent: r.marketing_consent, createdAt: r.created_at?.toISOString(),
    })),
    total: parseInt(countRow.rows[0].count),
  });
});

router.get("/customers/:customerId", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const customerId = parseInt(req.params.customerId);
  const [customerRow, ordersRow] = await Promise.all([
    pool.query(`
      SELECT c.*, COUNT(DISTINCT o.id) as order_count,
             COALESCE(SUM(o.total_in_cents) FILTER (WHERE o.status != 'cancelled'), 0) as total_spent
      FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
      WHERE c.id = $1 GROUP BY c.id
    `, [customerId]),
    pool.query(`
      SELECT o.id, o.order_number, o.status, o.total_in_cents, o.currency, o.created_at,
             COUNT(oi.id) as item_count
      FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.customer_id = $1 GROUP BY o.id ORDER BY o.created_at DESC LIMIT 20
    `, [customerId]),
  ]);

  if (!customerRow.rows[0]) return res.status(404).json({ error: "Customer not found" });
  const c = customerRow.rows[0];
  res.json({
    id: c.id, clerkUserId: c.clerk_user_id, email: c.email, firstName: c.first_name, lastName: c.last_name,
    phone: c.phone, status: c.status, marketingConsent: c.marketing_consent,
    orderCount: parseInt(c.order_count), totalSpentInCents: parseInt(c.total_spent),
    recentOrders: ordersRow.rows.map((o: any) => ({
      id: o.id, orderNumber: o.order_number, status: o.status, totalInCents: o.total_in_cents,
      currency: o.currency ?? "usd", customerEmail: c.email, customerName: null,
      itemCount: parseInt(o.item_count), requiresManualReview: false, stripeRiskLevel: null, trackingNumber: null,
      createdAt: o.created_at?.toISOString(),
    })),
    createdAt: c.created_at?.toISOString(),
  });
});

// ── /admin/discounts ──────────────────────────────────────────────────────────

router.get("/discounts", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const discounts = await db.select().from(discountsTable).orderBy(desc(discountsTable.createdAt));
  res.json(discounts.map((d) => ({
    id: d.id, code: d.code, discountType: d.discountType, value: d.value,
    active: d.active, minimumOrderInCents: d.minimumOrderInCents, maxUses: d.maxUses,
    usedCount: d.usedCount, expiresAt: d.expiresAt?.toISOString() ?? null, createdAt: d.createdAt.toISOString(),
  })));
});

router.post("/discounts", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  const { expiresAt, ...rest } = req.body;
  const [d] = await db.insert(discountsTable).values({ ...rest, ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}) }).returning();
  await logActivity({ actor: req.adminUser, action: "discount.created", entityType: "discount", entityLabel: d.code });
  res.status(201).json({ id: d.id, code: d.code, discountType: d.discountType, value: d.value, active: d.active, minimumOrderInCents: d.minimumOrderInCents, maxUses: d.maxUses, usedCount: d.usedCount, expiresAt: d.expiresAt?.toISOString() ?? null, createdAt: d.createdAt.toISOString() });
});

router.patch("/discounts/:discountId", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  const { expiresAt, ...rest } = req.body;
  const [d] = await db.update(discountsTable)
    .set({ ...rest, ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}) })
    .where(eq(discountsTable.id, parseInt(req.params.discountId))).returning();
  if (!d) return res.status(404).json({ error: "Discount not found" });
  res.json({ id: d.id, code: d.code, discountType: d.discountType, value: d.value, active: d.active, minimumOrderInCents: d.minimumOrderInCents, maxUses: d.maxUses, usedCount: d.usedCount, expiresAt: d.expiresAt?.toISOString() ?? null, createdAt: d.createdAt.toISOString() });
});

router.delete("/discounts/:discountId", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  const [d] = await db.delete(discountsTable).where(eq(discountsTable.id, parseInt(req.params.discountId))).returning();
  if (!d) return res.status(404).json({ error: "Discount not found" });
  res.status(204).send();
});

// ── /admin/shipping ───────────────────────────────────────────────────────────

async function getZoneWithRates(zoneId: number) {
  const [zoneRow, rateRows] = await Promise.all([
    db.select().from(shippingZonesTable).where(eq(shippingZonesTable.id, zoneId)),
    db.select().from(shippingRatesTable).where(eq(shippingRatesTable.zoneId, zoneId)).orderBy(asc(shippingRatesTable.id)),
  ]);
  if (!zoneRow[0]) return null;
  const z = zoneRow[0];
  return {
    id: z.id, name: z.name, countries: z.countries, active: z.active, sortOrder: z.sortOrder,
    rates: rateRows.map((r) => ({ id: r.id, name: r.name, description: r.description, rateType: r.rateType, priceInCents: r.priceInCents, minimumOrderInCents: r.minimumOrderInCents, estimatedDays: r.estimatedDays, active: r.active })),
  };
}

router.get("/shipping/zones", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const zones = await db.select().from(shippingZonesTable).orderBy(asc(shippingZonesTable.sortOrder));
  const result = await Promise.all(zones.map((z) => getZoneWithRates(z.id)));
  res.json(result.filter(Boolean));
});

router.post("/shipping/zones", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  const [z] = await db.insert(shippingZonesTable).values(req.body).returning();
  res.status(201).json(await getZoneWithRates(z.id));
});

router.patch("/shipping/zones/:zoneId", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  const zoneId = parseInt(req.params.zoneId);
  await db.update(shippingZonesTable).set({ ...req.body, updatedAt: new Date() }).where(eq(shippingZonesTable.id, zoneId));
  res.json(await getZoneWithRates(zoneId));
});

router.delete("/shipping/zones/:zoneId", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  await db.delete(shippingZonesTable).where(eq(shippingZonesTable.id, parseInt(req.params.zoneId)));
  res.status(204).send();
});

router.post("/shipping/zones/:zoneId/rates", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  const zoneId = parseInt(req.params.zoneId);
  const [r] = await db.insert(shippingRatesTable).values({ ...req.body, zoneId }).returning();
  res.status(201).json({ id: r.id, name: r.name, description: r.description, rateType: r.rateType, priceInCents: r.priceInCents, minimumOrderInCents: r.minimumOrderInCents, estimatedDays: r.estimatedDays, active: r.active, carrierCode: r.carrierCode, serviceCode: r.serviceCode });
});

router.patch("/shipping/zones/:zoneId/rates/:rateId", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  const [r] = await db.update(shippingRatesTable).set(req.body).where(eq(shippingRatesTable.id, parseInt(req.params.rateId))).returning();
  if (!r) return res.status(404).json({ error: "Rate not found" });
  res.json({ id: r.id, name: r.name, description: r.description, rateType: r.rateType, priceInCents: r.priceInCents, minimumOrderInCents: r.minimumOrderInCents, estimatedDays: r.estimatedDays, active: r.active, carrierCode: r.carrierCode, serviceCode: r.serviceCode });
});

router.delete("/shipping/zones/:zoneId/rates/:rateId", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  await db.delete(shippingRatesTable).where(eq(shippingRatesTable.id, parseInt(req.params.rateId)));
  res.status(204).send();
});

// ── /admin/support ────────────────────────────────────────────────────────────

router.get("/support", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const { status, search, limit = "50", offset = "0" } = req.query as any;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;
  if (status) { conditions.push(`s.status = $${p++}`); params.push(status); }
  if (search) { conditions.push(`(s.email ILIKE $${p} OR s.subject ILIKE $${p})`); params.push(`%${search}%`); p++; }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows, countRow] = await Promise.all([
    pool.query(`
      SELECT s.*, o.order_number FROM support_requests s
      LEFT JOIN orders o ON o.id = s.order_id
      ${where} ORDER BY s.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `, params),
    pool.query(`SELECT COUNT(*) FROM support_requests s ${where}`, params),
  ]);

  res.json({
    tickets: rows.rows.map((t: any) => ({
      id: t.id, customerId: t.customer_id, orderId: t.order_id, email: t.email, name: t.name,
      subject: t.subject, message: t.message, status: t.status, priority: t.priority,
      assignedTo: t.assigned_to, orderNumber: t.order_number,
      createdAt: t.created_at?.toISOString(), updatedAt: t.updated_at?.toISOString(),
    })),
    total: parseInt(countRow.rows[0].count),
  });
});

router.get("/support/:ticketId", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const [rows] = await Promise.all([
    pool.query("SELECT s.*, o.order_number FROM support_requests s LEFT JOIN orders o ON o.id = s.order_id WHERE s.id = $1", [parseInt(req.params.ticketId)]),
  ]);
  if (!rows.rows[0]) return res.status(404).json({ error: "Ticket not found" });
  const t = rows.rows[0];
  res.json({ id: t.id, customerId: t.customer_id, orderId: t.order_id, email: t.email, name: t.name, subject: t.subject, message: t.message, status: t.status, priority: t.priority, assignedTo: t.assigned_to, orderNumber: t.order_number, createdAt: t.created_at?.toISOString(), updatedAt: t.updated_at?.toISOString() });
});

router.patch("/support/:ticketId", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const { status, priority, assignedTo } = req.body as any;
  const [t] = await db.update(supportRequestsTable)
    .set({ ...(status ? { status } : {}), ...(priority ? { priority } : {}), ...(assignedTo !== undefined ? { assignedTo } : {}), updatedAt: new Date() })
    .where(eq(supportRequestsTable.id, parseInt(req.params.ticketId))).returning();
  if (!t) return res.status(404).json({ error: "Ticket not found" });
  res.json({ id: t.id, email: t.email, subject: t.subject, status: t.status, priority: t.priority, assignedTo: t.assignedTo, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() });
});

// ── /admin/reviews ────────────────────────────────────────────────────────────

router.get("/reviews", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const { isApproved, limit = "50", offset = "0" } = req.query as any;
  const where = isApproved !== undefined ? `WHERE r.is_approved = ${isApproved === "true" ? "true" : "false"}` : "";
  const [rows, countRow] = await Promise.all([
    pool.query(`
      SELECT r.*, p.name as product_name FROM reviews r
      JOIN products p ON p.id = r.product_id
      ${where} ORDER BY r.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `),
    pool.query(`SELECT COUNT(*) FROM reviews r ${where}`),
  ]);
  res.json({
    reviews: rows.rows.map((r: any) => ({
      id: r.id, productId: r.product_id, productName: r.product_name, orderId: r.order_id,
      rating: r.rating, title: r.title, body: r.body, reviewerName: r.reviewer_name,
      isVerified: r.is_verified, isApproved: r.is_approved, createdAt: r.created_at?.toISOString(),
    })),
    total: parseInt(countRow.rows[0].count),
  });
});

router.post("/reviews/:reviewId/actions", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const reviewId = parseInt(req.params.reviewId);
  const { action } = req.body as { action: string };
  const isApproved = action === "approve";
  const [r] = await db.update(reviewsTable).set({ isApproved }).where(eq(reviewsTable.id, reviewId)).returning();
  if (!r) return res.status(404).json({ error: "Review not found" });
  await logActivity({ actor: req.adminUser, action: `review.${action}`, entityType: "review", entityId: String(reviewId) });
  const pResult2 = await pool.query("SELECT name FROM products WHERE id = $1", [r.productId]);
  res.json({ id: r.id, productId: r.productId, productName: pResult2?.rows[0]?.name ?? null, orderId: r.orderId, rating: r.rating, title: r.title, body: r.body, reviewerName: r.reviewerName, isVerified: r.isVerified, isApproved: r.isApproved, createdAt: r.createdAt.toISOString() });
});

// ── /admin/content ────────────────────────────────────────────────────────────

router.get("/content/pages", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const pages = await db.select().from(websitePagesTable).orderBy(asc(websitePagesTable.key));
  res.json(pages.map((p) => ({ id: p.id, key: p.key, title: p.title, body: p.body, isPublished: p.isPublished, updatedAt: p.updatedAt.toISOString() })));
});

router.get("/content/pages/:pageKey", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const [p] = await db.select().from(websitePagesTable).where(eq(websitePagesTable.key, req.params.pageKey));
  if (!p) return res.status(404).json({ error: "Page not found" });
  res.json({ id: p.id, key: p.key, title: p.title, body: p.body, isPublished: p.isPublished, updatedAt: p.updatedAt.toISOString() });
});

router.patch("/content/pages/:pageKey", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  const [p] = await db.update(websitePagesTable).set({ ...req.body, updatedAt: new Date() }).where(eq(websitePagesTable.key, req.params.pageKey)).returning();
  if (!p) return res.status(404).json({ error: "Page not found" });
  await logActivity({ actor: req.adminUser, action: "content.page.updated", entityType: "page", entityLabel: p.key });
  res.json({ id: p.id, key: p.key, title: p.title, body: p.body, isPublished: p.isPublished, updatedAt: p.updatedAt.toISOString() });
});

router.get("/content/homepage", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const sections = await db.select().from(homepageSectionsTable).orderBy(asc(homepageSectionsTable.position));
  res.json(sections.map((s) => ({ id: s.id, key: s.key, sectionType: s.sectionType, title: s.title, subtitle: s.subtitle, position: s.position, active: s.active })));
});

router.put("/content/homepage", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  const { sections } = req.body as { sections: { id: number; position: number; active: boolean }[] };
  for (const s of sections) {
    await db.update(homepageSectionsTable).set({ position: s.position, active: s.active, updatedAt: new Date() }).where(eq(homepageSectionsTable.id, s.id));
  }
  const updated = await db.select().from(homepageSectionsTable).orderBy(asc(homepageSectionsTable.position));
  res.json(updated.map((s) => ({ id: s.id, key: s.key, sectionType: s.sectionType, title: s.title, subtitle: s.subtitle, position: s.position, active: s.active })));
});

router.get("/content/settings", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const settings = await db.select().from(siteSettingsTable);
  const map: Record<string, string | null> = {};
  for (const s of settings) map[s.key] = s.value;

  res.json({
    businessName: map["businessName"] ?? "Evolve Performance",
    logoUrl: map["logoUrl"] ?? null, faviconUrl: map["faviconUrl"] ?? null,
    supportEmail: map["supportEmail"] ?? "support@evolveperformance.com",
    currency: map["currency"] ?? "USD", defaultCountry: map["defaultCountry"] ?? "CA",
    socialInstagram: map["socialInstagram"] ?? null, socialTiktok: map["socialTiktok"] ?? null,
    socialYoutube: map["socialYoutube"] ?? null, announcementBanner: map["announcementBanner"] ?? null,
  });
});

router.patch("/content/settings", async (req, res, next) => requireAdmin(req, res, next, "manager"), async (req: any, res) => {
  for (const [key, value] of Object.entries(req.body as Record<string, string>)) {
    await pool.query(`
      INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
    `, [key, String(value)]);
  }
  await logActivity({ actor: req.adminUser, action: "content.settings.updated" });

  const settings = await db.select().from(siteSettingsTable);
  const map: Record<string, string | null> = {};
  for (const s of settings) map[s.key] = s.value;
  res.json({
    businessName: map["businessName"] ?? "Evolve Performance",
    logoUrl: map["logoUrl"] ?? null, faviconUrl: map["faviconUrl"] ?? null,
    supportEmail: map["supportEmail"] ?? "support@evolveperformance.com",
    currency: map["currency"] ?? "USD", defaultCountry: map["defaultCountry"] ?? "CA",
    socialInstagram: map["socialInstagram"] ?? null, socialTiktok: map["socialTiktok"] ?? null,
    socialYoutube: map["socialYoutube"] ?? null, announcementBanner: map["announcementBanner"] ?? null,
  });
});

// ── /admin/activity ───────────────────────────────────────────────────────────

router.get("/activity", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const { entityType, entityId, limit = "50", offset = "0" } = req.query as any;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;
  if (entityType) { conditions.push(`entity_type = $${p++}`); params.push(entityType); }
  if (entityId) { conditions.push(`entity_id = $${p++}`); params.push(entityId); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows, countRow] = await Promise.all([
    pool.query(`SELECT * FROM activity_log ${where} ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`, params),
    pool.query(`SELECT COUNT(*) FROM activity_log ${where}`, params),
  ]);

  res.json({
    entries: rows.rows.map((r: any) => ({
      id: r.id, actorName: r.actor_name, actorEmail: r.actor_email,
      action: r.action, entityType: r.entity_type, entityId: r.entity_id,
      entityLabel: r.entity_label, details: r.details, createdAt: r.created_at?.toISOString(),
    })),
    total: parseInt(countRow.rows[0].count),
  });
});

// ── /admin/reports/sales ──────────────────────────────────────────────────────

router.get("/reports/sales", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const { period = "month" } = req.query as any;
  const now = new Date();
  let since: Date;
  switch (period) {
    case "today": since = new Date(now); since.setHours(0, 0, 0, 0); break;
    case "week": since = new Date(now); since.setDate(now.getDate() - 7); break;
    case "month": since = new Date(now); since.setDate(1); since.setHours(0, 0, 0, 0); break;
    case "quarter": since = new Date(now); since.setMonth(now.getMonth() - 3); break;
    case "year": since = new Date(now); since.setFullYear(now.getFullYear() - 1); break;
    default: since = new Date(now); since.setDate(1); since.setHours(0, 0, 0, 0);
  }

  const [totals, topProducts, salesByDay, refunds] = await Promise.all([
    pool.query("SELECT COALESCE(SUM(total_in_cents),0) as total, COUNT(*) as count FROM orders WHERE created_at >= $1 AND status NOT IN ('cancelled')", [since]),
    pool.query(`
      SELECT oi.product_name, COALESCE(SUM(oi.quantity),0) as units_sold, COALESCE(SUM(oi.total_price_in_cents),0) as revenue
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.created_at >= $1 AND o.status NOT IN ('cancelled')
      GROUP BY oi.product_name ORDER BY revenue DESC LIMIT 10
    `, [since]),
    pool.query(`
      SELECT DATE(created_at) as date, COALESCE(SUM(total_in_cents),0) as revenue, COUNT(*) as count
      FROM orders WHERE created_at >= $1 AND status NOT IN ('cancelled')
      GROUP BY DATE(created_at) ORDER BY date ASC
    `, [since]),
    pool.query("SELECT COALESCE(SUM(total_in_cents),0) as total FROM orders WHERE created_at >= $1 AND status = 'refunded'", [since]),
  ]);

  const totalOrders = parseInt(totals.rows[0].count);
  const totalRevenue = parseInt(totals.rows[0].total);

  res.json({
    period,
    totalRevenueInCents: totalRevenue,
    totalOrders,
    avgOrderValueInCents: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
    refundedInCents: parseInt(refunds.rows[0].total),
    topProducts: topProducts.rows.map((r: any) => ({
      productName: r.product_name,
      unitsSold: parseInt(r.units_sold),
      revenueInCents: parseInt(r.revenue),
    })),
    salesByDay: salesByDay.rows.map((r: any) => ({
      date: r.date?.toISOString?.()?.slice(0, 10) ?? String(r.date),
      revenueInCents: parseInt(r.revenue),
      orderCount: parseInt(r.count),
    })),
  });
});

// ── /admin/exports/:exportType ────────────────────────────────────────────────

router.get("/exports/:exportType", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const { exportType } = req.params;
  let csvContent = "";
  let filename = "export.csv";

  try {
    if (exportType === "orders") {
      const rows = await pool.query(`
        SELECT o.order_number, o.status, o.total_in_cents, o.currency, o.created_at,
               COALESCE(c.email, o.guest_email) as email
        FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
        ORDER BY o.created_at DESC LIMIT 10000
      `);
      csvContent = "Order Number,Status,Total (cents),Currency,Customer Email,Created\n" +
        rows.rows.map((r: any) => `${r.order_number},${r.status},${r.total_in_cents},${r.currency},${r.email ?? ""},${r.created_at?.toISOString()}`).join("\n");
      filename = "orders.csv";
    } else if (exportType === "customers") {
      const rows = await pool.query("SELECT email, first_name, last_name, phone, status, created_at FROM customers ORDER BY created_at DESC LIMIT 10000");
      csvContent = "Email,First Name,Last Name,Phone,Status,Created\n" +
        rows.rows.map((r: any) => `${r.email},${r.first_name ?? ""},${r.last_name ?? ""},${r.phone ?? ""},${r.status},${r.created_at?.toISOString()}`).join("\n");
      filename = "customers.csv";
    } else if (exportType === "inventory") {
      const rows = await pool.query("SELECT pv.sku, p.name, pv.size, pv.color, pv.stock_quantity, pv.reserved_quantity FROM product_variants pv JOIN products p ON p.id = pv.product_id ORDER BY p.name, pv.sku LIMIT 10000");
      csvContent = "SKU,Product,Size,Color,Stock,Reserved\n" +
        rows.rows.map((r: any) => `${r.sku},${r.name},${r.size ?? ""},${r.color ?? ""},${r.stock_quantity},${r.reserved_quantity}`).join("\n");
      filename = "inventory.csv";
    } else if (exportType === "products") {
      const rows = await pool.query("SELECT slug, name, status, is_featured, created_at FROM products ORDER BY created_at DESC LIMIT 10000");
      csvContent = "Slug,Name,Status,Featured,Created\n" +
        rows.rows.map((r: any) => `${r.slug},${r.name},${r.status},${r.is_featured},${r.created_at?.toISOString()}`).join("\n");
      filename = "products.csv";
    } else {
      return res.status(400).json({ error: "Unknown export type" });
    }
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csvContent);
});

// ── /admin/fulfillment ────────────────────────────────────────────────────────

function mapAdminShipment(s: any, events: any[] = []) {
  return {
    id: s.id, orderId: s.order_id, status: s.status, carrier: s.carrier, carrierCode: s.carrier_code,
    serviceCode: s.service_code, trackingNumber: s.tracking_number, trackingUrl: s.tracking_url,
    labelUrl: s.label_url, shipstationShipmentId: s.shipstation_shipment_id,
    estimatedDelivery: s.estimated_delivery,
    shippedAt: s.shipped_at?.toISOString() ?? null, deliveredAt: s.delivered_at?.toISOString() ?? null,
    pushAttempts: s.push_attempts ?? 0, lastPushError: s.last_push_error,
    lastPushAt: s.last_push_at?.toISOString() ?? null,
    events: events.map((e: any) => ({
      id: e.id, eventType: e.event_type, description: e.description,
      location: e.location, occurredAt: e.occurred_at?.toISOString(),
    })),
    createdAt: s.created_at?.toISOString(),
  };
}

router.get("/fulfillment/status", async (req, res, next) => requireAdmin(req, res, next), async (_req: any, res) => {
  const [health, counts] = await Promise.all([shipstation.checkConnection(), getFulfillmentCounts()]);
  res.json({
    connected: health.connected,
    healthy: health.healthy,
    testMode: shipstation.isTestMode(),
    message: health.message,
    carrierCount: health.carrierCount,
    ...counts,
  });
});

router.get("/shipments", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const { status, search, limit = "50", offset = "0" } = req.query as any;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;
  if (status) { conditions.push(`s.status = $${p++}`); params.push(status); }
  if (search) {
    conditions.push(`(o.order_number ILIKE $${p} OR c.email ILIKE $${p} OR o.guest_email ILIKE $${p} OR s.tracking_number ILIKE $${p})`);
    params.push(`%${search}%`); p++;
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows, countRow] = await Promise.all([
    pool.query(`
      SELECT s.*, o.order_number, COALESCE(c.email, o.guest_email) AS customer_email,
             o.shipping_address->>'countryCode' AS destination_country
      FROM shipments s
      JOIN orders o ON o.id = s.order_id
      LEFT JOIN customers c ON c.id = o.customer_id
      ${where} ORDER BY s.created_at DESC LIMIT $${p} OFFSET $${p + 1}
    `, [...params, parseInt(limit), parseInt(offset)]),
    pool.query(`SELECT COUNT(*) FROM shipments s JOIN orders o ON o.id = s.order_id LEFT JOIN customers c ON c.id = o.customer_id ${where}`, params),
  ]);
  res.json({
    shipments: rows.rows.map((s: any) => ({
      id: s.id, orderId: s.order_id, orderNumber: s.order_number, customerEmail: s.customer_email,
      destinationCountry: s.destination_country, status: s.status, carrier: s.carrier,
      serviceCode: s.service_code, trackingNumber: s.tracking_number, trackingUrl: s.tracking_url,
      labelUrl: s.label_url, pushAttempts: s.push_attempts ?? 0, lastPushError: s.last_push_error,
      shippedAt: s.shipped_at?.toISOString() ?? null, deliveredAt: s.delivered_at?.toISOString() ?? null,
      createdAt: s.created_at?.toISOString(),
    })),
    total: parseInt(countRow.rows[0].count),
  });
});

router.post("/orders/:orderId/fulfillment/push", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const orderId = parseInt(req.params.orderId);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.requiresManualReview) {
    return res.status(409).json({ error: "Order is held for fraud review — clear the review flag before pushing to fulfillment." });
  }

  const result = await attemptPush(orderId, { manual: true });
  if (result.blocked) return res.status(409).json({ error: result.blocked });
  await logActivity({
    actor: req.adminUser,
    action: result.pushed ? "fulfillment.pushed" : "fulfillment.push_failed",
    entityType: "order", entityId: String(orderId), entityLabel: order.orderNumber,
    details: result.error ? { error: result.error } : {},
  });

  const shipmentRow = await pool.query("SELECT * FROM shipments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1", [orderId]);
  const s = shipmentRow.rows[0];
  const events = s ? await pool.query("SELECT * FROM shipment_events WHERE shipment_id = $1 ORDER BY occurred_at", [s.id]) : { rows: [] };
  res.json({ pushed: result.pushed, error: result.error, ...(s ? { shipment: mapAdminShipment(s, events.rows) } : {}) });
});

// ── /admin/system/status ──────────────────────────────────────────────────────

const HEALTH_CHECK_TIMEOUT_MS = 6_000;

function healthTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Health check timed out")), HEALTH_CHECK_TIMEOUT_MS)),
  ]);
}

router.get("/system/status", async (req, res, next) => requireAdmin(req, res, next), async (req: any, res) => {
  const timed = async (name: string, check: () => Promise<string | null>) => {
    const t0 = Date.now();
    try {
      const message = await healthTimeout(check());
      return { name, status: message ? "degraded" : "healthy", latencyMs: Date.now() - t0, message };
    } catch (e: any) {
      return { name, status: "unhealthy", latencyMs: null, message: e.message ?? String(e) };
    }
  };

  const services = await Promise.all([
    timed("Database", async () => { await pool.query("SELECT 1"); return null; }),
    timed("Stripe", async () => { await getStripe().balance.retrieve(); return null; }),
    timed("Clerk", async () => {
      const key = process.env["CLERK_SECRET_KEY"];
      if (!key) return "CLERK_SECRET_KEY not configured";
      const r = await fetch("https://api.clerk.com/v1/users/count", { headers: { Authorization: `Bearer ${key}` } });
      if (!r.ok) throw new Error(`Clerk API returned ${r.status}`);
      return null;
    }),
    timed("Resend (email)", async () => {
      const health = await checkResendHealth();
      if (!health.healthy) throw new Error(health.message ?? "Resend unreachable");
      return null;
    }),
    timed("ShipStation", async () => {
      const health = await shipstation.checkConnection();
      if (!health.connected) return health.message ?? "Not connected — fulfillment automation idle";
      if (!health.healthy) throw new Error(health.message ?? "ShipStation unreachable");
      return null;
    }),
  ]);

  services.push({ name: "API Server", status: "healthy", latencyMs: 0, message: null });

  const overallStatus = services.every((s) => s.status === "healthy")
    ? "healthy"
    : services.some((s) => s.status === "unhealthy")
      ? "unhealthy"
      : "degraded";
  res.json({ status: overallStatus, services });
});

export default router;
