import { Router } from "express";
import { db, pool } from "@workspace/db";
import { emailSubscribersTable, emailSuppressionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { triggerWelcomeAutomation, sendResubscribeConfirmation } from "../lib/marketing";
import { classifySignup } from "../lib/consent";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/newsletter/subscribe
router.post("/subscribe", async (req, res) => {
  try {
    const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!rawEmail || rawEmail.length > 254 || !EMAIL_RE.test(rawEmail)) {
      res.status(400).json({ error: "A valid email address is required" });
      return;
    }
    const firstName =
      typeof req.body?.firstName === "string" && req.body.firstName.trim()
        ? req.body.firstName.trim().slice(0, 100)
        : null;
    const source =
      typeof req.body?.source === "string" && req.body.source.trim()
        ? req.body.source.trim().slice(0, 50)
        : "website";

    const [existing] = await db
      .select({ status: emailSubscribersTable.status })
      .from(emailSubscribersTable)
      .where(eq(emailSubscribersTable.email, rawEmail));
    const suppressions = await db
      .select({ reason: emailSuppressionsTable.reason })
      .from(emailSuppressionsTable)
      .where(eq(emailSuppressionsTable.email, rawEmail));

    const decision = classifySignup({
      existingStatus: existing?.status ?? null,
      suppressionReasons: suppressions.map((s) => s.reason),
    });

    // The response is identical in every branch: an unauthenticated POST must
    // not reveal whether an address exists, opted out, or bounced — and it
    // must never silently restore consent the mailbox owner revoked.
    if (decision.action !== "subscribe") {
      res.json({ subscribed: true });
      if (decision.action === "confirm_required") {
        // Double opt-in: the owner gets a signed confirmation link; nothing
        // changes unless they click it. Rate-limited to one email per day.
        sendResubscribeConfirmation(rawEmail).catch((err) =>
          logger.warn({ err, email: rawEmail }, "Re-subscribe confirmation trigger failed"),
        );
      }
      return;
    }

    // Guarded upsert: if the owner unsubscribes between our check above and
    // this write, the WHERE clause keeps the row untouched (and send-time
    // suppression checks remain the final backstop regardless).
    await pool.query(
      `INSERT INTO email_subscribers (email, first_name, source, status, consent_at)
       VALUES ($1, $2, $3, 'active', NOW())
       ON CONFLICT (email) DO UPDATE
       SET status = 'active', consent_at = NOW(), unsubscribed_at = NULL,
           first_name = COALESCE($2, email_subscribers.first_name)
       WHERE email_subscribers.status <> 'unsubscribed'`,
      [rawEmail, firstName, source],
    );

    res.json({ subscribed: true });

    // Fire the welcome automation after responding (idempotent — at most one per address, ever).
    triggerWelcomeAutomation(rawEmail, firstName).catch((err) =>
      logger.warn({ err, email: rawEmail }, "Welcome automation trigger failed"),
    );
  } catch (err) {
    logger.error({ err }, "Newsletter subscribe failed");
    res.status(500).json({ error: "Failed to subscribe" });
  }
});

// NOTE: there is intentionally no email-only unsubscribe endpoint here — an
// attacker could suppress arbitrary addresses. All public unsubscribes go
// through the HMAC-signed token flow in routes/marketing.ts, and reactivation
// of an opted-out address goes through the double opt-in flow there too.

export default router;
