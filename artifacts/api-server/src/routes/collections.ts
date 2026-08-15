import { Router } from "express";
import { db } from "@workspace/db";
import { collectionsTable, productCollectionsTable, productsTable, productVariantsTable, productImagesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

// GET /api/collections
router.get("/", async (_req, res) => {
  try {
    const collections = await db
      .select({
        id: collectionsTable.id,
        slug: collectionsTable.slug,
        name: collectionsTable.name,
        description: collectionsTable.description,
        imageUrl: collectionsTable.imageUrl,
        productCount: sql<number>`(
          SELECT COUNT(*) FROM product_collections pc
          JOIN products p ON p.id = pc.product_id
          WHERE pc.collection_id = ${collectionsTable.id} AND p.status = 'active'
        )::int`,
      })
      .from(collectionsTable)
      .where(eq(collectionsTable.active, true))
      .orderBy(collectionsTable.sortOrder);

    res.json(collections);
  } catch (e) {
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

    if (!collection) return res.status(404).json({ error: "Collection not found" });

    const products = await db
      .select({
        id: productsTable.id,
        slug: productsTable.slug,
        name: productsTable.name,
        theme: productsTable.theme,
        priceMin: sql<number>`MIN(pv.price_in_cents)::int`,
        priceMax: sql<number>`MAX(pv.price_in_cents)::int`,
        primaryImageUrl: sql<string | null>`(
          SELECT url FROM product_images pi WHERE pi.product_id = ${productsTable.id} AND pi.is_primary = true LIMIT 1
        )`,
        collectionName: collectionsTable.name,
        status: productsTable.status,
        stockStatus: sql<string>`CASE WHEN SUM(pv.stock_quantity - pv.reserved_quantity) > 0 THEN 'in_stock' ELSE 'out_of_stock' END`,
        averageRating: sql<number | null>`NULL`,
        reviewCount: sql<number>`0`,
      })
      .from(productsTable)
      .innerJoin(productCollectionsTable, eq(productCollectionsTable.productId, productsTable.id))
      .innerJoin(collectionsTable, eq(collectionsTable.id, productCollectionsTable.collectionId))
      .innerJoin(productVariantsTable, and(eq(productVariantsTable.productId, productsTable.id), eq(productVariantsTable.active, true)))
      .where(and(eq(productCollectionsTable.collectionId, collection.id), eq(productsTable.status, "active")))
      .groupBy(productsTable.id, productsTable.slug, productsTable.name, productsTable.theme, productsTable.status, collectionsTable.name)
      .orderBy(productCollectionsTable.sortOrder);

    res.json({ ...collection, products });
  } catch (e) {
    res.status(500).json({ error: "Failed to load collection" });
  }
});

export default router;
