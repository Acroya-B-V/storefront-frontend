import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $merchant } from '@/stores/merchant';
import { $selectedProduct } from '@/stores/ui';
import { formatPrice } from '@/lib/currency';
import { t } from '@/i18n';
import { getClient } from '@/lib/api';

interface SearchResult {
  id: string;
  name: string;
  price: string;
  image?: string | null;
  slug?: string;
}

interface Props {
  lang: string;
}

export default function SearchBar({ lang }: Props) {
  const merchant = useStore($merchant);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const currency = merchant?.currency ?? 'EUR';
  const locale = lang === 'nl' ? 'nl-NL' : lang === 'de' ? 'de-DE' : 'en-GB';

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const client = getClient();
      const { data } = await client.GET('/api/v1/products/search/', {
        params: { query: { q } },
      });
      if (data) {
        const page = data as { results: SearchResult[] };
        setResults(page.results ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  const handleSelect = (result: SearchResult) => {
    $selectedProduct.set({ id: result.id, name: result.name });
    setIsOpen(false);
    setQuery('');
    setResults([]);
  };

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
        setResults([]);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Listen for search trigger from Header button
  useEffect(() => {
    const handler = () => {
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    };
    document.querySelectorAll('[data-search-trigger]').forEach((el) =>
      el.addEventListener('click', handler),
    );
    return () => {
      document.querySelectorAll('[data-search-trigger]').forEach((el) =>
        el.removeEventListener('click', handler),
      );
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => { setIsOpen(false); setQuery(''); setResults([]); }} />

      <div class="mx-auto mt-16 w-full max-w-lg px-4">
        <div class="overflow-hidden rounded-lg bg-card shadow-xl">
          <div class="flex items-center border-b border-border px-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-muted-foreground"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onInput={(e) => handleInput((e.target as HTMLInputElement).value)}
              placeholder={t('search', lang)}
              class="flex-1 bg-transparent px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              aria-label={t('search', lang)}
            />
            {loading && (
              <div class="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            )}
          </div>

          {results.length > 0 && (
            <ul class="max-h-64 overflow-y-auto py-1">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(result)}
                    class="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent"
                  >
                    {result.image && (
                      <div class="h-10 w-10 shrink-0 overflow-hidden rounded bg-card-image">
                        <img src={result.image} alt="" class="h-full w-full object-cover" width="40" height="40" loading="lazy" />
                      </div>
                    )}
                    <div class="flex-1">
                      <span class="text-sm font-medium text-card-foreground">{result.name}</span>
                    </div>
                    <span class="text-sm text-muted-foreground">
                      {formatPrice(result.price, currency, locale)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {query.length >= 2 && results.length === 0 && !loading && (
            <div class="px-3 py-6 text-center text-sm text-muted-foreground">
              No results
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
