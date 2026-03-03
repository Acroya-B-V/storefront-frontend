import { atom } from 'nanostores';
import type { MerchantConfig } from '@/types/merchant';

declare global {
  interface Window {
    __MERCHANT__?: MerchantConfig;
    __LANG__?: string;
  }
}

/** Set once from SSR-injected <script> tag, read by all islands. */
export const $merchant = atom<MerchantConfig | null>(
  typeof window !== 'undefined' ? (window.__MERCHANT__ ?? null) : null,
);

/**
 * Safety net: if module evaluation somehow beats the inline define:vars script,
 * re-read window.__MERCHANT__ once the DOM is fully parsed.
 */
if (typeof window !== 'undefined' && !$merchant.get()) {
  document.addEventListener('DOMContentLoaded', () => {
    if (!$merchant.get() && window.__MERCHANT__) {
      $merchant.set(window.__MERCHANT__);
    }
  });
}
