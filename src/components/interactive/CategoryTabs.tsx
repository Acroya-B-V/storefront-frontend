import { useStore } from '@nanostores/preact';
import { useEffect, useRef, useCallback } from 'preact/hooks';
import { $activeCategory, $isCategoryDrawerOpen } from '@/stores/ui';

interface Category {
  id: string;
  name: string;
}

interface Props {
  categories: Category[];
}

export default function CategoryTabs({ categories }: Props) {
  const activeCategory = useStore($activeCategory);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const indicatorRef = useRef<HTMLDivElement>(null);
  const isUserClick = useRef(false);

  // Update sliding pill indicator position
  const updateIndicator = useCallback((categoryId: string) => {
    const tab = tabRefs.current.get(categoryId);
    const indicator = indicatorRef.current;
    const container = scrollRef.current;
    if (!tab || !indicator || !container) return;

    const containerRect = container.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    indicator.style.width = `${tabRect.width}px`;
    indicator.style.transform = `translateX(${tabRect.left - containerRect.left + container.scrollLeft}px)`;
  }, []);

  // Scroll-based active category tracking via IntersectionObserver
  useEffect(() => {
    const sections = categories.map((c) =>
      document.getElementById(`category-${c.id}`),
    ).filter(Boolean) as HTMLElement[];

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isUserClick.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-category-id');
            if (id) $activeCategory.set(id);
          }
        }
      },
      { rootMargin: '-112px 0px -60% 0px', threshold: 0 },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [categories]);

  // Update indicator when active category changes
  useEffect(() => {
    if (activeCategory) {
      updateIndicator(activeCategory);
      // Scroll tab into view
      const tab = tabRefs.current.get(activeCategory);
      tab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeCategory, updateIndicator]);

  // Set initial active category
  useEffect(() => {
    if (!activeCategory && categories.length > 0) {
      $activeCategory.set(categories[0].id);
    }
  }, [categories, activeCategory]);

  const handleTabClick = (categoryId: string) => {
    isUserClick.current = true;
    $activeCategory.set(categoryId);

    const section = document.getElementById(`category-${categoryId}`);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Re-enable scroll tracking after smooth scroll completes
      setTimeout(() => { isUserClick.current = false; }, 800);
    } else {
      isUserClick.current = false;
    }
  };

  const handleKeyDown = (e: KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight') nextIndex = Math.min(index + 1, categories.length - 1);
    else if (e.key === 'ArrowLeft') nextIndex = Math.max(index - 1, 0);
    else return;

    e.preventDefault();
    const nextCat = categories[nextIndex];
    const tab = tabRefs.current.get(nextCat.id);
    tab?.focus();
    handleTabClick(nextCat.id);
  };

  return (
    <div class="sticky top-14 z-30 border-b border-border bg-background">
      <div class="mx-auto flex max-w-screen-xl items-center px-4">
        <div
          ref={scrollRef}
          role="tablist"
          class="relative flex flex-1 gap-1 overflow-x-auto scrollbar-none py-2"
        >
          {/* Sliding indicator */}
          <div
            ref={indicatorRef}
            class="absolute bottom-2 left-0 h-8 rounded-md bg-accent transition-all duration-200"
            aria-hidden="true"
          />

          {categories.map((cat, i) => (
            <button
              key={cat.id}
              ref={(el) => { if (el) tabRefs.current.set(cat.id, el); }}
              role="tab"
              type="button"
              aria-selected={activeCategory === cat.id}
              tabIndex={activeCategory === cat.id ? 0 : -1}
              onClick={() => handleTabClick(cat.id)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              class={`relative z-10 shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeCategory === cat.id
                  ? 'text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Category drawer trigger for overflow */}
        <button
          type="button"
          onClick={() => $isCategoryDrawerOpen.set(true)}
          class="ml-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:hidden"
          aria-label="All categories"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  );
}
