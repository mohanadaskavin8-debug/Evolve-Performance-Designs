import {
  pgTable, serial, text, integer, boolean, timestamp, index
} from "drizzle-orm/pg-core";
import { productsTable } from "./products";
import { ordersTable } from "./orders";
import { customersTable } from "./customers";

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  orderId: integer("order_id").references(() => ordersTable.id),
  customerId: integer("customer_id").references(() => customersTable.id),
  rating: integer("rating").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  reviewerName: text("reviewer_name").notNull(),
  isVerified: boolean("is_verified").notNull().default(false),
  isApproved: boolean("is_approved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("reviews_product_idx").on(t.productId),
  index("reviews_approved_idx").on(t.isApproved),
]);

export const supportRequestsTable = pgTable("support_requests", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id),
  orderId: integer("order_id").references(() => ordersTable.id),
  email: text("email").notNull(),
  name: text("name"),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"), // 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: text("priority").notNull().default("normal"),
  assignedTo: text("assigned_to"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("support_status_idx").on(t.status),
]);

export const emailSubscribersTable = pgTable("email_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  source: text("source").notNull().default("website"),
  status: text("status").notNull().default("active"), // 'active' | 'unsubscribed'
  consentAt: timestamp("consent_at").notNull().defaultNow(),
  unsubscribedAt: timestamp("unsubscribed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("subscribers_email_idx").on(t.email),
  index("subscribers_status_idx").on(t.status),
]);

export type Review = typeof reviewsTable.$inferSelect;
export type SupportRequest = typeof supportRequestsTable.$inferSelect;
export type EmailSubscriber = typeof emailSubscribersTable.$inferSelect;
