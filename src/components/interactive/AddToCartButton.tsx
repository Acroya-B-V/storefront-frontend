import { useStore } from '@nanostores/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { $cart, $cartLoading } from '@/stores/cart';
import { $selectedProduct } from '@/stores/ui';
import { getClient } from '@/lib/api';
import { t } from '@/i18n';
import QuantitySelector from './QuantitySelector';

interface Props {
  productId: string;
  productName: string;
  hasModifiers: boolean;
  soldOut: boolean;
  lang: string;
}

export default function AddToCartButton({
  productId,
  productName,
  hasModifiers,
  soldOut,
  lang,
}: Props) {
  const cart = useStore($cart);
  const loading = useStore($cartLoading);
  const [collapsed, setCollapsed] = useState(true);
  const collapseTimer = useRef<ReturnType<typeof setTimeout>>();

  const cartItem = cart?.line_items.find((item) => item.product_id === productId);
  const quantity = cartItem?.quantity ?? 0;

  // Auto-collapse stepper after 3 seconds of inactivity
  useEffect(() => {
    if (quantity > 0 && !collapsed) {
      collapseTimer.current = setTimeout(() => setCollapsed(true), 3000);
      return () => clearTimeout(collapseTimer.current);
    }
  }, [quantity, collapsed]);

  const resetCollapseTimer = () => {
    clearTimeout(collapseTimer.current);
    setCollapsed(false);
    collapseTimer.current = setTimeout(() => setCollapsed(true), 3000);
  };

  const updateCartItem = async (itemId: string, newQuantity: number) => {
    $cartLoading.set(true);
    try {
      const client = getClient();
      if (newQuantity === 0) {
        const { data } = await client.DELETE(`/api/v1/cart/items/{id}/`, {
          params: { path: { id: itemId } },
        });
        if (data) $cart.set(data as typeof cart);
      } else {
        const { data } = await client.PATCH(`/api/v1/cart/items/{id}/`, {
          params: { path: { id: itemId } },
          body: { quantity: newQuantity },
        });
        if (data) $cart.set(data as typeof cart);
      }
    } finally {
      $cartLoading.set(false);
    }
  };

  const handleAdd = async () => {
    if (soldOut) return;

    if (hasModifiers) {
      $selectedProduct.set({ id: productId, name: productName });
      return;
    }

    $cartLoading.set(true);
    const prevCart = cart;
    try {
      const client = getClient();
      const { data, error } = await client.POST('/api/v1/cart/items/', {
        body: { product_id: productId, quantity: 1 },
      });

      if (error) {
        $cart.set(prevCart);
        console.error('Failed to add to cart:', error);
      } else if (data) {
        $cart.set(data as typeof cart);
      }
    } catch {
      $cart.set(prevCart);
    } finally {
      $cartLoading.set(false);
    }
  };

  if (soldOut) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        class="inline-flex h-9 items-center justify-center rounded-md bg-muted px-3 text-xs font-medium text-muted-foreground"
      >
        {t('soldOut', lang)}
      </button>
    );
  }

  if (quantity > 0 && collapsed) {
    return (
      <button
        type="button"
        onClick={resetCollapseTimer}
        class="inline-flex h-9 min-w-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
        aria-label={`${quantity} in cart, tap to adjust`}
      >
        {quantity}
      </button>
    );
  }

  if (quantity > 0 && !collapsed) {
    const handleIncrement = () => {
      resetCollapseTimer();
      if (cartItem) updateCartItem(cartItem.id, cartItem.quantity + 1);
    };
    const handleDecrement = () => {
      resetCollapseTimer();
      if (cartItem) updateCartItem(cartItem.id, cartItem.quantity - 1);
    };
    const handleRemove = () => {
      if (cartItem) updateCartItem(cartItem.id, 0);
    };

    return (
      <QuantitySelector
        quantity={quantity}
        onIncrement={handleIncrement}
        onDecrement={handleDecrement}
        onRemove={handleRemove}
        lang={lang}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={loading}
      class="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
    >
      {t('addToCart', lang)}
    </button>
  );
}
