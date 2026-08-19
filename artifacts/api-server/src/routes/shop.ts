/**
 * Shop routes — everything commerce is read from / written to the owner's
 * Shopify store via the Storefront API. No local product, order or cart
 * tables are involved; Shopify is the system of record and its hosted
 * checkout handles payment, shipping and taxes.
 *
 * Response shapes intentionally mirror the retired first-party catalog API
 * (prices in integer cents, `theme` derived from tags) so the storefront UI
 * kept its design with minimal rewiring.
 */
import { Router, type Request, type Response } from "express";
import {
  shopifyStorefrontRequest,
  ShopifyConfigError,
} from "../lib/shopifyStorefrontClient";
import { logger } from "../lib/logger";

const router = Router();

// ── Money + mapping helpers ───────────────────────────────────────────────────

function toCents(amount: string | null | undefined): number {
  if (!amount) return 0;
  const parsed = Number.parseFloat(amount);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

/** First tag that isn't the "featured" marker — the storefront's theme filter. */
function deriveTheme(tags: string[]): string | null {
  return tags.find((t) => t.trim().toLowerCase() !== "featured") ?? null;
}

type GqlMoney = { amount: string };
type GqlImage = { url: string } | null;

type GqlProductCard = {
  id: string;
  handle: string;
  title: string;
  availableForSale: boolean;
  tags: string[];
  featuredImage: GqlImage;
  priceRange: { minVariantPrice: GqlMoney; maxVariantPrice: GqlMoney };
  compareAtPriceRange: { maxVariantPrice: GqlMoney } | null;
};

function mapProductCard(p: GqlProductCard) {
  const compareAt = toCents(p.compareAtPriceRange?.maxVariantPrice?.amount);
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    priceMinInCents: toCents(p.priceRange.minVariantPrice.amount),
    priceMaxInCents: toCents(p.priceRange.maxVariantPrice.amount),
    compareAtPriceInCents: compareAt > 0 ? compareAt : null,
    imageUrl: p.featuredImage?.url ?? null,
    theme: deriveTheme(p.tags),
    tags: p.tags,
    availableForSale: p.availableForSale,
  };
}

const PRODUCT_CARD_FRAGMENT = /* GraphQL */ `
  fragment ProductCard on Product {
    id
    handle
    title
    availableForSale
    tags
    featuredImage { url }
    priceRange {
      minVariantPrice { amount }
      maxVariantPrice { amount }
    }
    compareAtPriceRange {
      maxVariantPrice { amount }
    }
  }
`;

const CART_FRAGMENT = /* GraphQL */ `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost { subtotalAmount { amount } }
    lines(first: 100) {
      nodes {
        id
        quantity
        cost { totalAmount { amount } }
        merchandise {
          ... on ProductVariant {
            id
            title
            price { amount }
            image { url }
            product {
              title
              handle
              featuredImage { url }
            }
          }
        }
      }
    }
  }
`;

type GqlCartLine = {
  id: string;
  quantity: number;
  cost: { totalAmount: GqlMoney };
  merchandise: {
    id: string;
    title: string;
    price: GqlMoney;
    image: GqlImage;
    product: { title: string; handle: string; featuredImage: GqlImage };
  };
};

type GqlCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: GqlMoney };
  lines: { nodes: GqlCartLine[] };
};

const EMPTY_CART = {
  id: null,
  checkoutUrl: null,
  totalQuantity: 0,
  subtotalInCents: 0,
  lines: [] as ReturnType<typeof mapCartLine>[],
};

function mapCartLine(line: GqlCartLine) {
  const merch = line.merchandise;
  return {
    id: line.id,
    quantity: line.quantity,
    merchandiseId: merch.id,
    productTitle: merch.product.title,
    productHandle: merch.product.handle,
    variantTitle: merch.title,
    priceInCents: toCents(merch.price.amount),
    lineTotalInCents: toCents(line.cost.totalAmount.amount),
    imageUrl: merch.image?.url ?? merch.product.featuredImage?.url ?? null,
  };
}

function mapCart(cart: GqlCart | null | undefined) {
  if (!cart) return EMPTY_CART;
  return {
    id: cart.id,
    checkoutUrl: cart.checkoutUrl,
    totalQuantity: cart.totalQuantity,
    subtotalInCents: toCents(cart.cost.subtotalAmount.amount),
    lines: cart.lines.nodes.map(mapCartLine),
  };
}

