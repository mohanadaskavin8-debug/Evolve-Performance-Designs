/**
 * Pure signup-consent policy — kept dependency-free so it can be unit tested.
 *
 * The rule this encodes (and the reason it exists): an unauthenticated signup
 * POST proves nothing about who submitted it, so it must NEVER restore consent
 * that the mailbox owner revoked. Reactivation of an opted-out address happens
 * only through the verified double opt-in flow (signed confirmation link
 * clicked from the inbox itself).
 */

export type SignupDecision =
  /** Fresh or still-active address — subscribe (or refresh) normally. */
  | { action: "subscribe" }
  /** Previously opted out — send a confirmation email; change nothing yet. */
  | { action: "confirm_required" }
  /** Hard-bounced or complained — never auto-mail, not even a confirmation. */
  | { action: "blocked" };

export function classifySignup(input: {
  /** email_subscribers.status for the address, or null when no row exists. */
  existingStatus: string | null;
  /** reasons of every email_suppressions row for the address. */
  suppressionReasons: string[];
}): SignupDecision {
  // Deliverability suppressions outrank everything — a bounced/complained
  // address hurts sender reputation regardless of claimed consent.
  if (input.suppressionReasons.some((r) => r === "bounce" || r === "complaint")) {
    return { action: "blocked" };
  }
  if (input.suppressionReasons.includes("unsubscribe") || input.existingStatus === "unsubscribed") {
    return { action: "confirm_required" };
  }
  return { action: "subscribe" };
}
