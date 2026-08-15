import {
  pgTable, serial, text, integer, timestamp, index
} from "drizzle-orm/pg-core";
import { productVariantsTable } from "./products";

export const inventoryTransactionsTable = pgTable("inventory_transactions", {
  id: serial("id").primaryKey(),
  variantId: integer("variant_id").notNull().references(() => productVariantsTable.id),
  type: text("type").notNull(), // 'reserve' | 'release' | 'commit' | 'restock' | 'adjustment'
  quantity: integer("quantity").notNull(),
  previousStock: integer("previous_stock").notNull(),
  newStock: integer("new_stock").notNull(),
  referenceType: text("reference_type"), // 'cart' | 'order' | 'admin'
  referenceId: text("reference_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("inv_tx_variant_idx").on(t.variantId),
]);

export const inventoryReservationsTable = pgTable("inventory_reservations", {
  id: serial("id").primaryKey(),
  variantId: integer("variant_id").notNull().references(() => productVariantsTable.id),
  cartSessionId: text("cart_session_id").notNull(),
  quantity: integer("quantity").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  committed: integer("committed").notNull().default(0), // 0=active, 1=committed to order
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("reservations_session_idx").on(t.cartSessionId),
  index("reservations_variant_idx").on(t.variantId),
]);

export type InventoryReservation = typeof inventoryReservationsTable.$inferSelect;
export type InventoryTransaction = typeof inventoryTransactionsTable.$inferSelect;
