/**
 * Transactional email foundation (Resend via the Replit-managed connection).
 *
 * Idempotency contract: one row per (orderId, emailType) in transactional_emails,
 * enforced by a unique index. The row is claimed BEFORE sending; a duplicate
 * claim is a silent no-op, so a milestone email can never send twice — not
 * across retries, restarts, or concurrent ticks.
 */
import { ReplitConnectors } from "@replit/connectors-sdk";
import { db } from "@workspace/db";
import { transactionalEmailsTable, emailTemplatesTable } from "@workspace/db";
import { and, eq, lt } from "drizzle-orm";
import { logger } from "./logger";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "Evolve Performance <onboarding@resend.dev>";
const MAX_EMAIL_ATTEMPTS = 5;

export type MilestoneEmailType =
  | "label_created"
  | "shipped"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception";

interface MilestoneCopy {
  subject: (orderNumber: string) => string;
  headline: string;
  body: string;
}

const MILESTONE_COPY: Record<MilestoneEmailType, MilestoneCopy> = {
  label_created: {
    subject: (n) => `Your order ${n} is being prepared`,
    headline: "PREPARING FOR DISPATCH",
    body: "A shipping label has been created for your order. It will be handed to the carrier shortly.",
  },
  shipped: {
    subject: (n) => `Your order ${n} has shipped`,
    headline: "SHIPMENT DEPLOYED",
    body: "The carrier has picked up your order. It is officially on its way to you.",
  },
  in_transit: {
    subject: (n) => `Your order ${n} is on the move`,
    headline: "IN TRANSIT",
    body: "Your order is moving through the carrier network and progressing toward you.",
  },
  out_for_delivery: {
    subject: (n) => `Out for delivery — order ${n}`,
    headline: "FINAL APPROACH",
    body: "Your order is on the delivery vehicle and should arrive today.",
  },
  delivered: {
    subject: (n) => `Delivered — order ${n}`,
    headline: "MISSION COMPLETE",
    body: "Your order has been delivered. Time to evolve. If anything looks wrong, reply to this email and we'll make it right.",
  },
  exception: {
    subject: (n) => `Delivery update for order ${n}`,
    headline: "DELIVERY EXCEPTION",
    body: "The carrier reported an issue with your delivery. This usually resolves on its own, but keep an eye on tracking — and reach out if you need help.",
  },
};

