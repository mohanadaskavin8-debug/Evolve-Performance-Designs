import { Router } from "express";
import { db } from "@workspace/db";
import {
  productsTable, productVariantsTable, productImagesTable,
  productCollectionsTable, collectionsTable,
} from "@workspace/db";
import { eq, and, ilike, sql, asc, count } from "drizzle-orm";

const router = Router();

// Shared helper: build a ProductCard from product rows using raw SQL
// We use pool.query for complex aggregations to avoid Drizzle alias issues
import { pool } from "@workspace/db";

async function queryProductCards(
  where: string,
  params: unknown[],
  limit = 24,
  offset = 0,
): Promise<unknown[]> {
  const { rows } = await pool.query(
    `SELECT
       p.id,
       p.slug,
       p.name,
       p.theme,
       MIN(pv.price_in_cents)::int AS "priceMin",
       MAX(pv.price_in_cents)::int AS "priceMax",
       (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = true LIMIT 1) AS "primaryImageUrl",
       (SELECT c.name FROM product_collections pc JOIN collections c ON c.id = pc.collection_id WHERE pc.product_id = p.id LIMIT 1) AS "collectionName",
       p.status,
       CASE WHEN SUM(pv.stock_quantity - pv.reserved_quantity) > 0 THEN 'in_stock' ELSE 'out_of_stock' END AS "stockStatus",
       COALESCE(
         (SELECT ROUND(AVG(r.rating)::numeric, 1) FROM reviews r WHERE r.product_id = p.id AND r.is_approved = true),
         NULL
       ) AS "averageRating",
       (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.is_approved = true)::int AS "reviewCount"
     FROM products p
     JOIN product_variants pv ON pv.product_id = p.id AND pv.active = true
     WHERE ${where}
     GROUP BY p.id
     ORDER BY p.sort_order ASC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return rows;
}

// GET /api/products/featured
router.get("/featured", async (_req, res) => {
  try {
    const products = await queryProductCards("p.status = 'active' AND p.is_featured = true", [], 12, 0);
    res.json(products);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load featured products" });
  }
});

// GET /api/products
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 24, 100);
    const offset = Number(req.query.offset) || 0;
    const search = req.query.search as string | undefined;
    const collection = req.query.collection as string | undefined;

    let whereParts = ["p.status = 'active'"];
    const params: unknown[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereParts.push(`p.name ILIKE $${params.length}`);
    }

    let joinPart = "";
    if (collection) {
      joinPart = `JOIN product_collections pc2 ON pc2.product_id = p.id JOIN collections c2 ON c2.id = pc2.collection_id AND c2.slug = $${params.length + 1}`;
      params.push(collection);
    }

    const where = whereParts.join(" AND ");

    const { rows } = await pool.query(
      `SELECT
         p.id, p.slug, p.name, p.theme,
         MIN(pv.price_in_cents)::int AS "priceMin",
         MAX(pv.price_in_cents)::int AS "priceMax",
         (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = true LIMIT 1) AS "primaryImageUrl",
         (SELECT c.name FROM product_collections pc JOIN collections c ON c.id = pc.collection_id WHERE pc.product_id = p.id LIMIT 1) AS "collectionName",
         p.status,
         CASE WHEN SUM(pv.stock_quantity - pv.reserved_quantity) > 0 THEN 'in_stock' ELSE 'out_of_stock' END AS "stockStatus",
         NULL AS "averageRating",
         0 AS "reviewCount"
       FROM products p
       JOIN product_variants pv ON pv.product_id = p.id AND pv.active = true
       ${joinPart}
       WHERE ${where}
       GROUP BY p.id
       ORDER BY p.sort_order ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    const [{ count: total }] = (await pool.query(
      `SELECT COUNT(DISTINCT p.id)::int as count FROM products p WHERE p.status = 'active'`,
    )).rows;

    res.json({ products: rows, total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load products" });
  }
});

// GET /api/products/:slug
router.get("/:slug", async (req, res) => {
  try {
    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.slug, req.params.slug), eq(productsTable.status, "active")));

    if (!product) return res.status(404).json({ error: "Product not found" });

    const [variants, images, collections] = await Promise.all([
      db.select().from(productVariantsTable)
        .where(and(eq(productVariantsTable.productId, product.id), eq(productVariantsTable.active, true)))
        .orderBy(asc(productVariantsTable.sortOrder)),
      db.select().from(productImagesTable)
        .where(eq(productImagesTable.productId, product.id))
        .orderBy(asc(productImagesTable.position)),
      pool.query(
        `SELECT c.id, c.slug, c.name, c.description, c.image_url AS "imageUrl", 0 AS "productCount"
         FROM collections c
         JOIN product_collections pc ON pc.collection_id = c.id
         WHERE pc.product_id = $1`,
        [product.id],
      ).then(r => r.rows),
    ]);

    const mappedVariants = variants.map(v => ({
      ...v,
      availableQuantity: Math.max(0, v.stockQuantity - v.reservedQuantity),
    }));

    res.json({ ...product, variants: mappedVariants, images, collections, averageRating: null, reviewCount: 0 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load product" });
  }
});

export default router;
