/**
 * Seed script — populates website content for the Evolve Performance storefront.
 * Run: pnpm --filter @workspace/api-server run seed
 *
 * NOTE: products, inventory, discounts and shipping are managed in Shopify —
 * this seed only covers first-party content (site settings, homepage sections,
 * content pages).
 */

import { db } from "@workspace/db";
import { FAQ_HTML, RETURN_POLICY_HTML } from "./lib/store-pages";
import {
  siteSettingsTable, homepageSectionsTable, websitePagesTable,
} from "@workspace/db";

async function seed() {
  console.log("🌱 Seeding Evolve Performance website content…");

  // Site settings
  const settingRows = [
    { key: "business_name", value: "Evolve Performance" },
    { key: "hero_headline", value: "Train Like an Anime Character" },
    { key: "hero_subtext", value: "Cinematic lifting straps and accessories for those who train with conviction" },
    { key: "hero_cta_primary", value: "Shop the Collection" },
    { key: "hero_cta_secondary", value: "Our Story" },
    { key: "announcement_banner", value: "Free worldwide shipping on orders over $75" },
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
  ];
  for (const s of sectionRows) {
    await db.insert(homepageSectionsTable).values(s).onConflictDoUpdate({ target: homepageSectionsTable.key, set: s });
  }
  console.log("✓ Homepage sections");

  // Content pages (placeholder content — owner edits copy as needed)
  const pages = [
    { key: "privacy", title: "Privacy Policy", body: "# Privacy Policy\n\nLast updated: January 2025\n\nEvolve Performance takes your privacy seriously. This policy describes how we collect, use, and protect your personal information when you use our website and services." },
    { key: "terms", title: "Terms of Service", body: "# Terms of Service\n\nLast updated: January 2025\n\nBy accessing or using the Evolve Performance website, you agree to be bound by these Terms of Service." },
    { key: "shipping-policy", title: "Shipping Policy", body: "# Shipping Policy\n\nWe ship worldwide. Shipping options and rates are shown at checkout. US orders ship within 1-2 business days. International orders ship within 2-3 business days. Customs duties and taxes may apply for international orders." },
    { key: "return-policy", title: "No Return Policy", body: RETURN_POLICY_HTML },
    { key: "about", title: "About Evolve Performance", body: "# About Us\n\nEvolve Performance was born from a simple idea: your training gear should be as legendary as your favorite characters. We create lifting straps, wristbands, and accessories for athletes who train with purpose and passion." },
    { key: "story", title: "Our Story", body: "# Our Story\n\nIt started in a garage gym with a set of anime posters and a barbell. We wanted lifting straps that matched the energy we brought to every training session. When we couldn't find them, we made them." },
    { key: "faq", title: "Frequently Asked Questions", body: FAQ_HTML },
  ];
  for (const p of pages) {
    await db.insert(websitePagesTable).values({ ...p, isPublished: true }).onConflictDoUpdate({ target: websitePagesTable.key, set: { body: p.body, title: p.title } });
  }
  console.log("✓ Website pages");

  console.log("🎉 Seed complete!");
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
