import { Router } from "express";
import { db } from "@workspace/db";
import { emailSubscribersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// POST /api/newsletter/subscribe
router.post("/subscribe", async (req, res) => {
  try {
    const { email, firstName, source } = req.body;

    await db
      .insert(emailSubscribersTable)
      .values({ email, firstName, source: source ?? "website", status: "active", consentAt: new Date() })
      .onConflictDoUpdate({ target: emailSubscribersTable.email, set: { status: "active", firstName, updatedAt: new Date() } } as any);

    res.json({ subscribed: true });
  } catch {
    res.status(500).json({ error: "Failed to subscribe" });
  }
});

// POST /api/newsletter/unsubscribe
router.post("/unsubscribe", async (req, res) => {
  try {
    const { email } = req.body;

    await db
      .update(emailSubscribersTable)
      .set({ status: "unsubscribed", unsubscribedAt: new Date() })
      .where(eq(emailSubscribersTable.email, email));

    res.json({ unsubscribed: true });
  } catch {
    res.status(500).json({ error: "Failed to unsubscribe" });
  }
});

export default router;
