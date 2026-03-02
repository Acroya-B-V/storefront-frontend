import type { StorefrontClient } from './sdk-stub';

interface PaginatedResponse<T> {
  results: T[];
  next: string | null;
}

interface FetchAllOptions {
  vendorId: string;
  language: string;
  baseUrl: string;
}

/**
 * Fetch all pages of a paginated API endpoint.
 *
 * Uses the typed SDK client for the first page, then follows raw `next` URLs
 * for subsequent pages (the SDK's typed GET only accepts known path literals,
 * so arbitrary `next` URLs must use raw fetch).
 *
 * Safety guards: seen-URL loop detection, hard 50-page cap, res.ok check.
 */
export async function fetchAllProducts(
  sdk: StorefrontClient,
  opts: FetchAllOptions,
): Promise<Record<string, unknown>[]> {
  const { data } = await sdk.GET('/api/v1/products/');
  if (!data) return [];

  const page = data as PaginatedResponse<Record<string, unknown>>;
  const all: Record<string, unknown>[] = [...(page.results ?? [])];
  let nextUrl: string | null = page.next ?? null;

  const MAX_PAGES = 50;
  const seen = new Set<string>();
  let pageCount = 1;

  const allowedOrigin = new URL(opts.baseUrl).origin;

  while (nextUrl) {
    const resolvedUrl = new URL(nextUrl, opts.baseUrl).href;

    // SSRF guard: only follow next URLs pointing to the same API origin
    if (!resolvedUrl.startsWith(allowedOrigin)) {
      console.error('fetchAllProducts: next URL origin mismatch, stopping');
      break;
    }

    if (seen.has(resolvedUrl)) {
      console.error('fetchAllProducts: circular next URL detected, stopping');
      break;
    }
    if (++pageCount > MAX_PAGES) {
      console.error(`fetchAllProducts: exceeded ${MAX_PAGES} page limit, stopping`);
      break;
    }
    seen.add(resolvedUrl);

    const res = await fetch(resolvedUrl, {
      headers: {
        'X-Vendor-ID': opts.vendorId,
        'Accept-Language': opts.language,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      console.error(`fetchAllProducts: page fetch failed (${res.status}), returning partial results`);
      break;
    }

    const nextPage = (await res.json()) as PaginatedResponse<Record<string, unknown>>;
    all.push(...(nextPage.results ?? []));
    nextUrl = nextPage.next ?? null;
  }

  return all;
}
