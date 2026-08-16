import { Router } from "express";
import { db, pool } from "@workspace/db";
import { collectionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// GET /api/collections
router.get("/", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        c.id, c.slug, c.name, c.description, c.image_url AS "imageUrl",
        (
          SELECT COUNT(*)::int FROM product_collections pc
          JOIN products p ON p.id = pc.product_id
          WHERE pc.collection_id = c.id AND p.status = 'active'
        ) AS "productCount"
      FROM collections c
      WHERE c.active = true
      ORDER BY c.sort_order ASC
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load collections" });
  }
});

// GET /api/collections/:slug
router.get("/:slug", async (req, res) => {
  try {
    const [collection] = await db
      .select()
      .from(collectionsTable)
      .where(and(eq(collectionsTable.slug, req.params.slug), eq(collectionsTable.active, true)));

    if (!collection) { res.status(404).json({ error: "Collection not found" }); return; }

    const { rows: products } = await pool.query(
      `SELECT
         p.id, p.slug, p.name, p.theme,
         MIN(pv.price_in_cents)::int AS "priceMin",
         MAX(pv.price_in_cents)::int AS "priceMax",
         (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = true LIMIT 1) AS "primaryImageUrl",
         $1::text AS "collectionName",
         p.status,
         CASE WHEN SUM(pv.stock_quantity - pv.reserved_quantity) > 0 THEN 'in_stock' ELSE 'out_of_stock' END AS "stockStatus",
         NULL AS "averageRating",
         0 AS "reviewCount"
       FROM products p
       JOIN product_collections pc ON pc.product_id = p.id AND pc.collection_id = $2
       JOIN product_variants pv ON pv.product_id = p.id AND pv.active = true
       WHERE p.status = 'active'
       GROUP BY p.id
       ORDER BY MIN(pc.sort_order) ASC`,
      [collection.name, collection.id],
    );

    res.json({ ...collection, products });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load collection" });
  }
});

export default router;
