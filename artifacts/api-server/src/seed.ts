/**
 * Seed script — populates website content for the Evolve Performance storefront.
 * Run: pnpm --filter @workspace/api-server run seed
 *
 * NOTE: products, inventory, discounts and shipping are managed in Shopify —
 * this seed only covers first-party content (site settings, homepage sections,
 * content pages).
 */

import { db } from "@workspace/db";
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
    { key: "return-policy", title: "Return Policy", body: "# Return Policy\n\n30-day returns on unwashed, unworn items in original packaging. Contact us via the support page to start a return. Refunds processed within 5-7 business days." },
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
