/**
 * Email delivery via the Resend connector.
 *
 * All requests go through the Replit connectors proxy — no API key is stored
 * in this codebase. The proxy injects credentials for the connected Resend
 * account.
 *
 * NOTE ON SENDING DOMAIN: by default Resend only allows sending to the
 * account owner's own address until a domain is verified. RESEND_FROM_EMAIL
 * should be set to an address on a verified domain for production sends.
 */
import { ReplitConnectors } from "@replit/connectors-sdk";

const FROM_EMAIL =
  process.env["RESEND_FROM_EMAIL"] ?? "Evolve Performance <onboarding@resend.dev>";

export async function sendViaResend(input: {
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
  /** Customer address the recipient can reply to directly. */
  replyTo?: string;
  /** Stable key so a crash-retry of the same logical send cannot double-deliver (Resend dedupes for 24h). */
  idempotencyKey?: string;
}): Promise<string> {
  const connectors = new ReplitConnectors();
  const response = (await connectors.proxy("resend", "/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      ...(input.replyTo ? { reply_to: [input.replyTo] } : {}),
      ...(input.headers ? { headers: input.headers } : {}),
    }),
  })) as unknown as Response;
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Resend error ${response.status}: ${text.slice(0, 300)}`);
  }
  const data: any = await response.json();
  return String(data?.id ?? "");
}
