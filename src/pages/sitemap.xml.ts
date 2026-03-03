import type { APIRoute } from 'astro';
import type { MerchantConfig } from '@/types/merchant';
import { slugify } from '@/lib/normalize';
import { fetchCollectionsOrCategories } from '@/lib/collections';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ locals, url }) => {
  const merchant = locals.merchant as MerchantConfig | undefined;
  const sdk = locals.sdk;

  if (!merchant || !sdk) {
    return new Response('Not found', { status: 404 });
  }

  const origin = url.origin;
  const languages = merchant.languages;
  const defaultLang = merchant.defaultLanguage;

  // Fetch products and collections/categories in parallel
  const [productsResult, sectionsResult] = await Promise.all([
    sdk.GET('/api/v1/products/'),
    fetchCollectionsOrCategories(sdk),
  ]);

  if (productsResult.error) {
    console.error('sitemap: failed to fetch products', productsResult.error);
  }

  const products: Record<string, unknown>[] =
    ((productsResult.data as Record<string, unknown>)?.results as Record<string, unknown>[]) ?? [];
  const collections = sectionsResult.sections;

  // If both fetches returned empty, return 503 so crawlers retain the previous sitemap
  if (products.length === 0 && collections.length === 0) {
    return new Response('Service temporarily unavailable', {
      status: 503,
      headers: { 'Retry-After': '300' },
    });
  }

  const urls: Array<{ loc: string; lastmod?: string; langs: string[] }> = [];

  // Menu page (highest priority)
  urls.push({ loc: '/', langs: languages });

  // Collection pages (or category pages as fallback)
  for (const cat of collections) {
    urls.push({
      loc: `/collection/${escapeXml(cat.slug)}`,
      langs: languages,
    });
  }

  // Product pages
  for (const product of products) {
    const name = String(product.title ?? product.name ?? product.id);
    const apiSlug = product.slug as string | undefined;
    const productSlug = apiSlug?.includes('--')
      ? apiSlug
      : `${slugify(apiSlug ?? name)}--${product.id}`;
    urls.push({
      loc: `/product/${escapeXml(productSlug)}`,
      langs: languages,
      lastmod: product.updated_at as string | undefined,
    });
  }

  // Build XML
  const entries = urls
    .map((entry) => {
      const langAlternates = entry.langs
        .map(
          (lang) =>
            `    <xhtml:link rel="alternate" hreflang="${lang}" href="${origin}/${lang}${entry.loc}" />`,
        )
        .join('\n');

      const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${origin}/${defaultLang}${entry.loc}" />`;

      return `  <url>
    <loc>${origin}/${defaultLang}${entry.loc}</loc>${entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : ''}
${langAlternates}
${xDefault}
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
};
