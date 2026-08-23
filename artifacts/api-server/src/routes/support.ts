/**
 * Customer support requests.
 *
 * Requests are stored in the local database — that row is the source of
 * truth. There is no email pipeline in this app; orders, payments,
 * shipping and customer email all live in Shopify.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { supportRequestsTable } from "@workspace/db";
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

    // The table has no order-number column — keep the customer's order
    // reference by prefixing it into the stored message.
    const orderRef =
      typeof orderNumber === "string" && orderNumber.trim() ? orderNumber.trim() : null;

    const [request] = await db.insert(supportRequestsTable).values({
      customerId: null,
      orderId: null,
      email: email.trim(),
      name: typeof name === "string" && name.trim() ? name.trim() : null,
      subject: subject.trim(),
      message: orderRef ? `[Order ${orderRef}]\n${message.trim()}` : message.trim(),
      status: "open",
      priority: "normal",
    }).returning();

    res.status(201).json({
      id: request.id,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Failed to submit support request");
    res.status(500).json({ error: "Failed to submit support request" });
  }
});

export default router;
