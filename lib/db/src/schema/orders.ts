import {
  pgTable, serial, text, integer, boolean,
  timestamp, jsonb, index, uniqueIndex
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { productVariantsTable, productsTable } from "./products";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  customerId: integer("customer_id").references(() => customersTable.id),
  guestEmail: text("guest_email"),
  status: text("status").notNull().default("pending"),
  subtotalInCents: integer("subtotal_in_cents").notNull(),
  shippingInCents: integer("shipping_in_cents").notNull().default(0),
  taxInCents: integer("tax_in_cents").notNull().default(0),
  discountInCents: integer("discount_in_cents").notNull().default(0),
  totalInCents: integer("total_in_cents").notNull(),
  currency: text("currency").notNull().default("usd"),
  discountCode: text("discount_code"),
  shippingAddress: jsonb("shipping_address"),
  billingAddress: jsonb("billing_address"),
  stripeSessionId: text("stripe_session_id").unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
  stripeRiskLevel: text("stripe_risk_level"),
  stripeRiskScore: integer("stripe_risk_score"),
  requiresManualReview: boolean("requires_manual_review").notNull().default(false),
  notes: text("notes"),
  metaData: jsonb("meta_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("orders_customer_idx").on(t.customerId),
  index("orders_status_idx").on(t.status),
  index("orders_number_idx").on(t.orderNumber),
]);

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").references(() => productVariantsTable.id),
  productId: integer("product_id").references(() => productsTable.id),
  productName: text("product_name").notNull(),
  productSlug: text("product_slug"),
  variantSku: text("variant_sku").notNull(),
  size: text("size"),
  color: text("color"),
  quantity: integer("quantity").notNull(),
  unitPriceInCents: integer("unit_price_in_cents").notNull(),
  totalPriceInCents: integer("total_price_in_cents").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Shipment status ladder: pending_push -> pushed -> label_created -> shipped
// -> in_transit -> out_for_delivery -> delivered. Orthogonal: push_failed, exception.
export const shipmentsTable = pgTable("shipments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  status: text("status").notNull().default("pending_push"),
  carrier: text("carrier"),
  carrierCode: text("carrier_code"),
  serviceCode: text("service_code"),
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
  labelUrl: text("label_url"),
  shipstationShipmentId: text("shipstation_shipment_id"),
  estimatedDelivery: text("estimated_delivery"),
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
  pushAttempts: integer("push_attempts").notNull().default(0),
  lastPushError: text("last_push_error"),
  lastPushAt: timestamp("last_push_at"),
  nextPushAt: timestamp("next_push_at"),
  lastPolledAt: timestamp("last_polled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  // One shipment row per order — the fulfillment engine's core assumption.
  // Concurrent ensure/push paths rely on this to avoid duplicate pushes.
  uniqueIndex("shipments_order_idx").on(t.orderId),
  index("shipments_status_idx").on(t.status),
  uniqueIndex("shipments_shipstation_id_idx").on(t.shipstationShipmentId),
]);

// Normalized carrier tracking events (webhook + polling), idempotent per external event.
export const shipmentEventsTable = pgTable("shipment_events", {
  id: serial("id").primaryKey(),
  shipmentId: integer("shipment_id").notNull().references(() => shipmentsTable.id, { onDelete: "cascade" }),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  description: text("description"),
  location: text("location"),
  externalId: text("external_id").notNull(),
  occurredAt: timestamp("occurred_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("shipment_events_shipment_idx").on(t.shipmentId),
  uniqueIndex("shipment_events_dedupe_idx").on(t.shipmentId, t.externalId),
]);

// Idempotency ledger for transactional emails — one row per (order, email type), ever.
export const transactionalEmailsTable = pgTable("transactional_emails", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  shipmentId: integer("shipment_id").references(() => shipmentsTable.id, { onDelete: "set null" }),
  emailType: text("email_type").notNull(),
  recipient: text("recipient").notNull(),
  status: text("status").notNull().default("sending"),
  attempts: integer("attempts").notNull().default(0),
  resendId: text("resend_id"),
  error: text("error"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("transactional_emails_dedupe_idx").on(t.orderId, t.emailType),
]);

export const returnsTable = pgTable("returns", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  customerId: integer("customer_id").references(() => customersTable.id),
  status: text("status").notNull().default("requested"),
  reason: text("reason").notNull(),
  preferExchange: boolean("prefer_exchange").notNull().default(false),
  refundAmountInCents: integer("refund_amount_in_cents"),
  processedAt: timestamp("processed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const returnItemsTable = pgTable("return_items", {
  id: serial("id").primaryKey(),
  returnId: integer("return_id").notNull().references(() => returnsTable.id, { onDelete: "cascade" }),
  orderItemId: integer("order_item_id").notNull().references(() => orderItemsTable.id),
  quantity: integer("quantity").notNull(),
  reason: text("reason").notNull(),
  notes: text("notes"),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({ id: true, createdAt: true });
export const insertReturnSchema = createInsertSchema(returnsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
export type Shipment = typeof shipmentsTable.$inferSelect;
export type ShipmentEvent = typeof shipmentEventsTable.$inferSelect;
export type TransactionalEmail = typeof transactionalEmailsTable.$inferSelect;
export type Return = typeof returnsTable.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
