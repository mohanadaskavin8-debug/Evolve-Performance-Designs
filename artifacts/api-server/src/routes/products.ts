import { Router } from "express";
import { db } from "@workspace/db";
import {
  productsTable, productVariantsTable, productImagesTable,
  productCollectionsTable, collectionsTable, reviewsTable
} from "@workspace/db";
import { eq, and, ilike, sql, desc, asc } from "drizzle-orm";

const router = Router();

// GET /api/products/featured
router.get("/featured", async (_req, res) => {
  try {
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
        collectionName: sql<string | null>`(
          SELECT c.name FROM product_collections pc JOIN collections c ON c.id = pc.collection_id WHERE pc.product_id = ${productsTable.id} LIMIT 1
        )`,
        status: productsTable.status,
        stockStatus: sql<string>`CASE WHEN SUM(pv.stock_quantity - pv.reserved_quantity) > 0 THEN 'in_stock' ELSE 'out_of_stock' END`,
        averageRating: sql<number | null>`NULL`,
        reviewCount: sql<number>`0`,
      })
      .from(productsTable)
      .innerJoin(productVariantsTable, and(eq(productVariantsTable.productId, productsTable.id), eq(productVariantsTable.active, true)))
      .where(and(eq(productsTable.status, "active"), eq(productsTable.isFeatured, true)))
      .groupBy(productsTable.id)
      .orderBy(asc(productsTable.sortOrder))
      .limit(12);

    res.json(products);
  } catch (e) {
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

    let query = db
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
        collectionName: sql<string | null>`(
          SELECT c.name FROM product_collections pc JOIN collections c ON c.id = pc.collection_id WHERE pc.product_id = ${productsTable.id} LIMIT 1
        )`,
        status: productsTable.status,
        stockStatus: sql<string>`CASE WHEN SUM(pv.stock_quantity - pv.reserved_quantity) > 0 THEN 'in_stock' ELSE 'out_of_stock' END`,
        averageRating: sql<number | null>`NULL`,
        reviewCount: sql<number>`0`,
      })
      .from(productsTable)
      .innerJoin(productVariantsTable, and(eq(productVariantsTable.productId, productsTable.id), eq(productVariantsTable.active, true)));

    const conditions = [eq(productsTable.status, "active")];
    if (search) conditions.push(ilike(productsTable.name, `%${search}%`));

    if (collection) {
      query = (query as any)
        .innerJoin(productCollectionsTable, eq(productCollectionsTable.productId, productsTable.id))
        .innerJoin(collectionsTable, and(eq(collectionsTable.id, productCollectionsTable.collectionId), eq(collectionsTable.slug, collection)));
    }

    const rows = await (query as any)
      .where(and(...conditions))
      .groupBy(productsTable.id)
      .orderBy(asc(productsTable.sortOrder))
      .limit(limit)
      .offset(offset);

    // count
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(eq(productsTable.status, "active"));

    res.json({ products: rows, total: count });
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
      db.select({ id: collectionsTable.id, slug: collectionsTable.slug, name: collectionsTable.name, description: collectionsTable.description, imageUrl: collectionsTable.imageUrl, productCount: sql<number>`0` })
        .from(collectionsTable)
        .innerJoin(productCollectionsTable, eq(productCollectionsTable.collectionId, collectionsTable.id))
        .where(eq(productCollectionsTable.productId, product.id)),
    ]);

    const mappedVariants = variants.map(v => ({
      ...v,
      availableQuantity: Math.max(0, v.stockQuantity - v.reservedQuantity),
    }));

    res.json({ ...product, variants: mappedVariants, images, collections, averageRating: null, reviewCount: 0 });
  } catch (e) {
    res.status(500).json({ error: "Failed to load product" });
  }
});

export default router;
