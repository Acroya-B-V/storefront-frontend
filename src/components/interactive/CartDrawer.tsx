import { useStore } from '@nanostores/preact';
import { useEffect, useRef } from 'preact/hooks';
import { $cart, $cartTotal, $cartLoading } from '@/stores/cart';
import { $isCartOpen } from '@/stores/ui';
import { $merchant } from '@/stores/merchant';
import { formatPrice } from '@/lib/currency';
import { t } from '@/i18n';
import QuantitySelector from './QuantitySelector';
import { getClient } from '@/lib/api';

interface Props {
  lang: string;
}

export default function CartDrawer({ lang }: Props) {
  const cart = useStore($cart);
  const cartTotal = useStore($cartTotal);
  const isOpen = useStore($isCartOpen);
  const merchant = useStore($merchant);
  const drawerRef = useRef<HTMLDivElement>(null);

  const currency = merchant?.currency ?? 'EUR';
  const locale = lang === 'nl' ? 'nl-NL' : lang === 'de' ? 'de-DE' : 'en-GB';

  // Focus trap and escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        $isCartOpen.set(false);
        return;
      }
      if (e.key === 'Tab' && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, a, input, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    $cartLoading.set(true);
    try {
      const client = getClient();
      const { data } = await client.PATCH(`/api/v1/cart/items/{id}/`, {
        params: { path: { id: itemId } },
        body: { quantity: newQuantity },
      });
      if (data) $cart.set(data as typeof cart);
    } finally {
      $cartLoading.set(false);
    }
  };

  const handleRemove = async (itemId: string) => {
    $cartLoading.set(true);
    try {
      const client = getClient();
      const { data } = await client.DELETE(`/api/v1/cart/items/{id}/`, {
        params: { path: { id: itemId } },
      });
      if (data) $cart.set(data as typeof cart);
    } finally {
      $cartLoading.set(false);
    }
  };

  if (!isOpen) return null;

  const lineItems = cart?.line_items ?? [];
  const savings = cart?.cart_savings && parseFloat(cart.cart_savings) > 0 ? cart.cart_savings : null;

  return (
    <div class="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        class="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
        onClick={() => $isCartOpen.set(false)}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('cart', lang)}
        class="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-hidden rounded-t-xl bg-card shadow-xl md:bottom-auto md:left-auto md:right-4 md:top-16 md:w-96 md:rounded-lg"
      >
        {/* Header */}
        <div class="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 class="font-heading text-base font-semibold text-card-foreground">
            {t('cart', lang)}
          </h2>
          <button
            type="button"
            onClick={() => $isCartOpen.set(false)}
            class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
            aria-label={t('close', lang)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* Body */}
        <div class="overflow-y-auto px-4 py-3" style={{ maxHeight: 'calc(85vh - 140px)' }}>
          {lineItems.length === 0 ? (
            <div class="py-8 text-center">
              <p class="text-sm text-muted-foreground">{t('emptyCart', lang)}</p>
              <button
                type="button"
                onClick={() => $isCartOpen.set(false)}
                class="mt-3 text-sm font-medium text-primary hover:underline"
              >
                {t('continueShopping', lang)}
              </button>
            </div>
          ) : (
            <ul class="divide-y divide-border">
              {lineItems.map((item) => (
                <li key={item.id} class="flex gap-3 py-3">
                  {/* Item image */}
                  {item.product_image && (
                    <div class="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-card-image">
                      <img
                        src={item.product_image}
                        alt=""
                        class="h-full w-full object-cover"
                        width="64"
                        height="64"
                        loading="lazy"
                      />
                    </div>
                  )}

                  <div class="flex flex-1 flex-col justify-between">
                    <div>
                      <h3 class="text-sm font-medium text-card-foreground">{item.product_name}</h3>
                      {item.modifiers.length > 0 && (
                        <p class="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {item.modifiers.map((m) => m.name).join(', ')}
                        </p>
                      )}
                    </div>
                    <div class="mt-1 flex items-center justify-between">
                      <QuantitySelector
                        quantity={item.quantity}
                        onIncrement={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                        onDecrement={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                        onRemove={() => handleRemove(item.id)}
                        lang={lang}
                      />
                      <div class="text-right">
                        <span class="text-sm font-semibold text-card-foreground">
                          {formatPrice(item.line_total, currency, locale)}
                        </span>
                        {item.discount && (
                          <span class="block text-xs text-destructive">
                            {item.discount.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {lineItems.length > 0 && (
          <div class="border-t border-border px-4 py-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
            {savings && (
              <div class="mb-2 flex items-center justify-between text-sm">
                <span class="text-muted-foreground">{t('youSave', lang)}</span>
                <span class="font-medium text-destructive">
                  {formatPrice(savings, currency, locale)}
                </span>
              </div>
            )}
            <div class="mb-3 flex items-center justify-between">
              <span class="text-sm font-medium text-card-foreground">{t('orderTotal', lang)}</span>
              <span class="text-lg font-bold text-card-foreground">
                {formatPrice(cartTotal, currency, locale)}
              </span>
            </div>
            <a
              href={`/${lang}/checkout`}
              class="flex h-12 w-full items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t('nextCheckout', lang)}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
