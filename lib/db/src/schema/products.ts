import {
  pgTable, serial, text, integer, boolean,
  timestamp, decimal, index
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const collectionsTable = pgTable("collections", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  imageUrl: text("image_url"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  theme: text("theme"),
  description: text("description").notNull().default(""),
  materials: text("materials"),
  benefits: text("benefits"),
  shippingInfo: text("shipping_info"),
  returnsInfo: text("returns_info"),
  status: text("status").notNull().default("active"),
  weightGrams: integer("weight_grams"),
  dimensionsCm: text("dimensions_cm"),
  hsCode: text("hs_code"),
  countryOfOrigin: text("country_of_origin"),
  isFeatured: boolean("is_featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("products_status_idx").on(t.status),
  index("products_featured_idx").on(t.isFeatured),
]);

export const productVariantsTable = pgTable("product_variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  sku: text("sku").notNull().unique(),
  size: text("size"),
  color: text("color"),
  priceInCents: integer("price_in_cents").notNull(),
  compareAtPriceInCents: integer("compare_at_price_in_cents"),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  reservedQuantity: integer("reserved_quantity").notNull().default(0),
  imageUrl: text("image_url"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("variants_product_idx").on(t.productId),
]);

export const productImagesTable = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").references(() => productVariantsTable.id, { onDelete: "set null" }),
  url: text("url").notNull(),
  altText: text("alt_text"),
  isPrimary: boolean("is_primary").notNull().default(false),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const productCollectionsTable = pgTable("product_collections", {
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  collectionId: integer("collection_id").notNull().references(() => collectionsTable.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
});

// Insert schemas
export const insertCollectionSchema = createInsertSchema(collectionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVariantSchema = createInsertSchema(productVariantsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductImageSchema = createInsertSchema(productImagesTable).omit({ id: true, createdAt: true });

export type Collection = typeof collectionsTable.$inferSelect;
export type Product = typeof productsTable.$inferSelect;
export type ProductVariant = typeof productVariantsTable.$inferSelect;
export type ProductImage = typeof productImagesTable.$inferSelect;
export type InsertCollection = z.infer<typeof insertCollectionSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertVariant = z.infer<typeof insertVariantSchema>;
