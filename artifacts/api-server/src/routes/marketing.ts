/**
 * Public marketing endpoints: unsubscribe token resolution + confirmation.
 *
 * POST /unsubscribe accepts the token in the JSON body OR the query string —
 * the query form is what one-click unsubscribe (RFC 8058 List-Unsubscribe-Post)
 * uses, since mail clients POST to the URL without a body.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, emailSubscribersTable, emailSuppressionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { verifyUnsubscribeToken, verifyResubscribeToken } from "../lib/marketing-email";
import { and } from "drizzle-orm";

const router = Router();

function extractToken(req: any): string | null {
  const fromBody = typeof req.body?.token === "string" ? req.body.token : null;
  const fromQuery = typeof req.query?.token === "string" ? req.query.token : null;
  return fromBody || fromQuery;
}

// GET /api/marketing/unsubscribe/info?token=...
router.get("/unsubscribe/info", async (req, res) => {
  const token = typeof req.query?.token === "string" ? req.query.token : "";
  const parsed = token ? verifyUnsubscribeToken(token) : null;
  if (!parsed) {
    res.status(400).json({ error: "This unsubscribe link is invalid or has been tampered with" });
    return;
  }
  try {
    const [suppressed] = await db
      .select({ id: emailSuppressionsTable.id })
      .from(emailSuppressionsTable)
      .where(eq(emailSuppressionsTable.email, parsed.email));
    res.json({ email: parsed.email, alreadyUnsubscribed: Boolean(suppressed) });
  } catch (err) {
    logger.error({ err }, "Unsubscribe info lookup failed");
    res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/marketing/unsubscribe  (token in body or ?token= for one-click)
router.post("/unsubscribe", async (req, res) => {
  const token = extractToken(req);
  const parsed = token ? verifyUnsubscribeToken(token) : null;
  if (!parsed) {
    res.status(400).json({ error: "This unsubscribe link is invalid or has been tampered with" });
    return;
  }
  try {
    // Global suppression — checked at send time by every marketing send path.
    await db
      .insert(emailSuppressionsTable)
      .values({ email: parsed.email, reason: "unsubscribe", campaignId: parsed.campaignId })
      .onConflictDoNothing();
    await db
      .update(emailSubscribersTable)
      .set({ status: "unsubscribed", unsubscribedAt: new Date() })
      .where(eq(emailSubscribersTable.email, parsed.email));
    await db
      .update(customersTable)
      .set({ marketingConsent: false })
      .where(eq(customersTable.email, parsed.email));

    logger.info({ email: parsed.email, campaignId: parsed.campaignId }, "Unsubscribed via token link");
    res.json({ unsubscribed: true, email: parsed.email });
  } catch (err) {
    logger.error({ err }, "Unsubscribe failed");
    res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/marketing/resubscribe — double opt-in confirmation. Only a signed,
// unexpired token from the confirmation email can restore revoked consent.
router.post("/resubscribe", async (req, res) => {
  const token = extractToken(req);
  const parsed = token ? verifyResubscribeToken(token) : null;
  if (!parsed) {
    res.status(400).json({ error: "This confirmation link is invalid or has expired" });
    return;
  }
  try {
    // Hard suppressions survive even explicit re-consent — a bounced or
    // complained address damages deliverability no matter what.
    const suppressions = await db
      .select({ reason: emailSuppressionsTable.reason })
      .from(emailSuppressionsTable)
      .where(eq(emailSuppressionsTable.email, parsed.email));
    if (suppressions.some((s) => s.reason === "bounce" || s.reason === "complaint")) {
      res.status(409).json({ error: "This address can't receive our emails — it previously bounced or reported our mail as spam" });
      return;
    }

    // This IS the verified re-consent, so the unconditional upsert is correct here.
    await db
      .insert(emailSubscribersTable)
      .values({ email: parsed.email, source: "reconfirm", status: "active", consentAt: new Date() })
      .onConflictDoUpdate({
        target: emailSubscribersTable.email,
        set: { status: "active", consentAt: new Date(), unsubscribedAt: null },
      });
    await db
      .delete(emailSuppressionsTable)
      .where(and(eq(emailSuppressionsTable.email, parsed.email), eq(emailSuppressionsTable.reason, "unsubscribe")));
    await db
      .update(customersTable)
      .set({ marketingConsent: true })
      .where(eq(customersTable.email, parsed.email));

    logger.info({ email: parsed.email }, "Re-subscribed via double opt-in confirmation");
    res.json({ confirmed: true, email: parsed.email });
  } catch (err) {
    logger.error({ err }, "Re-subscribe confirmation failed");
    res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;
