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

  // Find this product's quantity in the cart
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

  const handleAdd = async () => {
    if (soldOut) return;

    // Complex items open the ProductDetail modal
    if (hasModifiers) {
      $selectedProduct.set({ id: productId, name: productName });
      return;
    }

    // Simple items: optimistic add
    $cartLoading.set(true);
    const prevCart = cart;

    try {
      const client = getClient();
      const { data, error } = await client.POST('/api/v1/cart/items/', {
        body: { product_id: productId, quantity: 1 },
      });

      if (error) {
        // Revert on error
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

  const handleIncrement = async () => {
    resetCollapseTimer();
    if (!cartItem) return;

    $cartLoading.set(true);
    try {
      const client = getClient();
      await client.PATCH(`/api/v1/cart/items/{id}/`, {
        params: { path: { id: cartItem.id } },
        body: { quantity: cartItem.quantity + 1 },
      });
    } finally {
      $cartLoading.set(false);
    }
  };

  const handleDecrement = async () => {
    resetCollapseTimer();
    if (!cartItem || cartItem.quantity <= 1) return;

    $cartLoading.set(true);
    try {
      const client = getClient();
      await client.PATCH(`/api/v1/cart/items/{id}/`, {
        params: { path: { id: cartItem.id } },
        body: { quantity: cartItem.quantity - 1 },
      });
    } finally {
      $cartLoading.set(false);
    }
  };

  const handleRemove = async () => {
    if (!cartItem) return;

    $cartLoading.set(true);
    try {
      const client = getClient();
      await client.DELETE(`/api/v1/cart/items/{id}/`, {
        params: { path: { id: cartItem.id } },
      });
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

  // Show quantity badge (collapsed stepper) when item is in cart
  if (quantity > 0 && collapsed) {
    return (
      <button
        type="button"
        onClick={() => {
          resetCollapseTimer();
        }}
        class="inline-flex h-9 min-w-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
        aria-label={`${quantity} in cart, tap to adjust`}
      >
        {quantity}
      </button>
    );
  }

  // Show full stepper when expanded
  if (quantity > 0 && !collapsed) {
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

  // Initial "Add" button
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
