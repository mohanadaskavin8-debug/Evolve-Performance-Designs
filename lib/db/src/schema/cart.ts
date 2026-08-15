import {
  pgTable, serial, text, integer, timestamp, boolean, index
} from "drizzle-orm/pg-core";
import { productVariantsTable, productsTable } from "./products";

export const cartItemsTable = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  clerkUserId: text("clerk_user_id"),
  variantId: integer("variant_id").notNull().references(() => productVariantsTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  quantity: integer("quantity").notNull(),
  reservationId: integer("reservation_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("cart_session_idx").on(t.sessionId),
]);

export type CartItem = typeof cartItemsTable.$inferSelect;
