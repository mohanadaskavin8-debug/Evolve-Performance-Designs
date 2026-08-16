/**
 * Email marketing engine: audiences, campaign send queue, automations,
 * engagement polling, and seed data.
 *
 * Compliance rules enforced here:
 * - Consent is evaluated at SEND TIME, per recipient — being in the ledger is
 *   not enough. Anyone who unsubscribed or got suppressed after the campaign
 *   was queued is skipped (with the reason recorded).
 * - Test mode (MARKETING_TEST_MODE, default ON) rewrites every campaign and
 *   automation recipient to Resend's test sink so no real customer gets
 *   marketing email until the owner flips it off. The ledger always records
 *   the real intended address AND where the email actually went.
 * - Transactional email (order milestones) is NOT gated on marketing consent
 *   and never will be — only marketing sends check these lists.
 */
import { ReplitConnectors } from "@replit/connectors-sdk";
import { db, pool } from "@workspace/db";
import {
  marketingCampaignsTable,
  campaignRecipientsTable,
  emailSuppressionsTable,
  marketingAutomationsTable,
  automationSendsTable,
  emailTemplatesTable,
  type MarketingCampaign,
} from "@workspace/db";
import { and, eq, lte, sql } from "drizzle-orm";
import { logger } from "./logger";
import { sendViaResend } from "./email";
import {
  type CampaignBlockData,
  type ProductCardData,
  renderCampaignEmail,
  renderTemplateEmail,
  fillPlaceholders,
  unsubscribeUrlFor,
  resubscribeUrlFor,
  makeUnsubscribeToken,
  storefrontBase,
} from "./marketing-email";

const TEST_SINK = "delivered@resend.dev";
const SEND_BATCH_SIZE = 15;
const MAX_SEND_ATTEMPTS = 3;

export function isMarketingTestMode(): boolean {
  return (process.env.MARKETING_TEST_MODE ?? "true").trim().toLowerCase() !== "false";
}

function apiOrigin(): string {
  return (
    process.env.STOREFRONT_ORIGIN ||
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null) ||
    "http://localhost:8080"
  );
}

