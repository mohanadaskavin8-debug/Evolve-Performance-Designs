/**
 * Customer support requests.
 *
 * Requests are stored in the local database AND forwarded to the store owner
 * by email (Reply-To is set to the customer, so the owner can answer straight
 * from their inbox — there is no first-party admin queue anymore since store
 * management moved to Shopify).
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { supportRequestsTable, adminRolesTable, siteSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendViaResend } from "../lib/email";
import { logger } from "../lib/logger";

const router = Router();

// POST /api/support/requests
router.post("/requests", async (req, res) => {
  try {
    const { email, name, subject, message, orderNumber } = req.body ?? {};

    if (
      typeof email !== "string" || !email.includes("@") ||
      typeof subject !== "string" || !subject.trim() ||
      typeof message !== "string" || !message.trim()
    ) {
      res.status(400).json({ error: "email, subject and message are required" });
      return;
    }

    const [request] = await db.insert(supportRequestsTable).values({
      customerId: null,
      orderId: null,
      email: email.trim(),
      name: typeof name === "string" && name.trim() ? name.trim() : null,
      subject: subject.trim(),
      message: message.trim(),
      status: "open",
      priority: "normal",
    }).returning();

    res.status(201).json({
      id: request.id,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
    });

    // Fire-and-forget owner notification — the DB row is the source of truth,
    // a failed email must not fail the customer's submission.
    void notifyOwner({
      requestId: request.id,
      email: email.trim(),
      name: typeof name === "string" ? name.trim() : "",
      subject: subject.trim(),
      message: message.trim(),
      orderNumber: typeof orderNumber === "string" ? orderNumber.trim() : "",
    }).catch((err) => {
      logger.error({ err, requestId: request.id }, "Support owner notification failed");
    });
  } catch (err) {
    logger.error({ err }, "Failed to submit support request");
    res.status(500).json({ error: "Failed to submit support request" });
  }
});

async function notifyOwner(input: {
  requestId: number;
  email: string;
  name: string;
  subject: string;
  message: string;
  orderNumber: string;
}): Promise<void> {
  const ownerEmail = await resolveOwnerEmail();
  if (!ownerEmail) {
    logger.warn("No owner email found (admin_roles owner or site_settings support_email) — skipping support notification");
    return;
  }

  const rows: [string, string][] = [
    ["From", input.name ? `${input.name} <${input.email}>` : input.email],
    ...(input.orderNumber ? ([["Order", input.orderNumber]] as [string, string][]) : []),
    ["Subject", input.subject],
  ];

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="margin: 0 0 4px;">New support request #${input.requestId}</h2>
      <p style="margin: 0 0 16px; color: #666;">Sent from the Evolve Performance storefront support page. Reply to this email to answer the customer directly.</p>
      <table style="border-collapse: collapse; width: 100%; margin-bottom: 16px;">
        ${rows
          .map(
            ([label, value]) =>
              `<tr><td style="padding: 6px 12px 6px 0; color: #666; white-space: nowrap; vertical-align: top;">${label}</td><td style="padding: 6px 0;">${escapeHtml(value)}</td></tr>`,
          )
          .join("")}
      </table>
      <div style="border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; white-space: pre-wrap;">${escapeHtml(input.message)}</div>
    </div>`;

  await sendViaResend({
    to: ownerEmail,
    subject: `[Support] ${input.subject}${input.orderNumber ? ` (order ${input.orderNumber})` : ""}`,
    html,
    replyTo: input.email,
  });
  logger.info({ requestId: input.requestId, ownerEmail }, "Support notification sent");
}

async function resolveOwnerEmail(): Promise<string | null> {
  try {
    const [owner] = await db
      .select({ email: adminRolesTable.email })
      .from(adminRolesTable)
      .where(eq(adminRolesTable.role, "owner"))
      .limit(1);
    if (owner?.email) return owner.email;

    const [setting] = await db
      .select({ value: siteSettingsTable.value })
      .from(siteSettingsTable)
      .where(eq(siteSettingsTable.key, "support_email"))
      .limit(1);
    return setting?.value || null;
  } catch (err) {
    logger.error({ err }, "Owner email lookup failed");
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default router;
