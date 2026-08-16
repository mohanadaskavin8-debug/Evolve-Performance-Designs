/**
 * Email marketing domain: campaigns, per-recipient send ledger, suppressions,
 * owner-editable templates, and automations.
 *
 * Compliance invariants enforced by this schema:
 * - campaign_recipients has a unique (campaign_id, email) claim, so a campaign
 *   can never double-send to the same address — across retries, restarts, or
 *   concurrent ticks (same pattern as transactional_emails).
 * - email_suppressions is a global do-not-email list checked at send time;
 *   unsubscribes/bounces land here and future sends skip these addresses.
 * - automation_sends has a unique (automation_key, dedupe_key) claim, so a
 *   welcome or post-purchase email fires at most once per subscriber/order.
 */
import {
  pgTable, serial, text, integer, boolean,
  timestamp, jsonb, index, uniqueIndex
} from "drizzle-orm/pg-core";

export const emailTemplatesTable = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),          // e.g. 'transactional_shipped', 'automation_welcome'
  category: text("category").notNull(),         // 'transactional' | 'automation'
  name: text("name").notNull(),
  description: text("description"),
  subject: text("subject").notNull(),           // supports {{orderNumber}}, {{firstName}}
  headline: text("headline").notNull(),
  body: text("body").notNull(),
  ctaLabel: text("cta_label"),
  ctaUrl: text("cta_url"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const marketingCampaignsTable = pgTable("marketing_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull().default(""),
  previewText: text("preview_text"),
  audienceKey: text("audience_key").notNull().default("newsletter"),
  blocks: jsonb("blocks").notNull().default([]), // ordered array of content blocks
  status: text("status").notNull().default("draft"), // draft | scheduled | sending | sent | canceled
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  totalRecipients: integer("total_recipients"), // set when the ledger is materialized
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("campaigns_status_idx").on(t.status),
]);

export const campaignRecipientsTable = pgTable("campaign_recipients", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => marketingCampaignsTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),               // the intended recipient (real address, even in test mode)
  sentTo: text("sent_to"),                      // the address actually used (test-mode sink or the real one)
  status: text("status").notNull().default("pending"), // pending | sending | sent | failed | skipped
  skipReason: text("skip_reason"),              // suppressed | unsubscribed | invalid
  attempts: integer("attempts").notNull().default(0),
  resendId: text("resend_id"),
  lastEvent: text("last_event"),                // polled from Resend: delivered | bounced | opened | clicked ...
  lastEventAt: timestamp("last_event_at"),
  error: text("error"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  // One ledger row per (campaign, address), ever — the double-send guard.
  uniqueIndex("campaign_recipients_dedupe_idx").on(t.campaignId, t.email),
  index("campaign_recipients_status_idx").on(t.campaignId, t.status),
]);

export const emailSuppressionsTable = pgTable("email_suppressions", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  reason: text("reason").notNull(),             // unsubscribe | bounce | complaint | manual
  campaignId: integer("campaign_id").references(() => marketingCampaignsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const marketingAutomationsTable = pgTable("marketing_automations", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),          // 'welcome' | 'post_purchase'
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  delayHours: integer("delay_hours").notNull().default(0),
  templateKey: text("template_key").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const automationSendsTable = pgTable("automation_sends", {
  id: serial("id").primaryKey(),
  automationKey: text("automation_key").notNull(),
  dedupeKey: text("dedupe_key").notNull(),      // welcome: email; post_purchase: order id
  email: text("email").notNull(),
  sentTo: text("sent_to"),
  status: text("status").notNull().default("sending"), // sending | sent | failed | skipped
  resendId: text("resend_id"),
  error: text("error"),
  sentAt: timestamp("sent_at"),
  lastEvent: text("last_event"),          // delivered | bounced | complained | opened | clicked …
  lastEventAt: timestamp("last_event_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  // At-most-once per (automation, subject) — the automation idempotency guard.
  uniqueIndex("automation_sends_dedupe_idx").on(t.automationKey, t.dedupeKey),
]);

export type EmailTemplate = typeof emailTemplatesTable.$inferSelect;
export type MarketingCampaign = typeof marketingCampaignsTable.$inferSelect;
export type CampaignRecipient = typeof campaignRecipientsTable.$inferSelect;
export type EmailSuppression = typeof emailSuppressionsTable.$inferSelect;
export type MarketingAutomation = typeof marketingAutomationsTable.$inferSelect;
export type AutomationSend = typeof automationSendsTable.$inferSelect;
