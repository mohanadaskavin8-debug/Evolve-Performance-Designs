import {
  pgTable, serial, integer, text, boolean, timestamp, index
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").unique(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  stripeCustomerId: text("stripe_customer_id").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("customers_email_idx").on(t.email),
  index("customers_clerk_idx").on(t.clerkUserId),
]);

export const addressesTable = pgTable("addresses", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  line1: text("line1").notNull(),
  line2: text("line2"),
  city: text("city").notNull(),
  state: text("state"),
  postalCode: text("postal_code"),
  countryCode: text("country_code").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAddressSchema = createInsertSchema(addressesTable).omit({ id: true, createdAt: true });

export type Customer = typeof customersTable.$inferSelect;
export type Address = typeof addressesTable.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type InsertAddress = z.infer<typeof insertAddressSchema>;