/** Uniform error mapping: config missing → 503, anything else → 502 with log. */
function handleShopError(res: Response, err: unknown, what: string): void {
  if (err instanceof ShopifyConfigError) {
    res.status(503).json({ error: err.message });
    return;
  }
  logger.error({ err }, `Shopify request failed: ${what}`);
  const message = err instanceof Error ? err.message : "Unknown error";
  res.status(502).json({ error: `Could not reach the Shopify store: ${message}` });
}

// ── Products ──────────────────────────────────────────────────────────────────

// GET /api/shop/products?collection=&search=&limit=
router.get("/products", async (req: Request, res: Response) => {
  try {
    const limit = clampLimit(req.query["limit"]);
    const collection = typeof req.query["collection"] === "string" ? req.query["collection"] : "";
    const search = typeof req.query["search"] === "string" ? req.query["search"].trim() : "";

    if (collection) {
      const data = await shopifyStorefrontRequest<{
        collection: { products: { nodes: GqlProductCard[] } } | null;
      }>(
        `${PRODUCT_CARD_FRAGMENT}
        query CollectionProducts($handle: String!, $first: Int!) {
          collection(handle: $handle) {
            products(first: $first) { nodes { ...ProductCard } }
          }
        }`,
        { handle: collection, first: limit },
      );
      res.json({ products: (data.collection?.products.nodes ?? []).map(mapProductCard) });
      return;
    }

    const data = await shopifyStorefrontRequest<{ products: { nodes: GqlProductCard[] } }>(
      `${PRODUCT_CARD_FRAGMENT}
      query Products($first: Int!, $query: String) {
        products(first: $first, query: $query, sortKey: TITLE) {
          nodes { ...ProductCard }
        }
      }`,
      { first: limit, query: search ? `title:*${escapeQueryValue(search)}*` : null },
    );
    res.json({ products: data.products.nodes.map(mapProductCard) });
  } catch (err) {
    handleShopError(res, err, "list products");
  }
});

// GET /api/shop/products/featured
router.get("/products/featured", async (_req: Request, res: Response) => {
  try {
    const featured = await shopifyStorefrontRequest<{ products: { nodes: GqlProductCard[] } }>(
      `${PRODUCT_CARD_FRAGMENT}
      query FeaturedProducts {
        products(first: 8, query: "tag:featured") { nodes { ...ProductCard } }
      }`,
    );
    let nodes = featured.products.nodes;
    if (nodes.length === 0) {
      const fallback = await shopifyStorefrontRequest<{ products: { nodes: GqlProductCard[] } }>(
        `${PRODUCT_CARD_FRAGMENT}
        query NewestProducts {
          products(first: 4, sortKey: CREATED_AT, reverse: true) { nodes { ...ProductCard } }
        }`,
      );
      nodes = fallback.products.nodes;
    }
    res.json(nodes.map(mapProductCard));
  } catch (err) {
    handleShopError(res, err, "featured products");
  }
});

// GET /api/shop/products/:handle
router.get("/products/:handle", async (req: Request, res: Response) => {
  try {
    const data = await shopifyStorefrontRequest<{
      product: {
        id: string;
        handle: string;
        title: string;
        description: string;
        descriptionHtml: string;
        availableForSale: boolean;
        tags: string[];
        featuredImage: GqlImage;
        images: { nodes: { url: string }[] };
        compareAtPriceRange: { maxVariantPrice: GqlMoney } | null;
        variants: {
          nodes: {
            id: string;
            title: string;
            sku: string | null;
            availableForSale: boolean;
            price: GqlMoney;
            compareAtPrice: GqlMoney | null;
          }[];
        };
      } | null;
    }>(
      `query Product($handle: String!) {
        product(handle: $handle) {
          id
          handle
          title
          description
          descriptionHtml
          availableForSale
          tags
          featuredImage { url }
          images(first: 10) { nodes { url } }
          compareAtPriceRange { maxVariantPrice { amount } }
          variants(first: 50) {
            nodes {
              id
              title
              sku
              availableForSale
              price { amount }
              compareAtPrice { amount }
            }
          }
        }
      }`,
      { handle: req.params["handle"] },
    );

    const p = data.product;
    if (!p) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const compareAt = toCents(p.compareAtPriceRange?.maxVariantPrice?.amount);
    res.json({
      id: p.id,
      handle: p.handle,
      title: p.title,
      description: p.description,
      descriptionHtml: p.descriptionHtml || null,
      theme: deriveTheme(p.tags),
      compareAtPriceInCents: compareAt > 0 ? compareAt : null,
      imageUrl: p.featuredImage?.url ?? p.images.nodes[0]?.url ?? null,
      images: p.images.nodes.map((n) => n.url),
      variants: p.variants.nodes.map((v) => {
        const variantCompareAt = toCents(v.compareAtPrice?.amount);
        return {
          id: v.id,
          title: v.title,
          sku: v.sku || null,
          priceInCents: toCents(v.price.amount),
          compareAtPriceInCents: variantCompareAt > 0 ? variantCompareAt : null,
          availableForSale: v.availableForSale,
          // Quantity inventory requires an additional unauthenticated scope.
          // The availability flag is sufficient for the storefront controls.
          quantityAvailable: null,
        };
      }),
      tags: p.tags,
      availableForSale: p.availableForSale,
    });
  } catch (err) {
    handleShopError(res, err, "product detail");
  }
});

