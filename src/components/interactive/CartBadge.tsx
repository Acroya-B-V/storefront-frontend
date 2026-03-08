import { useStore } from '@nanostores/preact';
import { $itemCount } from '@/stores/cart';
import { $isCartOpen } from '@/stores/ui';
import { t } from '@/i18n';

interface Props {
  lang: string;
}

export default function CartBadge({ lang }: Props) {
  const count = useStore($itemCount);

  return (
    <button
      type="button"
      data-cart-trigger
      onClick={() => $isCartOpen.set(true)}
      class="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-card text-foreground transition-all duration-300 hover:bg-card/80"
      aria-label={`${t('cart', lang)}${count > 0 ? ` (${count})` : ''}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M16 10a4 4 0 0 1-8 0" />
        <path d="M3.103 6.034h17.794" />
        <path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" />
      </svg>
      {count > 0 && (
        <span class="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
          {count}
        </span>
      )}
    </button>
  );
}
