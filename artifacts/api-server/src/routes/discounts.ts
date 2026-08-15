import { Router } from "express";
import { db } from "@workspace/db";
import { discountsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// GET /api/discounts/:code
router.get("/:code", async (req, res) => {
  try {
    const [discount] = await db
      .select()
      .from(discountsTable)
      .where(and(eq(discountsTable.code, req.params.code.toUpperCase()), eq(discountsTable.active, true)));

    if (!discount) return res.status(404).json({ error: "Discount not found" });

    res.json({
      code: discount.code,
      discountType: discount.discountType,
      value: discount.value,
      active: discount.active,
      minimumOrderInCents: discount.minimumOrderInCents,
      expiresAt: discount.expiresAt?.toISOString() ?? null,
    });
  } catch {
    res.status(500).json({ error: "Failed to load discount" });
  }
});

export default router;
