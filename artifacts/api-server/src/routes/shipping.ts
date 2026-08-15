import { Router } from "express";
import { db } from "@workspace/db";
import { shippingZonesTable, shippingRatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

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
