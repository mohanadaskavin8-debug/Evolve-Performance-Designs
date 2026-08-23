import {
  pgTable, serial, text, integer, boolean, timestamp, index
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const shippingZonesTable = pgTable("shipping_zones", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  countries: text("countries").array().notNull().default([]),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const shippingRatesTable = pgTable("shipping_rates", {
  id: serial("id").primaryKey(),
  zoneId: integer("zone_id").notNull().references(() => shippingZonesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  rateType: text("rate_type").notNull().default("flat"), // 'flat' | 'free' | 'calculated'
  priceInCents: integer("price_in_cents").notNull().default(0),
  minimumOrderInCents: integer("minimum_order_in_cents"),
  estimatedDays: text("estimated_days").notNull().default("5-10 business days"),
  active: boolean("active").notNull().default(true),
  // For rateType 'calculated': which carrier/service quotes the live rate (legacy, unused).
  carrierCode: text("carrier_code"),
  serviceCode: text("service_code"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const discountsTable = pgTable("discounts", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  discountType: text("discount_type").notNull().default("percentage"), // 'percentage' | 'fixed'
  value: integer("value").notNull(),
  minimumOrderInCents: integer("minimum_order_in_cents"),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("discounts_code_idx").on(t.code),
]);

export const insertShippingZoneSchema = createInsertSchema(shippingZonesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertShippingRateSchema = createInsertSchema(shippingRatesTable).omit({ id: true, createdAt: true });
export const insertDiscountSchema = createInsertSchema(discountsTable).omit({ id: true, createdAt: true });

export type ShippingZone = typeof shippingZonesTable.$inferSelect;
export type ShippingRate = typeof shippingRatesTable.$inferSelect;
export type Discount = typeof discountsTable.$inferSelect;
export type InsertDiscount = z.infer<typeof insertDiscountSchema>;
