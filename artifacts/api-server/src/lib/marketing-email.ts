/**
 * Marketing email rendering + unsubscribe tokens.
 *
 * - Campaign emails are built from ordered content blocks and rendered into
 *   the same dark Evolve Performance shell used by transactional email.
 * - Every marketing email carries a per-recipient unsubscribe link built from
 *   a stateless HMAC token (no DB row needed to issue one).
 * - All user-controlled text is HTML-escaped at render time.
 */
import crypto from "node:crypto";

// ── Storefront links ──────────────────────────────────────────────────────────

export function storefrontBase(): string {
  const origin =
    process.env.STOREFRONT_ORIGIN ||
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null) ||
    "http://localhost:5173";
  const basePath = process.env.STOREFRONT_BASE_PATH ?? "";
  return `${origin}${basePath}`;
}

// ── Unsubscribe tokens (stateless HMAC) ───────────────────────────────────────

function tokenSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required to sign unsubscribe tokens");
  return secret;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function makeUnsubscribeToken(email: string, campaignId?: number | null): string {
  const payload = b64url(Buffer.from(JSON.stringify({ e: email.toLowerCase(), c: campaignId ?? 0, t: Date.now() })));
  const sig = b64url(crypto.createHmac("sha256", tokenSecret()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): { email: string; campaignId: number | null } | null {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [payload, sig] = parts;
  const expected = b64url(crypto.createHmac("sha256", tokenSecret()).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const email = typeof data?.e === "string" ? data.e.trim().toLowerCase() : "";
    if (!email || !email.includes("@")) return null;
    const campaignId = Number.isInteger(data?.c) && data.c > 0 ? (data.c as number) : null;
    return { email, campaignId };
  } catch {
    return null;
  }
}

export function unsubscribeUrlFor(email: string, campaignId?: number | null): string {
  return `${storefrontBase()}/unsubscribe?token=${encodeURIComponent(makeUnsubscribeToken(email, campaignId))}`;
}

// ── Re-subscribe (double opt-in) tokens ───────────────────────────────────────
// Domain-separated from unsubscribe tokens two ways: the HMAC is computed over
// "resub." + payload (different signature domain), and the payload must carry
// p:"resub". Neither token kind can ever be replayed as the other.

const RESUBSCRIBE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // confirm links expire after 7 days

export function makeResubscribeToken(email: string): string {
  const payload = b64url(Buffer.from(JSON.stringify({ e: email.toLowerCase(), p: "resub", t: Date.now() })));
  const sig = b64url(crypto.createHmac("sha256", tokenSecret()).update(`resub.${payload}`).digest());
  return `${payload}.${sig}`;
}

export function verifyResubscribeToken(token: string): { email: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [payload, sig] = parts;
  const expected = b64url(crypto.createHmac("sha256", tokenSecret()).update(`resub.${payload}`).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data?.p !== "resub") return null;
    const email = typeof data?.e === "string" ? data.e.trim().toLowerCase() : "";
    if (!email || !email.includes("@")) return null;
    const issuedAt = typeof data?.t === "number" ? data.t : 0;
    if (!issuedAt || Date.now() - issuedAt > RESUBSCRIBE_TOKEN_TTL_MS) return null;
    return { email };
  } catch {
    return null;
  }
}

export function resubscribeUrlFor(email: string): string {
  return `${storefrontBase()}/confirm-subscription?token=${encodeURIComponent(makeResubscribeToken(email))}`;
}

// ── Rendering ─────────────────────────────────────────────────────────────────

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape text and convert newlines to <br/> for paragraph-ish content. */
function escapeMultiline(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br/>");
}

/** Only allow http(s) or storefront-relative links in emails; anything else collapses to the storefront. */
function safeHref(url: string | null | undefined): string {
  const candidate = (url ?? "").trim();
  if (/^https?:\/\//i.test(candidate)) return candidate;
  if (candidate.startsWith("/")) return `${storefrontBase()}${candidate}`;
  return storefrontBase();
}

export interface CampaignBlockData {
  id: string;
  type: "headline" | "text" | "image" | "product" | "discount" | "button";
  text?: string | null;
  url?: string | null;
  alt?: string | null;
  href?: string | null;
  productId?: number | null;
  code?: string | null;
  note?: string | null;
  label?: string | null;
}

export interface ProductCardData {
  id: number;
  name: string;
  slug: string;
  priceInCents: number;
  imageUrl: string | null;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function renderBlock(block: CampaignBlockData, products: Map<number, ProductCardData>): string {
  switch (block.type) {
    case "headline":
      return `<tr><td style="padding:28px 0 0 0;font-family:Arial,sans-serif;">
        <p style="margin:0;font-size:22px;letter-spacing:2px;color:#ffffff;font-weight:bold;">${escapeHtml(block.text ?? "")}</p>
      </td></tr>`;
    case "text":
      return `<tr><td style="padding:16px 0 0 0;font-family:Arial,sans-serif;">
        <p style="margin:0;font-size:15px;line-height:1.7;color:#d4d4d8;">${escapeMultiline(block.text ?? "")}</p>
      </td></tr>`;
    case "image": {
      const src = (block.url ?? "").trim();
      if (!/^https?:\/\//i.test(src)) return "";
      const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(block.alt ?? "")}" width="560" style="display:block;width:100%;max-width:560px;border:0;" />`;
      const linked = block.href ? `<a href="${escapeHtml(safeHref(block.href))}">${img}</a>` : img;
      return `<tr><td style="padding:24px 0 0 0;">${linked}</td></tr>`;
    }
    case "product": {
      const product = block.productId ? products.get(block.productId) : undefined;
      if (!product) return "";
      const href = `${storefrontBase()}/products/${encodeURIComponent(product.slug)}`;
      const image = product.imageUrl
        ? `<td width="160" valign="top" style="padding:0 16px 0 0;"><a href="${escapeHtml(href)}"><img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" width="160" style="display:block;width:160px;border:0;" /></a></td>`
        : "";
      return `<tr><td style="padding:24px 0 0 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#18181b;border:1px solid #27272a;">
          <tr><td style="padding:16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              ${image}
              <td valign="top" style="font-family:Arial,sans-serif;">
                <p style="margin:0 0 6px 0;font-size:16px;color:#ffffff;font-weight:bold;">${escapeHtml(product.name)}</p>
                <p style="margin:0 0 14px 0;font-size:14px;color:#dc2626;font-weight:bold;">${formatPrice(product.priceInCents)}</p>
                <a href="${escapeHtml(href)}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-size:12px;letter-spacing:2px;padding:10px 20px;font-weight:bold;">SHOP NOW</a>
              </td>
            </tr></table>
          </td></tr>
        </table>
      </td></tr>`;
    }
    case "discount":
      if (!block.code) return "";
      return `<tr><td style="padding:24px 0 0 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px dashed #dc2626;">
          <tr><td align="center" style="padding:20px;font-family:Arial,sans-serif;">
            <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:3px;color:#9ca3af;">YOUR CODE</p>
            <p style="margin:0;font-size:24px;letter-spacing:4px;color:#ffffff;font-weight:bold;font-family:monospace;">${escapeHtml(block.code)}</p>
            ${block.note ? `<p style="margin:8px 0 0 0;font-size:12px;color:#9ca3af;">${escapeHtml(block.note)}</p>` : ""}
          </td></tr>
        </table>
      </td></tr>`;
    case "button":
      if (!block.label) return "";
      return `<tr><td style="padding:28px 0 0 0;">
        <a href="${escapeHtml(safeHref(block.href ?? block.url))}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-size:13px;letter-spacing:2px;padding:14px 28px;font-weight:bold;font-family:Arial,sans-serif;">${escapeHtml(block.label)}</a>
      </td></tr>`;
    default:
      return "";
  }
}

function marketingShell(input: {
  previewText: string | null;
  bodyRows: string;
  unsubscribeUrl: string;
}): string {
  const preheader = input.previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(input.previewText)}</div>`
    : "";
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0a0a0a;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
      <tr><td style="border-bottom:2px solid #dc2626;padding:0 0 16px 0;">
        <p style="margin:0;font-size:18px;letter-spacing:6px;color:#ffffff;font-weight:bold;font-family:Arial,sans-serif;">EVOLVE<span style="color:#dc2626;">PERFORMANCE</span></p>
      </td></tr>
      ${input.bodyRows}
      <tr><td style="padding:40px 0 0 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #27272a;">
          <tr><td style="padding:24px 0 0 0;font-family:Arial,sans-serif;">
            <p style="margin:0;font-size:11px;color:#52525b;">Evolve Performance — lifting straps for the obsessed.<br/>
            You're receiving this because you subscribed or opted in to marketing emails.<br/>
            <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export function renderCampaignEmail(input: {
  previewText: string | null;
  blocks: CampaignBlockData[];
  products: Map<number, ProductCardData>;
  unsubscribeUrl: string;
}): string {
  const bodyRows = input.blocks.map((b) => renderBlock(b, input.products)).join("\n");
  return marketingShell({ previewText: input.previewText, bodyRows, unsubscribeUrl: input.unsubscribeUrl });
}

/** Substitute {{placeholders}} in template copy, escaping the substituted values. */
export function fillPlaceholders(text: string, vars: Record<string, string | null | undefined>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = vars[key];
    return value ? value : "";
  });
}

export function renderTemplateEmail(input: {
  headline: string;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  vars: Record<string, string | null | undefined>;
  unsubscribeUrl: string;
}): string {
  const headline = escapeHtml(fillPlaceholders(input.headline, input.vars));
  const body = escapeMultiline(fillPlaceholders(input.body, input.vars));
  const cta =
    input.ctaLabel && input.ctaLabel.trim()
      ? `<tr><td style="padding:28px 0 0 0;">
          <a href="${escapeHtml(safeHref(input.ctaUrl))}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-size:13px;letter-spacing:2px;padding:14px 28px;font-weight:bold;font-family:Arial,sans-serif;">${escapeHtml(input.ctaLabel)}</a>
        </td></tr>`
      : "";
  const bodyRows = `
      <tr><td style="padding:32px 0 0 0;font-family:Arial,sans-serif;">
        <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:3px;color:#dc2626;font-weight:bold;">${headline}</p>
        <p style="margin:16px 0 0 0;font-size:15px;line-height:1.7;color:#d4d4d8;">${body}</p>
      </td></tr>
      ${cta}`;
  return marketingShell({ previewText: null, bodyRows, unsubscribeUrl: input.unsubscribeUrl });
}
