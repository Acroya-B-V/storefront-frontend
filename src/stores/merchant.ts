import { atom } from 'nanostores';
import type { MerchantConfig } from '@/types/merchant';

/** Set once from SSR-injected <script> tag, read by all islands. */
export const $merchant = atom<MerchantConfig | null>(null);
