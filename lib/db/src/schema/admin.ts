import {
  pgTable, serial, text, integer, boolean,
  timestamp, jsonb, index
} from "drizzle-orm/pg-core";

export const adminRolesTable = pgTable("admin_roles", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  role: text("role").notNull().default("staff"), // 'owner' | 'manager' | 'staff'
  permissions: jsonb("permissions").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("admin_roles_clerk_idx").on(t.clerkUserId),
  index("admin_roles_role_idx").on(t.role),
]);

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  actorClerkUserId: text("actor_clerk_user_id"),
  actorName: text("actor_name"),
  actorEmail: text("actor_email"),
  action: text("action").notNull(), // 'order.fulfilled', 'product.published', etc.
  entityType: text("entity_type"), // 'order' | 'product' | 'customer' | etc.
  entityId: text("entity_id"),
  entityLabel: text("entity_label"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("activity_log_actor_idx").on(t.actorClerkUserId),
  index("activity_log_entity_idx").on(t.entityType, t.entityId),
  index("activity_log_created_idx").on(t.createdAt),
]);

export type AdminRole = typeof adminRolesTable.$inferSelect;
export type ActivityLog = typeof activityLogTable.$inferSelect;
