import { Router } from "express";
import { getAuth } from "@clerk/express";
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
// Requires Clerk auth; orderId must belong to the authenticated customer
router.post("/:slug/reviews", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Authentication required to submit a review" });

    const [product] = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.slug, req.params.slug));
    if (!product) return res.status(404).json({ error: "Product not found" });

    const { rating, title, body, orderId, reviewerName } = req.body;

    // Look up the customer for this Clerk user
    const [customer] = await db.select({ id: customersTable.id }).from(customersTable).where(eq(customersTable.clerkUserId, userId));
    if (!customer) return res.status(404).json({ error: "Customer account not found" });

    // Verify the order belongs to this customer and contains this product
    let isVerified = false;
    if (orderId) {
      const [order] = await db
        .select({ id: ordersTable.id })
        .from(ordersTable)
        .where(and(eq(ordersTable.id, Number(orderId)), eq(ordersTable.customerId, customer.id)));

      if (!order) return res.status(403).json({ error: "Order does not belong to your account" });

      const [orderItem] = await db
        .select({ id: orderItemsTable.id })
        .from(orderItemsTable)
        .where(and(eq(orderItemsTable.orderId, order.id), eq(orderItemsTable.productId, product.id)));

      isVerified = !!orderItem;
    }

    if (!isVerified) return res.status(403).json({ error: "No verified purchase for this product on your account" });

    const [review] = await db.insert(reviewsTable).values({
      productId: product.id,
      orderId: orderId ? Number(orderId) : null,
      rating,
      title,
      body,
      reviewerName: reviewerName ?? "Anonymous",
      isVerified,
      isApproved: false, // admin approves
    }).returning();

    res.status(201).json({ ...review, createdAt: review.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to submit review" });
  }
});

export default router;
