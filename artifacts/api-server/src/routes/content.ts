import { Router } from "express";
import { db } from "@workspace/db";
import { siteSettingsTable, websitePagesTable, homepageSectionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/content/homepage
router.get("/homepage", async (_req, res) => {
  try {
    const [settings, sections] = await Promise.all([
      db.select().from(siteSettingsTable),
      db.select().from(homepageSectionsTable).orderBy(homepageSectionsTable.position),
    ]);

    const get = (key: string, fallback = "") =>
      settings.find((s) => s.key === key)?.value ?? fallback;

    res.json({
      heroHeadline: get("hero_headline", "Train Like an Anime Character"),
      heroSubtext: get("hero_subtext", "Lifting straps for those who train with purpose"),
      heroCtaPrimary: get("hero_cta_primary", "Shop Now"),
      heroCtaSecondary: get("hero_cta_secondary", "Our Story"),
      announcementBanner: get("announcement_banner") || null,
      announcementActive: get("announcement_active") === "true",
      sections,
    });
  } catch {
    res.status(500).json({ error: "Failed to load homepage" });
  }
});

// GET /api/content/page/:pageKey
router.get("/page/:pageKey", async (req, res) => {
  try {
    const [page] = await db
      .select()
      .from(websitePagesTable)
      .where(eq(websitePagesTable.key, req.params.pageKey));

    if (!page || !page.isPublished) return res.status(404).json({ error: "Page not found" });

    res.json({
      key: page.key,
      title: page.title,
      body: page.body,
      updatedAt: page.updatedAt.toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Failed to load page" });
  }
});

// GET /api/content/settings
router.get("/settings", async (_req, res) => {
  try {
    const settings = await db.select().from(siteSettingsTable);
    const get = (key: string, fallback = "") => settings.find((s) => s.key === key)?.value ?? fallback;

    res.json({
      businessName: get("business_name", "Evolve Performance"),
      logoUrl: get("logo_url") || null,
      faviconUrl: get("favicon_url") || null,
      supportEmail: get("support_email", "support@evolveperformance.com"),
      currency: get("currency", "USD"),
      defaultCountry: get("default_country", "US"),
      socialInstagram: get("social_instagram") || null,
      socialTiktok: get("social_tiktok") || null,
      socialYoutube: get("social_youtube") || null,
      announcementBanner: get("announcement_banner") || null,
    });
  } catch {
    res.status(500).json({ error: "Failed to load settings" });
  }
});

export default router;
