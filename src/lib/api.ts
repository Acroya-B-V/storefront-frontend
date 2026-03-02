import { createStorefrontClient, type StorefrontClient } from './sdk-stub';
import { $merchant } from '@/stores/merchant';

/**
 * Client-side SDK singleton for Preact islands.
 *
 * Server-side pages use `Astro.locals.sdk` (created in middleware).
 * Browser-side islands use `getClient()` (lazy singleton, created on first call).
 *
 * The custom fetch wrapper adds `credentials: 'include'` so that
 * httpOnly auth cookies are sent on cross-origin API requests.
 */
let client: StorefrontClient;

export function getClient(): StorefrontClient {
  if (!client) {
    const merchant = $merchant.get();
    if (!merchant) {
      throw new Error('getClient() called before merchant store was initialized');
    }
    client = createStorefrontClient({
      baseUrl: import.meta.env.PUBLIC_API_BASE_URL,
      vendorId: merchant.merchantId,
      language: document.documentElement.lang,
      fetch: (url, init) =>
        globalThis.fetch(url, { ...init, credentials: 'include' }),
    });
  }
  return client;
}

/** Reset the client singleton (useful when language changes). */
export function resetClient(): void {
  client = undefined!;
}
