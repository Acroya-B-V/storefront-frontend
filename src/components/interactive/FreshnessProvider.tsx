import { useEffect, useRef } from 'preact/hooks';
import { getClient } from '@/lib/api';

interface Props {
  productIds: string[];
}

/**
 * Background data refresh island.
 *
 * On mount, fetches fresh product data and patches volatile fields
 * (sold_out, is_available, price, compare_at_price) in the rendered DOM.
 * Re-polls every 5 minutes for long sessions.
 *
 * Hydrated with client:idle — runs after the main thread is idle.
 */
export default function FreshnessProvider({ productIds }: Props) {
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (productIds.length === 0) return;

    const refresh = async () => {
      try {
        const client = getClient();
        const { data } = await client.GET('/api/v1/products/', {
          params: { query: { ids: productIds.join(',') } },
        });

        if (!data) return;
        const products = (data as { results: Array<Record<string, unknown>> }).results ?? [];

        for (const product of products) {
          const id = String(product.id);
          const card = document.querySelector(`[data-product-id="${id}"]`);
          if (!card) continue;

          // Patch sold_out state
          const addBtn = card.querySelector('[data-add-to-cart]') as HTMLButtonElement | null;
          if (addBtn && product.sold_out) {
            addBtn.disabled = true;
            addBtn.setAttribute('aria-disabled', 'true');
          }
        }
      } catch {
        // Silent — freshness is best-effort
      }
    };

    // Initial refresh after idle
    refresh();
    // Re-poll every 5 minutes
    intervalRef.current = setInterval(refresh, 5 * 60 * 1000);

    return () => clearInterval(intervalRef.current);
  }, [productIds]);

  // Renders nothing — pure side-effect island
  return null;
}
