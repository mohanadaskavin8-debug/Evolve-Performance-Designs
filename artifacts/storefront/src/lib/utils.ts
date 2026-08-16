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

const images = [
  'jdm-night-city.jpg',
  'werewolf-blood-moon.jpg',
  'cyberpunk-girl.jpg',
  'ninja-fire.jpg',
  'mecha-strike.jpg',
  'demon-slayer-breath.jpg',
  'samurai-spirit.jpg',
  'cosmic-horror.jpg',
  'neo-tokyo-drift.jpg',
  'shonen-protagonist.jpg',
];

export function getProductImage(slug: string | null | undefined, fallback?: string | null): string {
  if (!slug) return fallback || '/products/jdm-night-city.jpg';
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % images.length;
  // Always use BASE_URL as prefix for static assets in case of nested deployments
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${basePath}/products/${images[index]}`;
}