/** RFC 8058 one-click unsubscribe headers for a marketing email. */
function unsubscribeHeaders(email: string, campaignId?: number | null): Record<string, string> {
  const token = encodeURIComponent(makeUnsubscribeToken(email, campaignId));
  return {
    "List-Unsubscribe": `<${apiOrigin()}/api/marketing/unsubscribe?token=${token}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

// ── Audiences ─────────────────────────────────────────────────────────────────

export interface AudienceDef {
  key: string;
  name: string;
  description: string;
}

const STATIC_AUDIENCES: AudienceDef[] = [
  { key: "all", name: "Everyone (consented)", description: "All subscribers and customers who opted in to marketing" },
  { key: "newsletter", name: "Newsletter subscribers", description: "Everyone on the active newsletter list" },
  { key: "new_customers", name: "New customers", description: "First purchase within the last 30 days" },
  { key: "repeat_buyers", name: "Repeat buyers", description: "Customers with two or more orders" },
  { key: "high_value", name: "High-value customers", description: "Lifetime spend of $150 or more" },
  { key: "no_purchase", name: "Subscribed, never purchased", description: "On the list but no orders yet" },
];

const PURCHASE_STATUSES_EXCLUDED = `('pending','canceled','refunded')`;

/**
 * Base CTEs: `eligible` = consented (active subscriber OR consenting customer)
 * minus every suppressed address. All audience queries build on this, so a
 * suppressed/unsubscribed address can never appear in any audience.
 */
const AUDIENCE_BASE = `
  WITH consented AS (
    SELECT LOWER(s.email) AS email, s.first_name AS first_name
    FROM email_subscribers s WHERE s.status = 'active'
    UNION
    SELECT LOWER(c.email) AS email, c.first_name AS first_name
    FROM customers c WHERE c.marketing_consent = TRUE
  ), eligible AS (
    SELECT co.email, MIN(co.first_name) AS first_name
    FROM consented co
    LEFT JOIN email_suppressions sup ON LOWER(sup.email) = co.email
    WHERE sup.id IS NULL
    GROUP BY co.email
  ), purchases AS (
    SELECT LOWER(COALESCE(c.email, o.guest_email)) AS email,
           COUNT(*) AS order_count,
           SUM(o.total_in_cents) AS lifetime_cents,
           MIN(o.created_at) AS first_order_at
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.status NOT IN ${PURCHASE_STATUSES_EXCLUDED}
      AND COALESCE(c.email, o.guest_email) IS NOT NULL
    GROUP BY 1
  )
`;

function audienceFilter(key: string): { where: string; values: unknown[] } | null {
  switch (key) {
    case "all":
      return { where: "TRUE", values: [] };
    case "newsletter":
      return {
        where: `EXISTS (SELECT 1 FROM email_subscribers s WHERE LOWER(s.email) = e.email AND s.status = 'active')`,
        values: [],
      };
    case "new_customers":
      return {
        where: `EXISTS (SELECT 1 FROM purchases p WHERE p.email = e.email AND p.first_order_at > NOW() - INTERVAL '30 days')`,
        values: [],
      };
    case "repeat_buyers":
      return { where: `EXISTS (SELECT 1 FROM purchases p WHERE p.email = e.email AND p.order_count >= 2)`, values: [] };
    case "high_value":
      return { where: `EXISTS (SELECT 1 FROM purchases p WHERE p.email = e.email AND p.lifetime_cents >= 15000)`, values: [] };
    case "no_purchase":
      return { where: `NOT EXISTS (SELECT 1 FROM purchases p WHERE p.email = e.email)`, values: [] };
    default: {
      if (!key.startsWith("collection_")) return null;
      const slug = key.slice("collection_".length);
      return {
        where: `EXISTS (
          SELECT 1 FROM orders o
          LEFT JOIN customers c ON c.id = o.customer_id
          JOIN order_items oi ON oi.order_id = o.id
          JOIN product_collections pc ON pc.product_id = oi.product_id
          JOIN collections col ON col.id = pc.collection_id
          WHERE LOWER(COALESCE(c.email, o.guest_email)) = e.email
            AND o.status NOT IN ${PURCHASE_STATUSES_EXCLUDED}
            AND col.slug = $1
        )`,
        values: [slug],
      };
    }
  }
}

export async function listAudiences(): Promise<Array<AudienceDef & { count: number }>> {
  const { rows: collections } = await pool.query(
    `SELECT slug, name FROM collections WHERE active = TRUE ORDER BY name`,
  );
  const defs: AudienceDef[] = [
    ...STATIC_AUDIENCES,
    ...collections.map((c: any) => ({
      key: `collection_${c.slug}`,
      name: `${c.name} buyers`,
      description: `Customers who ordered from the ${c.name} collection`,
    })),
  ];
  const results: Array<AudienceDef & { count: number }> = [];
  for (const def of defs) {
    results.push({ ...def, count: await countAudience(def.key) });
  }
  return results;
}

export async function isValidAudience(key: string): Promise<boolean> {
  if (STATIC_AUDIENCES.some((a) => a.key === key)) return true;
  if (!key.startsWith("collection_")) return false;
  const slug = key.slice("collection_".length);
  const { rows } = await pool.query(`SELECT 1 FROM collections WHERE slug = $1 AND active = TRUE`, [slug]);
  return rows.length > 0;
}

export async function countAudience(key: string): Promise<number> {
  const filter = audienceFilter(key);
  if (!filter) return 0;
  const { rows } = await pool.query(
    `${AUDIENCE_BASE} SELECT COUNT(*) AS n FROM eligible e WHERE ${filter.where}`,
    filter.values,
  );
  return parseInt(rows[0]?.n ?? "0");
}

async function resolveAudience(key: string): Promise<Array<{ email: string; firstName: string | null }>> {
  const filter = audienceFilter(key);
  if (!filter) return [];
  const { rows } = await pool.query(
    `${AUDIENCE_BASE} SELECT e.email, e.first_name FROM eligible e WHERE ${filter.where} ORDER BY e.email`,
    filter.values,
  );
  return rows.map((r: any) => ({ email: r.email, firstName: r.first_name ?? null }));
}

// ── Send-time consent check ───────────────────────────────────────────────────

async function consentStatus(email: string): Promise<{ ok: boolean; reason: "suppressed" | "unsubscribed" | null }> {
  const { rows } = await pool.query(
    `SELECT
       EXISTS(SELECT 1 FROM email_suppressions WHERE LOWER(email) = $1) AS suppressed,
       EXISTS(SELECT 1 FROM email_subscribers WHERE LOWER(email) = $1 AND status = 'active') AS subscribed,
       EXISTS(SELECT 1 FROM customers WHERE LOWER(email) = $1 AND marketing_consent = TRUE) AS consenting`,
    [email.toLowerCase()],
  );
  const r = rows[0] ?? {};
  if (r.suppressed) return { ok: false, reason: "suppressed" };
  if (!r.subscribed && !r.consenting) return { ok: false, reason: "unsubscribed" };
  return { ok: true, reason: null };
}

// ── Campaign rendering helpers ────────────────────────────────────────────────

export function campaignBlocks(campaign: Pick<MarketingCampaign, "blocks">): CampaignBlockData[] {
  return Array.isArray(campaign.blocks) ? (campaign.blocks as CampaignBlockData[]) : [];
}

export async function productCardsFor(blocks: CampaignBlockData[]): Promise<Map<number, ProductCardData>> {
  const ids = [...new Set(blocks.filter((b) => b.type === "product" && b.productId).map((b) => b.productId as number))];
  const map = new Map<number, ProductCardData>();
  if (ids.length === 0) return map;
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.slug,
            COALESCE((SELECT MIN(v.price_in_cents) FROM product_variants v WHERE v.product_id = p.id AND v.active), 0) AS price,
            (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id
             ORDER BY pi.is_primary DESC, pi.position ASC, pi.id ASC LIMIT 1) AS image
     FROM products p WHERE p.id = ANY($1)`,
    [ids],
  );
  for (const r of rows) {
    map.set(r.id, { id: r.id, name: r.name, slug: r.slug, priceInCents: parseInt(r.price ?? "0"), imageUrl: r.image ?? null });
  }
  return map;
}

