import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useSyncExternalStore } from 'react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Shopify cart id persistence ───────────────────────────────────────────────
// The Shopify cart lives on Shopify's side; we only remember its ID locally.

const CART_ID_KEY = 'ep_shopify_cart_id';
const CART_EVENT = 'ep-cart-updated';

export function getStoredCartId(): string | null {
  try {
    return localStorage.getItem(CART_ID_KEY);
  } catch {
    return null;
  }
}

export function storeCartId(id: string | null | undefined): void {
  try {
    if (id) localStorage.setItem(CART_ID_KEY, id);
    else localStorage.removeItem(CART_ID_KEY);
  } catch {
    // Storage unavailable (private mode) — cart won't persist across reloads.
  }
  window.dispatchEvent(new Event(CART_EVENT));
}

function subscribeCartId(callback: () => void): () => void {
  window.addEventListener(CART_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CART_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

/** Reactive cart id — components re-render when the stored cart id changes. */
export function useCartId(): string | null {
  return useSyncExternalStore(subscribeCartId, getStoredCartId, () => null);
}

export function formatPrice(cents: number | undefined | null, currency = 'USD'): string {
  if (cents == null) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

/** Real product strap designs (provided by the brand owner). Keys are Shopify product handles. */
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

export function getProductImage(handle: string | null | undefined, fallback?: string | null): string {
  // Always use BASE_URL as prefix for static assets in case of nested deployments
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (handle && STRAP_SLUGS.has(handle)) return `${basePath}/straps/${handle}.jpg`;
  if (fallback) return fallback;
  return `${basePath}/straps/jdm-night-city.jpg`;
}