// ── Collections ───────────────────────────────────────────────────────────────

// GET /api/shop/collections
router.get("/collections", async (_req: Request, res: Response) => {
  try {
    const data = await shopifyStorefrontRequest<{
      collections: { nodes: { id: string; handle: string; title: string; description: string }[] };
    }>(
      `query Collections {
        collections(first: 20) { nodes { id handle title description } }
      }`,
    );
    res.json(data.collections.nodes);
  } catch (err) {
    handleShopError(res, err, "list collections");
  }
});

// GET /api/shop/collections/:handle
router.get("/collections/:handle", async (req: Request, res: Response) => {
  try {
    const data = await shopifyStorefrontRequest<{
      collection: {
        id: string;
        handle: string;
        title: string;
        description: string;
        products: { nodes: GqlProductCard[] };
      } | null;
    }>(
      `${PRODUCT_CARD_FRAGMENT}
      query Collection($handle: String!) {
        collection(handle: $handle) {
          id
          handle
          title
          description
          products(first: 50) { nodes { ...ProductCard } }
        }
      }`,
      { handle: req.params["handle"] },
    );

    const c = data.collection;
    if (!c) {
      res.status(404).json({ error: "Collection not found" });
      return;
    }
    res.json({
      id: c.id,
      handle: c.handle,
      title: c.title,
      description: c.description,
      products: c.products.nodes.map(mapProductCard),
    });
  } catch (err) {
    handleShopError(res, err, "collection detail");
  }
});

// ── Cart ──────────────────────────────────────────────────────────────────────
// Cart IDs are Shopify GIDs containing "?key=", so they travel in query/body,
// never in a path segment.

// GET /api/shop/cart?cartId=...
router.get("/cart", async (req: Request, res: Response) => {
  try {
    const cartId = typeof req.query["cartId"] === "string" ? req.query["cartId"] : "";
    if (!cartId) {
      res.json(EMPTY_CART);
      return;
    }
    const data = await shopifyStorefrontRequest<{ cart: GqlCart | null }>(
      `${CART_FRAGMENT}
      query Cart($id: ID!) { cart(id: $id) { ...CartFields } }`,
      { id: cartId },
    );
    res.json(mapCart(data.cart));
  } catch (err) {
    handleShopError(res, err, "get cart");
  }
});

type CartMutationResult = {
  cart: GqlCart | null;
  userErrors: { field: string[] | null; message: string; code: string | null }[];
};