export async function renderCampaignHtmlFor(
  campaign: Pick<MarketingCampaign, "id" | "previewText" | "blocks">,
  recipientEmail: string,
): Promise<string> {
  const blocks = campaignBlocks(campaign);
  const products = await productCardsFor(blocks);
  return renderCampaignEmail({
    previewText: campaign.previewText ?? null,
    blocks,
    products,
    unsubscribeUrl: unsubscribeUrlFor(recipientEmail, campaign.id),
  });
}

/** Explicit test send: goes to the typed address exactly as typed — never the sink. */
export async function sendCampaignTestEmail(campaign: MarketingCampaign, toEmail: string): Promise<void> {
  const html = await renderCampaignHtmlFor(campaign, toEmail);
  await sendViaResend({
    to: toEmail,
    subject: `[TEST] ${campaign.subject || campaign.name}`,
    html,
    headers: unsubscribeHeaders(toEmail, campaign.id),
  });
}

// ── Campaign engine ───────────────────────────────────────────────────────────

async function promoteScheduledCampaigns(): Promise<void> {
  await db
    .update(marketingCampaignsTable)
    .set({ status: "sending", startedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(marketingCampaignsTable.status, "scheduled"), lte(marketingCampaignsTable.scheduledAt, new Date())));
}

/** Build the per-recipient ledger for campaigns that just started sending. */
async function materializeCampaignRecipients(): Promise<void> {
  const campaigns = await db
    .select()
    .from(marketingCampaignsTable)
    .where(and(eq(marketingCampaignsTable.status, "sending"), sql`${marketingCampaignsTable.totalRecipients} IS NULL`));

  for (const campaign of campaigns) {
    const recipients = await resolveAudience(campaign.audienceKey);
    for (let i = 0; i < recipients.length; i += 500) {
      const chunk = recipients.slice(i, i + 500);
      if (chunk.length === 0) continue;
      await db
        .insert(campaignRecipientsTable)
        .values(chunk.map((r) => ({ campaignId: campaign.id, email: r.email })))
        .onConflictDoNothing();
    }
    const { rows } = await pool.query(`SELECT COUNT(*) AS n FROM campaign_recipients WHERE campaign_id = $1`, [campaign.id]);
    await db
      .update(marketingCampaignsTable)
      .set({ totalRecipients: parseInt(rows[0]?.n ?? "0"), updatedAt: new Date() })
      .where(eq(marketingCampaignsTable.id, campaign.id));
    logger.info({ campaignId: campaign.id, recipients: rows[0]?.n }, "Campaign recipient ledger materialized");
  }
}

