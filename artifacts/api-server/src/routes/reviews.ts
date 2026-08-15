import { Router } from "express";
import { db } from "@workspace/db";
import { reviewsTable, productsTable, orderItemsTable, ordersTable, customersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

// GET /api/products/:slug/reviews
router.get("/:slug/reviews", async (req, res) => {
  try {
    const [product] = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.slug, req.params.slug));
    if (!product) return res.status(404).json({ error: "Product not found" });

    const reviews = await db
      .select()
      .from(reviewsTable)
      .where(and(eq(reviewsTable.productId, product.id), eq(reviewsTable.isApproved, true)))
      .orderBy(desc(reviewsTable.createdAt));

    res.json(reviews.map(r => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      reviewerName: r.reviewerName,
      isVerified: r.isVerified,
      createdAt: r.createdAt.toISOString(),
    })));
  } catch {
    res.status(500).json({ error: "Failed to load reviews" });
  }
});

// POST /api/products/:slug/reviews
router.post("/:slug/reviews", async (req, res) => {
  try {
    const [product] = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.slug, req.params.slug));
    if (!product) return res.status(404).json({ error: "Product not found" });

    const { rating, title, body, orderId } = req.body;

    // Verify purchase
    let isVerified = false;
    if (orderId) {
      const [orderItem] = await db
        .select()
        .from(orderItemsTable)
        .where(and(eq(orderItemsTable.orderId, orderId), eq(orderItemsTable.productId, product.id)));
      isVerified = !!orderItem;
    }

    if (!isVerified) return res.status(403).json({ error: "No verified purchase for this product" });

    const [review] = await db.insert(reviewsTable).values({
      productId: product.id,
      orderId: orderId ?? null,
      rating,
      title,
      body,
      reviewerName: req.body.reviewerName ?? "Anonymous",
      isVerified,
      isApproved: false, // admin approves
    }).returning();

    res.status(201).json({ ...review, createdAt: review.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to submit review" });
  }
});

export default router;
