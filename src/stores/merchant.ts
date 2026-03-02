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