async function processCampaignSendQueue(): Promise<void> {
  // Claim a batch atomically; SKIP LOCKED keeps concurrent claimers from colliding.
  const { rows: claimed } = await pool.query(
    `UPDATE campaign_recipients SET status = 'sending', attempts = attempts + 1
     WHERE id IN (
       SELECT r.id FROM campaign_recipients r
       JOIN marketing_campaigns mc ON mc.id = r.campaign_id
       WHERE r.status = 'pending' AND mc.status = 'sending'
       ORDER BY r.id
       LIMIT ${SEND_BATCH_SIZE}
       FOR UPDATE OF r SKIP LOCKED
     )
     RETURNING id, campaign_id, email, attempts`,
  );
  if (claimed.length === 0) return;

  const testMode = isMarketingTestMode();
  const campaignCache = new Map<number, MarketingCampaign>();

  for (const row of claimed) {
    const recipientId: number = row.id;
    const campaignId: number = row.campaign_id;
    const email: string = row.email;
    const attempts: number = row.attempts;

    try {
      let campaign = campaignCache.get(campaignId);
      if (!campaign) {
        const [c] = await db.select().from(marketingCampaignsTable).where(eq(marketingCampaignsTable.id, campaignId));
        if (!c) throw new Error(`Campaign ${campaignId} vanished`);
        campaign = c;
        campaignCache.set(campaignId, c);
      }

      // A cancel can land between claim and send — re-check the freshly loaded campaign row.
      if (campaign.status !== "sending") {
        await db
          .update(campaignRecipientsTable)
          .set({ status: "skipped", skipReason: "canceled" })
          .where(eq(campaignRecipientsTable.id, recipientId));
        continue;
      }

      // Send-time consent re-check — the ledger row alone is not permission.
      const consent = await consentStatus(email);
      if (!consent.ok) {
        await db
          .update(campaignRecipientsTable)
          .set({ status: "skipped", skipReason: consent.reason })
          .where(eq(campaignRecipientsTable.id, recipientId));
        continue;
      }

      const sentTo = testMode ? TEST_SINK : email;
      const html = await renderCampaignHtmlFor(campaign, email);
      const resendId = await sendViaResend({
        to: sentTo,
        subject: campaign.subject || campaign.name,
        html,
        headers: unsubscribeHeaders(email, campaign.id),
        // Stable per ledger row: a crash between "Resend accepted" and our status
        // update re-claims this row, and the same key makes the retry a no-op.
        idempotencyKey: `campaign-recipient-${recipientId}`,
      });
      await db
        .update(campaignRecipientsTable)
        .set({ status: "sent", sentTo, resendId, sentAt: new Date(), error: null })
        .where(eq(campaignRecipientsTable.id, recipientId));
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      const failedForGood = attempts >= MAX_SEND_ATTEMPTS;
      await db
        .update(campaignRecipientsTable)
        .set({ status: failedForGood ? "failed" : "pending", error: msg })
        .where(eq(campaignRecipientsTable.id, recipientId));
      logger.warn({ recipientId, campaignId, err: msg, failedForGood }, "Campaign send attempt failed");
    }
  }
}

async function completeFinishedCampaigns(): Promise<void> {
  await pool.query(
    `UPDATE marketing_campaigns mc SET status = 'sent', completed_at = NOW(), updated_at = NOW()
     WHERE mc.status = 'sending' AND mc.total_recipients IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM campaign_recipients r
         WHERE r.campaign_id = mc.id AND r.status IN ('pending','sending')
       )`,
  );
}

