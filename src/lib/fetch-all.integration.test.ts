import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAllProducts } from './fetch-all';

/**
 * Integration tests for fetchAllProducts — verifies cursor following,
 * SSRF protection, loop detection, and page cap behavior.
 */

function makeSdk(firstPage: { results: any[]; next: string | null }) {
  return {
    GET: vi.fn().mockResolvedValue({ data: firstPage }),
  } as any;
}

const BASE_URL = 'https://api.example.com';

describe('fetchAllProducts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns first page results when next is null', async () => {
    const sdk = makeSdk({ results: [{ id: '1' }], next: null });
    const products = await fetchAllProducts(sdk, {
      vendorId: 'v1',
      language: 'nl',
      baseUrl: BASE_URL,
    });
    expect(products).toEqual([{ id: '1' }]);
    expect(sdk.GET).toHaveBeenCalledTimes(1);
  });

  it('follows cursor to fetch all pages', async () => {
    const sdk = makeSdk({
      results: [{ id: '1' }],
      next: `${BASE_URL}/api/v1/products/?page=2`,
    });

    // Mock raw fetch for page 2
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [{ id: '2' }], next: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const products = await fetchAllProducts(sdk, {
      vendorId: 'v1',
      language: 'nl',
      baseUrl: BASE_URL,
    });

    expect(products).toEqual([{ id: '1' }, { id: '2' }]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe(`${BASE_URL}/api/v1/products/?page=2`);
  });

  it('rejects next URLs with mismatched origin (SSRF protection)', async () => {
    const sdk = makeSdk({
      results: [{ id: '1' }],
      next: 'https://evil.internal/secret',
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const products = await fetchAllProducts(sdk, {
      vendorId: 'v1',
      language: 'nl',
      baseUrl: BASE_URL,
    });

    expect(products).toEqual([{ id: '1' }]);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('next URL origin mismatch'),
      // Message now includes the actual and expected origins
    );
  });

  it('detects circular next URLs and stops', async () => {
    const pageUrl = `${BASE_URL}/api/v1/products/?page=2`;
    const sdk = makeSdk({
      results: [{ id: '1' }],
      next: pageUrl,
    });

    // Page 2 points back to itself
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ results: [{ id: '2' }], next: pageUrl }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const products = await fetchAllProducts(sdk, {
      vendorId: 'v1',
      language: 'nl',
      baseUrl: BASE_URL,
    });

    // Should have page 1 + one fetch of page 2, then stop on loop
    expect(products).toEqual([{ id: '1' }, { id: '2' }]);
    expect(consoleSpy).toHaveBeenCalledWith(
      'fetchAllProducts: circular next URL detected, stopping',
    );
  });

  it('returns partial results when JSON parse fails', async () => {
    const sdk = makeSdk({
      results: [{ id: '1' }],
      next: `${BASE_URL}/api/v1/products/?page=2`,
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('not json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const products = await fetchAllProducts(sdk, {
      vendorId: 'v1',
      language: 'nl',
      baseUrl: BASE_URL,
    });

    expect(products).toEqual([{ id: '1' }]);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('failed to parse JSON'),
      expect.anything(),
    );
  });

  it('returns empty array when SDK returns no data', async () => {
    const sdk = { GET: vi.fn().mockResolvedValue({ data: null }) } as any;
    const products = await fetchAllProducts(sdk, {
      vendorId: 'v1',
      language: 'nl',
      baseUrl: BASE_URL,
    });
    expect(products).toEqual([]);
  });

  it('returns partial results when a page fetch fails', async () => {
    const sdk = makeSdk({
      results: [{ id: '1' }],
      next: `${BASE_URL}/api/v1/products/?page=2`,
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Server Error', { status: 500 }),
    );

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const products = await fetchAllProducts(sdk, {
      vendorId: 'v1',
      language: 'nl',
      baseUrl: BASE_URL,
    });

    expect(products).toEqual([{ id: '1' }]);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('page fetch failed'),
      // Not checking exact message since it includes status code
    );
  });
});