function renderMilestoneHtml(input: {
  copy: MilestoneCopy;
  orderNumber: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrier: string | null;
}): string {
  const { copy, orderNumber, trackingNumber, trackingUrl, carrier } = input;
  const trackingBlock = trackingNumber
    ? `<tr><td style="padding:16px 0 0 0;">
         <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:2px;color:#9ca3af;">TRACKING${carrier ? ` — ${carrier.toUpperCase()}` : ""}</p>
         <p style="margin:0;font-size:15px;color:#f4f4f5;font-family:monospace;">${trackingNumber}</p>
       </td></tr>`
    : "";
  const buttonBlock = trackingUrl
    ? `<tr><td style="padding:28px 0 0 0;">
         <a href="${trackingUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-size:13px;letter-spacing:2px;padding:14px 28px;font-weight:bold;">TRACK SHIPMENT</a>
       </td></tr>`
    : "";
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0a0a0a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
      <tr><td style="border-bottom:2px solid #dc2626;padding:0 0 16px 0;">
        <p style="margin:0;font-size:18px;letter-spacing:6px;color:#ffffff;font-weight:bold;font-family:Arial,sans-serif;">EVOLVE<span style="color:#dc2626;">PERFORMANCE</span></p>
      </td></tr>
      <tr><td style="padding:32px 0 0 0;font-family:Arial,sans-serif;">
        <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:3px;color:#dc2626;font-weight:bold;">${copy.headline}</p>
        <p style="margin:0 0 4px 0;font-size:13px;color:#9ca3af;">Order <span style="color:#f4f4f5;font-family:monospace;">${orderNumber}</span></p>
        <p style="margin:16px 0 0 0;font-size:15px;line-height:1.6;color:#d4d4d8;">${copy.body}</p>
      </td></tr>
      ${trackingBlock}
      ${buttonBlock}
      <tr><td style="padding:40px 0 0 0;border-top:1px solid #27272a;margin-top:32px;">
        <p style="margin:24px 0 0 0;font-size:11px;color:#52525b;font-family:Arial,sans-serif;">Evolve Performance — lifting straps for the obsessed.<br/>You received this because you placed an order with us.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export async function sendViaResend(input: {
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
  /** Stable key so a crash-retry of the same logical send cannot double-deliver (Resend dedupes for 24h). */
  idempotencyKey?: string;
}): Promise<string> {
  const connectors = new ReplitConnectors();
  const response = (await connectors.proxy("resend", "/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      ...(input.headers ? { headers: input.headers } : {}),
    }),
  })) as unknown as Response;
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Resend error ${response.status}: ${text.slice(0, 300)}`);
  }
  const data: any = await response.json();
  return String(data?.id ?? "");
}

/** Lightweight Resend reachability probe for the admin system-status page. */
export async function checkResendHealth(): Promise<{ healthy: boolean; message: string | null }> {
  try {
    const connectors = new ReplitConnectors();
    const response = (await connectors.proxy("resend", "/domains", { method: "GET" })) as unknown as Response;
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { healthy: false, message: `Resend error ${response.status}: ${text.slice(0, 120)}` };
    }
    return { healthy: true, message: null };
  } catch (err) {
    return { healthy: false, message: err instanceof Error ? err.message : String(err) };
  }
}

// ── Owner-editable copy overrides ─────────────────────────────────────────────
// The admin email center stores editable versions of the milestone copy under
// keys like `transactional_shipped`. When present, they override the hardcoded
// defaults above (cached ~60s so the send path stays fast).

const templateCache = new Map<string, { copy: MilestoneCopy | null; at: number }>();

export function invalidateTemplateCache(): void {
  templateCache.clear();
}

async function milestoneCopy(type: MilestoneEmailType): Promise<MilestoneCopy> {
  const key = `transactional_${type}`;
  const cached = templateCache.get(key);
  if (cached && Date.now() - cached.at < 60_000) {
    return cached.copy ?? MILESTONE_COPY[type];
  }
  let copy: MilestoneCopy | null = null;
  try {
    const [row] = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.key, key));
    if (row) {
      copy = {
        subject: (n) => row.subject.replaceAll("{{orderNumber}}", n),
        headline: row.headline,
        body: row.body,
      };
    }
  } catch (err) {
    logger.warn({ err, key }, "Template override lookup failed; using built-in copy");
  }
  templateCache.set(key, { copy, at: Date.now() });
  return copy ?? MILESTONE_COPY[type];
}

export interface MilestoneEmailInput {
  orderId: number;
  shipmentId: number | null;
  orderNumber: string;
  emailType: MilestoneEmailType;
  recipient: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrier: string | null;
}

/**
 * Send a shipping-milestone email exactly once per (order, milestone).
 * Returns "sent", "duplicate" (already claimed), or "failed" (claimed; will retry).
 */
export async function sendMilestoneEmail(input: MilestoneEmailInput): Promise<"sent" | "duplicate" | "failed"> {
  const claimed = await db
    .insert(transactionalEmailsTable)
    .values({
      orderId: input.orderId,
      shipmentId: input.shipmentId,
      emailType: input.emailType,
      recipient: input.recipient,
      status: "sending",
      attempts: 1,
    })
    .onConflictDoNothing()
    .returning({ id: transactionalEmailsTable.id });

  const claim = claimed[0];
  if (!claim) return "duplicate";

  const copy = await milestoneCopy(input.emailType);
  try {
    const resendId = await sendViaResend({
      to: input.recipient,
      subject: copy.subject(input.orderNumber),
      html: renderMilestoneHtml({
        copy,
        orderNumber: input.orderNumber,
        trackingNumber: input.trackingNumber,
        trackingUrl: input.trackingUrl,
        carrier: input.carrier,
      }),
    });
    await db
      .update(transactionalEmailsTable)
      .set({ status: "sent", resendId, sentAt: new Date(), error: null })
      .where(eq(transactionalEmailsTable.id, claim.id));
    logger.info({ orderId: input.orderId, emailType: input.emailType }, "Milestone email sent");
    return "sent";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(transactionalEmailsTable)
      .set({ status: "failed", error: msg.slice(0, 500) })
      .where(eq(transactionalEmailsTable.id, claim.id));
    logger.warn({ orderId: input.orderId, emailType: input.emailType, err: msg }, "Milestone email failed; will retry");
    return "failed";
  }
}

/** Retry previously failed milestone emails (bounded attempts). Called by the fulfillment tick. */
export async function retryFailedEmails(orderContext: (orderId: number) => Promise<{
  orderNumber: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrier: string | null;
} | null>): Promise<void> {
  const failed = await db
    .select()
    .from(transactionalEmailsTable)
    .where(and(eq(transactionalEmailsTable.status, "failed"), lt(transactionalEmailsTable.attempts, MAX_EMAIL_ATTEMPTS)))
    .limit(10);

  for (const row of failed) {
    const ctx = await orderContext(row.orderId);
    if (!ctx) continue;
    if (!MILESTONE_COPY[row.emailType as MilestoneEmailType]) continue;
    const copy = await milestoneCopy(row.emailType as MilestoneEmailType);
    try {
      const resendId = await sendViaResend({
        to: row.recipient,
        subject: copy.subject(ctx.orderNumber),
        html: renderMilestoneHtml({
          copy,
          orderNumber: ctx.orderNumber,
          trackingNumber: ctx.trackingNumber,
          trackingUrl: ctx.trackingUrl,
          carrier: ctx.carrier,
        }),
      });
      await db
        .update(transactionalEmailsTable)
        .set({ status: "sent", resendId, sentAt: new Date(), error: null, attempts: row.attempts + 1 })
        .where(eq(transactionalEmailsTable.id, row.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db
        .update(transactionalEmailsTable)
        .set({ attempts: row.attempts + 1, error: msg.slice(0, 500) })
        .where(eq(transactionalEmailsTable.id, row.id));
    }
  }
}