/** Crash recovery: rows stuck in 'sending' from a previous process run. Called once at boot. */
async function resetStaleSendingRows(): Promise<void> {
  const { rowCount } = await pool.query(
    `UPDATE campaign_recipients SET status = CASE WHEN attempts >= ${MAX_SEND_ATTEMPTS} THEN 'failed' ELSE 'pending' END
     WHERE status = 'sending'`,
  );
  if (rowCount) logger.info({ rows: rowCount }, "Reset stale in-flight campaign recipients after restart");
}

// ── Automations ───────────────────────────────────────────────────────────────

async function getTemplate(key: string) {
  const [t] = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.key, key));
  return t ?? null;
}

/**
 * Claim-then-send with a unique (automationKey, dedupeKey) ledger row —
 * an automation email can fire at most once per subject, ever.
 */
async function processAutomationSend(input: {
  automationKey: string;
  dedupeKey: string;
  email: string;
  templateKey: string;
  vars: Record<string, string | null | undefined>;
}): Promise<"sent" | "duplicate" | "skipped" | "failed"> {
  const email = input.email.toLowerCase();
  const claimed = await db
    .insert(automationSendsTable)
    .values({ automationKey: input.automationKey, dedupeKey: input.dedupeKey, email, status: "sending" })
    .onConflictDoNothing()
    .returning({ id: automationSendsTable.id });
  const claim = claimed[0];
  if (!claim) return "duplicate";

  const consent = await consentStatus(email);
  if (!consent.ok) {
    await db
      .update(automationSendsTable)
      .set({ status: "skipped", error: consent.reason })
      .where(eq(automationSendsTable.id, claim.id));
    return "skipped";
  }

  try {
    const template = await getTemplate(input.templateKey);
    if (!template) throw new Error(`Template ${input.templateKey} missing`);
    const html = renderTemplateEmail({
      headline: template.headline,
      body: template.body,
      ctaLabel: template.ctaLabel,
      ctaUrl: template.ctaUrl,
      vars: input.vars,
      unsubscribeUrl: unsubscribeUrlFor(email),
    });
    const sentTo = isMarketingTestMode() ? TEST_SINK : email;
    const resendId = await sendViaResend({
      to: sentTo,
      subject: fillPlaceholders(template.subject, input.vars),
      html,
      headers: unsubscribeHeaders(email),
      idempotencyKey: `automation-send-${claim.id}`,
    });
    await db
      .update(automationSendsTable)
      .set({ status: "sent", sentTo, resendId, sentAt: new Date() })
      .where(eq(automationSendsTable.id, claim.id));
    logger.info({ automation: input.automationKey, dedupeKey: input.dedupeKey }, "Automation email sent");
    return "sent";
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    await db.update(automationSendsTable).set({ status: "failed", error: msg }).where(eq(automationSendsTable.id, claim.id));
    logger.warn({ automation: input.automationKey, dedupeKey: input.dedupeKey, err: msg }, "Automation email failed");
    return "failed";
  }
}

/**
 * Double opt-in confirmation for a previously opted-out address. This email
 * intentionally bypasses the consent check — it IS the consent-repair
 * mechanism (a single transactional confirmation, no marketing content).
 * The automation_sends ledger rate-limits it to one per address per day.
 */
