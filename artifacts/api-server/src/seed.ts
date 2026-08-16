/**
 * Seed script — populates catalog for Evolve Performance storefront.
 * Run: pnpm --filter @workspace/api-server run seed
 *
 * 10 strap designs from the product sheet:
 *  1. JDM Night City
 *  2. Christ-the-Redeemer Sunset
 *  3. Neon Japan
 *  4. Knight/Warrior
 *  5. Ninja/Fire
 *  6. Military Green
 *  7. Desert War
 *  8. Werewolf Blood Moon
 *  9. Soccer Stadium
 * 10. Cyberpunk Girl
 */

import { db } from "@workspace/db";
import {
  collectionsTable, productsTable, productVariantsTable,
  productImagesTable, productCollectionsTable,
  shippingZonesTable, shippingRatesTable,
  discountsTable, siteSettingsTable, homepageSectionsTable,
  websitePagesTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";

// Real product strap designs (cropped from the owner's provided artwork).
// Served from the storefront's public dir; storefront is the root-path artifact.
const IMG = (slug: string) => `/straps/${slug}.jpg`;

const STRAP_DESIGNS = [
  { slug: "jdm-night-city", name: "JDM Night City", theme: "JDM / Drift / Urban Night", priceInCents: 2999 },
  { slug: "christ-redeemer-sunset", name: "Christ-the-Redeemer Sunset", theme: "Brazil / Spiritual / Sunset", priceInCents: 2999 },
  { slug: "neon-japan", name: "Neon Japan", theme: "Harajuku / Neon / Cyberpunk Tokyo", priceInCents: 2999 },
  { slug: "knight-warrior", name: "Knight Warrior", theme: "Medieval / Dark Fantasy / Armored", priceInCents: 2999 },
  { slug: "ninja-fire", name: "Ninja Fire", theme: "Shinobi / Fire / Anime Combat", priceInCents: 2999 },
  { slug: "military-green", name: "Military Green Ops", theme: "Tactical / Military / Operator", priceInCents: 2999 },
  { slug: "desert-war", name: "Desert War", theme: "Desert Combat / War / Sand", priceInCents: 2999 },
  { slug: "werewolf-blood-moon", name: "Werewolf Blood Moon", theme: "Dark Fantasy / Moon / Beast", priceInCents: 2999 },
  { slug: "soccer-stadium", name: "Soccer Stadium", theme: "Football / Stadium / Energy", priceInCents: 2999 },
  { slug: "cyberpunk-girl", name: "Cyberpunk Girl", theme: "Sci-Fi / Neon / Futuristic", priceInCents: 2999 },
];

const SIZES = ["XS/S", "M/L", "XL/XXL"];

async function seed() {
  console.log("🌱 Seeding Evolve Performance catalog…");

  // Site settings
  const settingRows = [
    { key: "business_name", value: "Evolve Performance" },
    { key: "hero_headline", value: "Train Like an Anime Character" },
    { key: "hero_subtext", value: "Cinematic lifting straps and accessories for those who train with conviction" },
    { key: "hero_cta_primary", value: "Shop the Collection" },
    { key: "hero_cta_secondary", value: "Our Story" },
    { key: "announcement_banner", value: "Free worldwide shipping on orders over $75 · Use code EVOLVE10 for 10% off" },
    { key: "announcement_active", value: "true" },
    { key: "support_email", value: "support@evolveperformance.com" },
    { key: "currency", value: "USD" },
    { key: "default_country", value: "US" },
    { key: "social_instagram", value: "https://instagram.com/evolveperformance" },
    { key: "social_tiktok", value: "https://tiktok.com/@evolveperformance" },
  ];
  for (const s of settingRows) {
    await db.insert(siteSettingsTable).values(s).onConflictDoUpdate({ target: siteSettingsTable.key, set: { value: s.value } });
  }
  console.log("✓ Site settings");

  // Homepage sections
  const sectionRows = [
    { key: "hero", sectionType: "hero", position: 1, active: true, title: "Hero Banner", subtitle: null },
    { key: "featured-products", sectionType: "product_grid", position: 2, active: true, title: "The Collection", subtitle: "10 designs. One mission." },
    { key: "brand-story", sectionType: "brand_story", position: 3, active: true, title: "Born from Anime. Built for Iron.", subtitle: null },
    { key: "stats-bar", sectionType: "stats", position: 4, active: true, title: "Numbers Don't Lie", subtitle: null },
    { key: "testimonials", sectionType: "reviews", position: 5, active: true, title: "From the Community", subtitle: null },
    { key: "newsletter", sectionType: "newsletter", position: 6, active: true, title: "Join the Dojo", subtitle: "Training tips, new drops, and exclusive discounts." },
  ];
  for (const s of sectionRows) {
    await db.insert(homepageSectionsTable).values(s).onConflictDoUpdate({ target: homepageSectionsTable.key, set: s });
  }
  console.log("✓ Homepage sections");

  // Collection: Lifting Straps
  const [strapsCollection] = await db
    .insert(collectionsTable)
    .values({
      slug: "lifting-straps",
      name: "Lifting Straps",
      description: "Anime-themed lifting straps designed for serious athletes. Each design tells a story of power, culture, and dedication.",
      active: true,
      sortOrder: 1,
    })
    .onConflictDoUpdate({ target: collectionsTable.slug, set: { name: "Lifting Straps" } })
    .returning();

  // Collection: All Products
  const [allCollection] = await db
    .insert(collectionsTable)
    .values({
      slug: "all",
      name: "All Products",
      description: "Browse the full Evolve Performance lineup.",
      active: true,
      sortOrder: 0,
    })
    .onConflictDoUpdate({ target: collectionsTable.slug, set: { name: "All Products" } })
    .returning();

  console.log("✓ Collections");

  // Products
  for (let i = 0; i < STRAP_DESIGNS.length; i++) {
    const design = STRAP_DESIGNS[i];

    const [product] = await db
      .insert(productsTable)
      .values({
        slug: design.slug,
        name: design.name,
        theme: design.theme,
        description: `The ${design.name} lifting strap is a statement piece built for the serious athlete. Designed with the ${design.theme} aesthetic in mind — every pull, every lift, every rep carries the energy of the art that inspires it. Premium cotton/polyester blend provides maximum grip and wrist support. Machine washable.`,
        materials: "65% cotton, 35% polyester. Steel D-ring. Reinforced loop stitching.",
        benefits: "Maximum wrist support · Superior grip · Quick-dry fabric · Built to last years",
        shippingInfo: "Ships worldwide in 3-7 business days. Free shipping on orders over $75.",
        returnsInfo: "30-day returns on unwashed, unworn items. Easy return portal in your account.",
        status: "active",
        weightGrams: 120,
        dimensionsCm: "60 x 3.5 x 0.4",
        hsCode: "6307.10",
        countryOfOrigin: "CN",
        isFeatured: true,
        sortOrder: i + 1,
      })
      .onConflictDoUpdate({ target: productsTable.slug, set: { name: design.name, isFeatured: true } })
      .returning();

    // Variants (sizes)
    for (let j = 0; j < SIZES.length; j++) {
      await db
        .insert(productVariantsTable)
        .values({
          productId: product.id,
          sku: `${design.slug.toUpperCase()}-${SIZES[j].replace("/", "")}`,
          size: SIZES[j],
          priceInCents: design.priceInCents,
          compareAtPriceInCents: 3999,
          stockQuantity: 50,
          reservedQuantity: 0,
          active: true,
          sortOrder: j,
        })
        .onConflictDoUpdate({ target: productVariantsTable.sku, set: { stockQuantity: 50 } });
    }

    // Primary image (placeholder — design subagent will generate real art)
    await db
      .insert(productImagesTable)
      .values({
        productId: product.id,
        url: IMG(design.slug),
        altText: `${design.name} lifting strap`,
        isPrimary: true,
        position: 0,
      })
      .onConflictDoUpdate({ target: productImagesTable.id, set: { url: IMG(design.slug) } } as any);

    // Link to collections
    await db
      .insert(productCollectionsTable)
      .values({ productId: product.id, collectionId: strapsCollection.id, sortOrder: i })
      .onConflictDoNothing();
    await db
      .insert(productCollectionsTable)
      .values({ productId: product.id, collectionId: allCollection.id, sortOrder: i })
      .onConflictDoNothing();
  }
  console.log("✓ Products + variants");

  // Shipping zones
  const [usZone] = await db
    .insert(shippingZonesTable)
    .values({ name: "United States", countries: ["US"], active: true, sortOrder: 1 })
    .onConflictDoNothing()
    .returning();
  const [intlZone] = await db
    .insert(shippingZonesTable)
    .values({ name: "International", countries: ["*"], active: true, sortOrder: 2 })
    .onConflictDoNothing()
    .returning();

  if (usZone) {
    await db.insert(shippingRatesTable).values([
      { zoneId: usZone.id, name: "Standard Shipping", description: "USPS First Class / Priority", rateType: "flat", priceInCents: 599, estimatedDays: "3-7 business days", active: true },
      { zoneId: usZone.id, name: "Express Shipping", description: "USPS Priority Mail Express", rateType: "flat", priceInCents: 1499, estimatedDays: "1-2 business days", active: true },
      { zoneId: usZone.id, name: "Free Shipping", description: "On orders $75+", rateType: "free", priceInCents: 0, minimumOrderInCents: 7500, estimatedDays: "5-7 business days", active: true },
    ]).onConflictDoNothing();
  }
  if (intlZone) {
    await db.insert(shippingRatesTable).values([
      { zoneId: intlZone.id, name: "International Standard", description: "ePacket / tracked airmail", rateType: "flat", priceInCents: 1299, estimatedDays: "7-21 business days", active: true },
      { zoneId: intlZone.id, name: "International Express", description: "DHL / FedEx International", rateType: "flat", priceInCents: 3499, estimatedDays: "3-5 business days", active: true },
    ]).onConflictDoNothing();
  }
  console.log("✓ Shipping zones");

  // Discount codes
  await db.insert(discountsTable).values([
    { code: "EVOLVE10", discountType: "percentage", value: 10, active: true },
    { code: "WELCOME20", discountType: "percentage", value: 20, minimumOrderInCents: 5000, active: true },
    { code: "FREESHIP", discountType: "fixed", value: 599, active: true },
  ]).onConflictDoNothing();
  console.log("✓ Discount codes");

  // Legal pages (placeholder content)
  const pages = [
    { key: "privacy", title: "Privacy Policy", body: "# Privacy Policy\n\nLast updated: January 2025\n\nEvolve Performance takes your privacy seriously. This policy describes how we collect, use, and protect your personal information when you use our website and services." },
    { key: "terms", title: "Terms of Service", body: "# Terms of Service\n\nLast updated: January 2025\n\nBy accessing or using the Evolve Performance website, you agree to be bound by these Terms of Service." },
    { key: "shipping-policy", title: "Shipping Policy", body: "# Shipping Policy\n\nWe ship worldwide. US orders ship within 1-2 business days. International orders ship within 2-3 business days. Customs duties and taxes may apply for international orders." },
    { key: "return-policy", title: "Return Policy", body: "# Return Policy\n\n30-day returns on unwashed, unworn items in original packaging. Initiate a return through your account dashboard. Refunds processed within 5-7 business days." },
    { key: "about", title: "About Evolve Performance", body: "# About Us\n\nEvolve Performance was born from a simple idea: your training gear should be as legendary as your favorite characters. We create lifting straps, wristbands, and accessories for athletes who train with purpose and passion." },
    { key: "story", title: "Our Story", body: "# Our Story\n\nIt started in a garage gym with a set of anime posters and a barbell. We wanted lifting straps that matched the energy we brought to every training session. When we couldn't find them, we made them." },
    { key: "faq", title: "Frequently Asked Questions", body: "# FAQ\n\n## How do I choose my size?\nMost athletes do well with M/L. If you have wrists larger than 7 inches, go with XL/XXL.\n\n## How do I wash my straps?\nMachine wash cold, hang dry. Do not bleach or tumble dry.\n\n## Do you ship internationally?\nYes! We ship to 100+ countries worldwide.\n\n## How long until my order arrives?\nUS: 3-7 business days. International: 7-21 business days." },
  ];
  for (const p of pages) {
    await db.insert(websitePagesTable).values({ ...p, isPublished: true }).onConflictDoUpdate({ target: websitePagesTable.key, set: { body: p.body, title: p.title } });
  }
  console.log("✓ Website pages");

  console.log("🎉 Seed complete!");
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
