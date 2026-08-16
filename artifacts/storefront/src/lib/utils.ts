import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCartSessionId(): string {
  let sessionId = localStorage.getItem('ep_cart_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('ep_cart_session_id', sessionId);
  }
  return sessionId;
}

export function formatPrice(cents: number | undefined | null, currency = 'USD'): string {
  if (cents == null) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

/** Real product strap designs (provided by the brand owner). Keys are product slugs. */
const STRAP_SLUGS = new Set([
  'jdm-night-city',
  'christ-redeemer-sunset',
  'neon-japan',
  'knight-warrior',
  'ninja-fire',
  'military-green',
  'desert-war',
  'werewolf-blood-moon',
  'soccer-stadium',
  'cyberpunk-girl',
]);

export function getProductImage(slug: string | null | undefined, fallback?: string | null): string {
  // Always use BASE_URL as prefix for static assets in case of nested deployments
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (slug && STRAP_SLUGS.has(slug)) return `${basePath}/straps/${slug}.jpg`;
  if (fallback) return fallback;
  return `${basePath}/straps/jdm-night-city.jpg`;
}