export async function sendResubscribeConfirmation(email: string): Promise<void> {
  const normalized = email.toLowerCase();
  const day = new Date().toISOString().slice(0, 10);
  const claimed = await db
    .insert(automationSendsTable)
    .values({ automationKey: "resubscribe_confirm", dedupeKey: `${normalized}:${day}`, email: normalized, status: "sending" })
    .onConflictDoNothing()
    .returning({ id: automationSendsTable.id });
  const claim = claimed[0];
  if (!claim) return; // already sent one today — anti mail-bomb guard

  try {
    const html = renderTemplateEmail({
      headline: "CONFIRM YOUR RETURN",
      body:
        "You (or someone using this address) asked to rejoin the Evolve Performance crew.\n" +
        "This address previously opted out of marketing email, so we need one click from you to switch it back on.\n\n" +
        "If this wasn't you, ignore this email — nothing will change.",
      ctaLabel: "CONFIRM SUBSCRIPTION",
      ctaUrl: resubscribeUrlFor(normalized),
      vars: {},
      unsubscribeUrl: unsubscribeUrlFor(normalized),
    });
    const sentTo = isMarketingTestMode() ? TEST_SINK : normalized;
    const resendId = await sendViaResend({
      to: sentTo,
      subject: "Confirm your subscription — Evolve Performance",
      html,
      idempotencyKey: `automation-send-${claim.id}`,
    });
    await db
      .update(automationSendsTable)
      .set({ status: "sent", sentTo, resendId, sentAt: new Date() })
      .where(eq(automationSendsTable.id, claim.id));
    logger.info({ email: normalized }, "Re-subscribe confirmation sent");
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    await db.update(automationSendsTable).set({ status: "failed", error: msg }).where(eq(automationSendsTable.id, claim.id));
    logger.warn({ email: normalized, err: msg }, "Re-subscribe confirmation failed");
  }
}

/** Fired inline right after a newsletter signup (idempotent; tick sweep is the backstop). */
export async function triggerWelcomeAutomation(email: string, firstName: string | null): Promise<void> {
  const [automation] = await db
    .select()
    .from(marketingAutomationsTable)
    .where(eq(marketingAutomationsTable.key, "welcome"));
  if (!automation?.enabled || automation.delayHours > 0) return; // delayed welcomes go through the tick sweep
  await processAutomationSend({
    automationKey: "welcome",
    dedupeKey: email.toLowerCase(),
    email,
    templateKey: automation.templateKey,
    vars: { firstName: firstName ?? "" },
  });
}

async function sweepAutomations(): Promise<void> {
  const automations = await db.select().from(marketingAutomationsTable);
  const welcome = automations.find((a) => a.key === "welcome");
  const postPurchase = automations.find((a) => a.key === "post_purchase");

  if (welcome?.enabled) {
    const { rows } = await pool.query(
      `SELECT LOWER(s.email) AS email, s.first_name
       FROM email_subscribers s
       WHERE s.status = 'active'
         AND s.consent_at <= NOW() - ($1 || ' hours')::interval
         AND s.consent_at > NOW() - INTERVAL '7 days'
         AND NOT EXISTS (
           SELECT 1 FROM automation_sends a
           WHERE a.automation_key = 'welcome' AND a.dedupe_key = LOWER(s.email)
         )
       ORDER BY s.consent_at LIMIT 10`,
      [welcome.delayHours],
    );
    for (const r of rows) {
      await processAutomationSend({
        automationKey: "welcome",
        dedupeKey: r.email,
        email: r.email,
        templateKey: welcome.templateKey,
        vars: { firstName: r.first_name ?? "" },
      });
    }
  }

  if (postPurchase?.enabled) {
    const { rows } = await pool.query(
      `SELECT o.id AS order_id, o.order_number, LOWER(COALESCE(c.email, o.guest_email)) AS email, c.first_name
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.status NOT IN ${PURCHASE_STATUSES_EXCLUDED}
         AND o.created_at <= NOW() - ($1 || ' hours')::interval
         AND o.created_at > NOW() - INTERVAL '30 days'
         AND COALESCE(c.email, o.guest_email) IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM automation_sends a
           WHERE a.automation_key = 'post_purchase' AND a.dedupe_key = o.id::text
         )
       ORDER BY o.created_at LIMIT 10`,
      [postPurchase.delayHours],
    );
    for (const r of rows) {
      await processAutomationSend({
        automationKey: "post_purchase",
        dedupeKey: String(r.order_id),
        email: r.email,
        templateKey: postPurchase.templateKey,
        vars: { firstName: r.first_name ?? "", orderNumber: r.order_number ?? "" },
      });
    }
  }
}

// ── Engagement polling (no webhook needed) ────────────────────────────────────

