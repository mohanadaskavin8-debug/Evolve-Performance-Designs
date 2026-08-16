import { Router } from "express";
import { db } from "@workspace/db";
import { shippingZonesTable, shippingRatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { onShipStationWebhook } from "../lib/fulfillment";

const router = Router();

// POST /api/shipping/shipstation/webhook
// ShipStation webhooks carry no verifiable signature, so the payload is treated
// as an untrusted "something changed" hint: we never write payload data, we only
// schedule a re-poll of the authoritative API. Forged requests can, at worst,
// cause an extra poll. Always 200 so ShipStation doesn't disable the hook.
router.post("/shipstation/webhook", async (_req, res) => {
  try {
    await onShipStationWebhook();
  } catch (err) {
    console.error("ShipStation webhook handling failed:", err);
  }
  res.json({ received: true });
});

// GET /api/shipping/zones
router.get("/zones", async (_req, res) => {
  try {
    const zones = await db.select().from(shippingZonesTable).where(eq(shippingZonesTable.active, true));
    const result = await Promise.all(
      zones.map(async (zone) => {
        const rates = await db
          .select()
          .from(shippingRatesTable)
          .where(eq(shippingRatesTable.zoneId, zone.id));
        return { ...zone, rates };
      }),
    );
    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to load shipping zones" });
  }
});

export default router;
