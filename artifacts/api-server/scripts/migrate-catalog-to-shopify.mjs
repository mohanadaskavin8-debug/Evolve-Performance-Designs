// One-time migration: push local catalog (products/variants/stock) into Shopify.
// Run from repo root: node artifacts/api-server/scripts/migrate-catalog-to-shopify.mjs
// Idempotent-ish: skips products whose handle already exists in Shopify.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

function sqlJson(query) {
  const out = execFileSync(
    "psql",
    [process.env.DATABASE_URL, "-t", "-A", "-c", `SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (${query}) t;`],
    { encoding: "utf8" },
  );
  return JSON.parse(out.trim());
}

const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
const replToken = process.env.REPL_IDENTITY
  ? `repl ${process.env.REPL_IDENTITY}`
  : process.env.WEB_REPL_RENEWAL
    ? `depl ${process.env.WEB_REPL_RENEWAL}`
    : null;
if (!hostname || !replToken) {
  console.error("Missing Replit connector environment.");
  process.exit(1);
}
const protocol = hostname.startsWith("localhost") ? "http" : "https";

async function adminGql(query, variables = {}) {
  const resp = await fetch(
    `${protocol}://${hostname}/api/v2/proxy/admin/api/2026-04/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Replit-Token": replToken,
        "Connector-Name": "shopify-store",
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  const json = await resp.json();
  if (!resp.ok || (Array.isArray(json.errors) && json.errors.length)) {
    throw new Error(`Admin API error: ${JSON.stringify(json.errors ?? json)}`);
  }
  return json.data;
}

function assertNoUserErrors(node, label) {
  const errs = [];
  (function walk(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (Array.isArray(n.userErrors) && n.userErrors.length) errs.push(...n.userErrors);
    Object.values(n).forEach(walk);
  })(node);
  if (errs.length) throw new Error(`${label} userErrors: ${JSON.stringify(errs)}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 1. Load local catalog ----
const products = sqlJson(
  `SELECT id, slug, name, theme, description, materials, benefits, weight_grams
     FROM products WHERE status = 'active' ORDER BY sort_order, id`,
);
const variants = sqlJson(
  `SELECT product_id, sku, size, price_in_cents, compare_at_price_in_cents,
          stock_quantity, sort_order
     FROM product_variants WHERE active = true ORDER BY product_id, sort_order, id`,
);
const variantsByProduct = new Map();
for (const v of variants) {
  if (!variantsByProduct.has(v.product_id)) variantsByProduct.set(v.product_id, []);
  variantsByProduct.get(v.product_id).push(v);
}
console.log(`Local catalog: ${products.length} products, ${variants.length} variants`);

// ---- 2. Store context: location + publications + existing handles ----
const ctx = await adminGql(`query {
  locations(first: 1) { nodes { id name } }
  publications(first: 20) { nodes { id name } }
  products(first: 50) { nodes { id handle } }
}`);
const locationId = ctx.locations.nodes[0]?.id;
if (!locationId) throw new Error("No Shopify location found");
const pubs = ctx.publications.nodes.filter(
  (p) => p.name === "Replit" || p.name === "Online Store",
);
if (!pubs.length) throw new Error("No usable publication found");
const existingHandles = new Map(ctx.products.nodes.map((p) => [p.handle, p.id]));
console.log(`Location: ${locationId}; publishing to: ${pubs.map((p) => p.name).join(", ")}`);

// ---- 3. Create products ----
const PRODUCT_SET = `mutation productSet($input: ProductSetInput!) {
  productSet(input: $input, synchronous: true) {
    product {
      id handle
      variants(first: 10) { nodes { id sku title } }
    }
    userErrors { field message }
  }
}`;
const PUBLISH = `mutation publish($id: ID!, $input: [PublicationInput!]!) {
  publishablePublish(id: $id, input: $input) {
    userErrors { field message }
  }
}`;

const mapping = [];
for (const p of products) {
  const pvs = variantsByProduct.get(p.id) ?? [];
  if (!pvs.length) {
    console.warn(`SKIP ${p.slug}: no active variants`);
    continue;
  }
  let productGid = existingHandles.get(p.slug);
  if (productGid) {
    console.log(`EXISTS ${p.slug} -> ${productGid} (skipping create)`);
  } else {
    const descriptionHtml = [
      `<p>${p.description}</p>`,
      p.materials ? `<p><strong>Materials:</strong> ${p.materials}</p>` : "",
      p.benefits ? `<p><strong>Benefits:</strong> ${p.benefits}</p>` : "",
    ].join("");
    const tags = [
      "featured",
      ...(p.theme ? p.theme.split("/").map((t) => t.trim()).filter(Boolean) : []),
    ];
    const input = {
      title: p.name,
      handle: p.slug,
      descriptionHtml,
      status: "ACTIVE",
      vendor: "Evolve Performance",
      productType: "Lifting Straps",
      tags,
      productOptions: [
        {
          name: "Size",
          position: 1,
          values: pvs.map((v) => ({ name: v.size })),
        },
      ],
      variants: pvs.map((v) => ({
        optionValues: [{ optionName: "Size", name: v.size }],
        price: (v.price_in_cents / 100).toFixed(2),
        compareAtPrice: v.compare_at_price_in_cents
          ? (v.compare_at_price_in_cents / 100).toFixed(2)
          : null,
        sku: v.sku,
        inventoryItem: {
          tracked: true,
          requiresShipping: true,
          ...(p.weight_grams
            ? { measurement: { weight: { unit: "GRAMS", value: p.weight_grams } } }
            : {}),
        },
        inventoryQuantities: [
          { locationId, name: "available", quantity: v.stock_quantity },
        ],
      })),
    };
    const data = await adminGql(PRODUCT_SET, { input });
    assertNoUserErrors(data, `productSet(${p.slug})`);
    productGid = data.productSet.product.id;
    console.log(`CREATED ${p.slug} -> ${productGid}`);
    mapping.push({
      slug: p.slug,
      productGid,
      variants: data.productSet.product.variants.nodes.map((n) => ({
        sku: n.sku,
        gid: n.id,
        title: n.title,
      })),
    });
  }
  const pubData = await adminGql(PUBLISH, {
    id: productGid,
    input: pubs.map((pub) => ({ publicationId: pub.id })),
  });
  assertNoUserErrors(pubData, `publish(${p.slug})`);
  await sleep(400);
}

// ---- 4. Smart collection for lifting straps ----
const COLLECTION_CREATE = `mutation collectionCreate($input: CollectionInput!) {
  collectionCreate(input: $input) {
    collection { id handle }
    userErrors { field message }
  }
}`;
const existingCollections = await adminGql(
  `query { collections(first: 20) { nodes { id handle } } }`,
);
let collectionGid = existingCollections.collections.nodes.find(
  (c) => c.handle === "lifting-straps",
)?.id;
if (!collectionGid) {
  const colData = await adminGql(COLLECTION_CREATE, {
    input: {
      title: "Lifting Straps",
      handle: "lifting-straps",
      descriptionHtml:
        "<p>Premium anime and movie-themed lifting straps built for serious athletes.</p>",
      ruleSet: {
        appliedDisjunctively: false,
        rules: [{ column: "TYPE", relation: "EQUALS", condition: "Lifting Straps" }],
      },
    },
  });
  assertNoUserErrors(colData, "collectionCreate");
  collectionGid = colData.collectionCreate.collection.id;
  console.log(`CREATED collection lifting-straps -> ${collectionGid}`);
} else {
  console.log(`EXISTS collection lifting-straps -> ${collectionGid}`);
}
const colPub = await adminGql(PUBLISH, {
  id: collectionGid,
  input: pubs.map((pub) => ({ publicationId: pub.id })),
});
assertNoUserErrors(colPub, "publish(collection)");

if (mapping.length) {
  writeFileSync(
    new URL("./shopify-catalog-mapping.json", import.meta.url),
    JSON.stringify({ migratedAt: new Date().toISOString(), products: mapping }, null, 2),
  );
}
console.log("DONE");