async function pollResendEvents(): Promise<void> {
  const connectors = new ReplitConnectors();

  const fetchLastEvent = async (resendId: string): Promise<string | null> => {
    const response = (await connectors.proxy("resend", `/emails/${resendId}`, {
      method: "GET",
    })) as unknown as Response;
    if (!response.ok) return null;
    const data: any = await response.json();
    return typeof data?.last_event === "string" ? data.last_event : null;
  };

  // Hard bounces and spam complaints suppress the address globally.
  const suppressIfHardEvent = async (email: string, event: string, campaignId: number | null): Promise<void> => {
    if (event !== "bounced" && event !== "complained") return;
    await db
      .insert(emailSuppressionsTable)
      .values({ email, reason: event === "bounced" ? "bounce" : "complaint", campaignId })
      .onConflictDoNothing();
  };

  // Campaign recipients.
  const { rows } = await pool.query(
    `SELECT r.id, r.campaign_id, r.email, r.resend_id, r.last_event
     FROM campaign_recipients r
     WHERE r.status = 'sent' AND r.resend_id IS NOT NULL AND r.resend_id != ''
       AND r.sent_at > NOW() - INTERVAL '3 days'
       AND (r.last_event IS NULL OR r.last_event NOT IN ('bounced','complained','clicked'))
     ORDER BY r.last_event_at ASC NULLS FIRST
     LIMIT 20`,
  );
  for (const row of rows) {
    try {
      const event = await fetchLastEvent(row.resend_id);
      if (!event) continue;
      await db
        .update(campaignRecipientsTable)
        .set(event !== row.last_event ? { lastEvent: event, lastEventAt: new Date() } : { lastEventAt: new Date() })
        .where(eq(campaignRecipientsTable.id, row.id));
      await suppressIfHardEvent(row.email, event, row.campaign_id);
    } catch (err) {
      logger.debug({ err, resendId: row.resend_id }, "Resend event poll failed for one email");
    }
  }

  // Automation sends (welcome / post-purchase) — their bounces and complaints
  // must feed the same global suppression list as campaign sends.
  const { rows: autoRows } = await pool.query(
    `SELECT a.id, a.email, a.resend_id, a.last_event
     FROM automation_sends a
     WHERE a.status = 'sent' AND a.resend_id IS NOT NULL AND a.resend_id != ''
       AND a.sent_at > NOW() - INTERVAL '3 days'
       AND (a.last_event IS NULL OR a.last_event NOT IN ('bounced','complained','clicked'))
     ORDER BY a.last_event_at ASC NULLS FIRST
     LIMIT 20`,
  );
  for (const row of autoRows) {
    try {
      const event = await fetchLastEvent(row.resend_id);
      if (!event) continue;
      await db
        .update(automationSendsTable)
        .set(event !== row.last_event ? { lastEvent: event, lastEventAt: new Date() } : { lastEventAt: new Date() })
        .where(eq(automationSendsTable.id, row.id));
      await suppressIfHardEvent(row.email, event, null);
    } catch (err) {
      logger.debug({ err, resendId: row.resend_id }, "Resend automation event poll failed for one email");
    }
  }
}

// ── Seeds ─────────────────────────────────────────────────────────────────────