/** True when the mutation's userErrors point at the cart id itself (missing/expired cart). */
function isStaleCartError(errors: CartMutationResult["userErrors"]): boolean {
  return errors.some(
    (e) =>
      (e.field ?? []).includes("cartId") ||
      /cart.*(does not|doesn't|not).*(exist|found)|invalid.*cart/i.test(e.message),
  );
}

function userErrorMessage(errors: CartMutationResult["userErrors"]): string {
  return errors.map((e) => e.message).join("; ") || "Shopify rejected the cart change";
}

// POST /api/shop/cart/lines/add  { cartId?, variantId, quantity }
router.post("/cart/lines/add", async (req: Request, res: Response) => {
  try {
    const { cartId, variantId, quantity } = req.body ?? {};
    const qty = Number(quantity);
    if (typeof variantId !== "string" || !variantId || !Number.isInteger(qty) || qty < 1) {
      res.status(400).json({ error: "variantId and a positive quantity are required" });
      return;
    }

    const lines = [{ merchandiseId: variantId, quantity: qty }];

    if (typeof cartId === "string" && cartId) {
      const data = await shopifyStorefrontRequest<{ cartLinesAdd: CartMutationResult }>(
        `${CART_FRAGMENT}
        mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
          cartLinesAdd(cartId: $cartId, lines: $lines) {
            cart { ...CartFields }
            userErrors { field message code }
          }
        }`,
        { cartId, lines },
      );
      const { cart, userErrors } = data.cartLinesAdd;
      if (cart && userErrors.length === 0) {
        res.json(mapCart(cart));
        return;
      }
      if (userErrors.length > 0 && !isStaleCartError(userErrors)) {
        // Semantic rejection (e.g. not enough stock, invalid variant) — surface it.
        res.status(400).json({ error: userErrorMessage(userErrors) });
        return;
      }
      // Cart expired or invalid — fall through and create a fresh one.
      logger.info({ userErrors }, "cartLinesAdd on stale cart; creating new cart");
    }

    const created = await shopifyStorefrontRequest<{ cartCreate: CartMutationResult }>(
      `${CART_FRAGMENT}
      mutation CartCreate($lines: [CartLineInput!]!) {
        cartCreate(input: { lines: $lines }) {
          cart { ...CartFields }
          userErrors { field message code }
        }
      }`,
      { lines },
    );
    if (created.cartCreate.userErrors.length > 0 || !created.cartCreate.cart) {
      res.status(400).json({ error: userErrorMessage(created.cartCreate.userErrors) });
      return;
    }
    res.json(mapCart(created.cartCreate.cart));
  } catch (err) {
    handleShopError(res, err, "add cart line");
  }
});

// POST /api/shop/cart/lines/update  { cartId, lineId, quantity }
router.post("/cart/lines/update", async (req: Request, res: Response) => {
  try {
    const { cartId, lineId, quantity } = req.body ?? {};
    const qty = Number(quantity);
    if (
      typeof cartId !== "string" || !cartId ||
      typeof lineId !== "string" || !lineId ||
      !Number.isInteger(qty) || qty < 1
    ) {
      res.status(400).json({ error: "cartId, lineId and a positive quantity are required" });
      return;
    }
    const data = await shopifyStorefrontRequest<{ cartLinesUpdate: CartMutationResult }>(
      `${CART_FRAGMENT}
      mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
        cartLinesUpdate(cartId: $cartId, lines: $lines) {
          cart { ...CartFields }
          userErrors { field message code }
        }
      }`,
      { cartId, lines: [{ id: lineId, quantity: qty }] },
    );
    if (data.cartLinesUpdate.userErrors.length > 0 && !isStaleCartError(data.cartLinesUpdate.userErrors)) {
      res.status(400).json({ error: userErrorMessage(data.cartLinesUpdate.userErrors) });
      return;
    }
    if (!data.cartLinesUpdate.cart) {
      // Missing/expired cart — return the empty shape so the client resets.
      res.json(EMPTY_CART);
      return;
    }
    res.json(mapCart(data.cartLinesUpdate.cart));
  } catch (err) {
    handleShopError(res, err, "update cart line");
  }
});

// POST /api/shop/cart/lines/remove  { cartId, lineId }
router.post("/cart/lines/remove", async (req: Request, res: Response) => {
  try {
    const { cartId, lineId } = req.body ?? {};
    if (typeof cartId !== "string" || !cartId || typeof lineId !== "string" || !lineId) {
      res.status(400).json({ error: "cartId and lineId are required" });
      return;
    }
    const data = await shopifyStorefrontRequest<{ cartLinesRemove: CartMutationResult }>(
      `${CART_FRAGMENT}
      mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
        cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
          cart { ...CartFields }
          userErrors { field message code }
        }
      }`,
      { cartId, lineIds: [lineId] },
    );
    if (data.cartLinesRemove.userErrors.length > 0 && !isStaleCartError(data.cartLinesRemove.userErrors)) {
      res.status(400).json({ error: userErrorMessage(data.cartLinesRemove.userErrors) });
      return;
    }
    if (!data.cartLinesRemove.cart) {
      // Missing/expired cart — return the empty shape so the client resets.
      res.json(EMPTY_CART);
      return;
    }
    res.json(mapCart(data.cartLinesRemove.cart));
  } catch (err) {
    handleShopError(res, err, "remove cart line");
  }
});

// ── Small helpers ─────────────────────────────────────────────────────────────

function clampLimit(raw: unknown): number {
  const n = Number(typeof raw === "string" ? raw : NaN);
  if (!Number.isInteger(n) || n < 1) return 50;
  return Math.min(n, 100);
}

/** Escape quotes so user input can't break out of the Shopify search query. */
function escapeQueryValue(value: string): string {
  return value.replace(/["\\]/g, "").slice(0, 80);
}

export default router;
