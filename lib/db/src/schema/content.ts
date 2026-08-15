import {
  pgTable, serial, text, integer, boolean, timestamp
} from "drizzle-orm/pg-core";

export const siteSettingsTable = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const websitePagesTable = pgTable("website_pages", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // 'story' | 'about' | 'faq' | 'privacy' | 'terms' | etc.
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  isPublished: boolean("is_published").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const homepageSectionsTable = pgTable("homepage_sections", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  sectionType: text("section_type").notNull(),
  title: text("title"),
  subtitle: text("subtitle"),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SiteSetting = typeof siteSettingsTable.$inferSelect;
export type WebsitePage = typeof websitePagesTable.$inferSelect;
export type HomepageSection = typeof homepageSectionsTable.$inferSelect;