const TEMPLATE_SEEDS = [
  {
    key: "transactional_label_created", category: "transactional", name: "Order being prepared",
    description: "Sent when a shipping label is created for an order.",
    subject: "Your order {{orderNumber}} is being prepared", headline: "PREPARING FOR DISPATCH",
    body: "A shipping label has been created for your order. It will be handed to the carrier shortly.",
    ctaLabel: null as string | null, ctaUrl: null as string | null,
  },
  {
    key: "transactional_shipped", category: "transactional", name: "Order shipped",
    description: "Sent when the carrier picks up the order.",
    subject: "Your order {{orderNumber}} has shipped", headline: "SHIPMENT DEPLOYED",
    body: "The carrier has picked up your order. It is officially on its way to you.",
    ctaLabel: null, ctaUrl: null,
  },
  {
    key: "transactional_in_transit", category: "transactional", name: "Order in transit",
    description: "Sent when the shipment starts moving through the carrier network.",
    subject: "Your order {{orderNumber}} is on the move", headline: "IN TRANSIT",
    body: "Your order is moving through the carrier network and progressing toward you.",
    ctaLabel: null, ctaUrl: null,
  },
  {
    key: "transactional_out_for_delivery", category: "transactional", name: "Out for delivery",
    description: "Sent the day the shipment is on the delivery vehicle.",
    subject: "Out for delivery — order {{orderNumber}}", headline: "FINAL APPROACH",
    body: "Your order is on the delivery vehicle and should arrive today.",
    ctaLabel: null, ctaUrl: null,
  },
  {
    key: "transactional_delivered", category: "transactional", name: "Order delivered",
    description: "Sent when the carrier confirms delivery.",
    subject: "Delivered — order {{orderNumber}}", headline: "MISSION COMPLETE",
    body: "Your order has been delivered. Time to evolve. If anything looks wrong, reply to this email and we'll make it right.",
    ctaLabel: null, ctaUrl: null,
  },
  {
    key: "transactional_exception", category: "transactional", name: "Delivery exception",
    description: "Sent when the carrier reports a delivery problem.",
    subject: "Delivery update for order {{orderNumber}}", headline: "DELIVERY EXCEPTION",
    body: "The carrier reported an issue with your delivery. This usually resolves on its own, but keep an eye on tracking — and reach out if you need help.",
    ctaLabel: null, ctaUrl: null,
  },
  {
    key: "automation_welcome", category: "automation", name: "Welcome email",
    description: "Sent once when someone joins the newsletter.",
    subject: "Welcome to Evolve Performance", headline: "WELCOME TO THE CREW",
    body: "You're on the list. Expect training insight, drop alerts, and the occasional deal — no spam, ever.\n\nTime to evolve.",
    ctaLabel: "SHOP THE COLLECTION", ctaUrl: "/products",
  },
  {
    key: "automation_post_purchase", category: "automation", name: "Post-purchase check-in",
    description: "Sent a few days after an order to check in and invite a review.",
    subject: "How are the straps treating you?", headline: "CHECK IN",
    body: "Your order {{orderNumber}} should be with you by now. How's the grip holding up?\n\nIf anything's off, just reply to this email — a real person reads these. And if you're loving them, a review helps the crew grow.",
    ctaLabel: "LEAVE A REVIEW", ctaUrl: "/products",
  },
];

const AUTOMATION_SEEDS = [
  { key: "welcome", name: "Welcome new subscribers", enabled: true, delayHours: 0, templateKey: "automation_welcome" },
  { key: "post_purchase", name: "Post-purchase check-in", enabled: true, delayHours: 72, templateKey: "automation_post_purchase" },
];

/** Insert-only seeding: never overwrites owner edits. */
export async function seedMarketingDefaults(): Promise<void> {
  for (const t of TEMPLATE_SEEDS) {
    await db.insert(emailTemplatesTable).values(t).onConflictDoNothing();
  }
  for (const a of AUTOMATION_SEEDS) {
    await db.insert(marketingAutomationsTable).values(a).onConflictDoNothing();
  }
}

// ── Tick loop ─────────────────────────────────────────────────────────────────

let ticking = false;

export async function runMarketingTick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    await promoteScheduledCampaigns();
    await materializeCampaignRecipients();
    await processCampaignSendQueue();
    await completeFinishedCampaigns();
    await sweepAutomations();
    await pollResendEvents();
  } catch (err) {
    logger.error({ err }, "Marketing tick crashed");
  } finally {
    ticking = false;
  }
}

let intervalHandle: NodeJS.Timeout | null = null;

/** Start the background marketing loop (call once at server boot). */
export function startMarketingLoop(): void {
  if (intervalHandle) return;
  intervalHandle = setInterval(() => {
    runMarketingTick().catch((err) => logger.error({ err }, "Marketing tick crashed"));
  }, 45_000);
  setTimeout(() => {
    seedMarketingDefaults()
      .then(() => resetStaleSendingRows())
      .then(() => runMarketingTick())
      .catch((err) => logger.error({ err }, "Marketing boot sequence failed"));
  }, 8_000);
  logger.info({ testMode: isMarketingTestMode() }, "Marketing loop started (45s tick)");
}
