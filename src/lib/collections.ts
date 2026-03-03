import type { StorefrontClient } from './sdk-stub';
import type { NormalizedCategory } from './normalize';
import { normalizeCollection, flattenCategories } from './normalize';

export interface SectionsResult {
  sections: NormalizedCategory[];
  source: 'collections' | 'categories';
}

/**
 * Fetch collections from the API, falling back to flattened categories
 * if the collections endpoint returns empty or errors.
 */
export async function fetchCollectionsOrCategories(sdk: StorefrontClient): Promise<SectionsResult> {
  const collectionsResult = await sdk.GET('/api/v1/collections/');

  if (collectionsResult.error) {
    console.error('[collections] API error, falling back to categories', collectionsResult.error);
  }

  const rawCollections =
    (collectionsResult.data as { results: Array<Record<string, unknown>> } | null)?.results ?? [];

  if (rawCollections.length > 0) {
    return { sections: rawCollections.map(normalizeCollection), source: 'collections' };
  }

  // Fallback: use categories
  const categoriesResult = await sdk.GET('/api/v1/categories/');
  if (categoriesResult.error) {
    console.error('[collections] categories fallback also failed', categoriesResult.error);
  }
  const rawCategories =
    (categoriesResult.data as { results: Array<Record<string, unknown>> } | null)?.results ?? [];
  return { sections: flattenCategories(rawCategories), source: 'categories' };
}
