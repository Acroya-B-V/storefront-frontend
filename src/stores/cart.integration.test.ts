import { describe, it, expect, beforeEach } from 'vitest';
import { $cart, $itemCount, $cartTotal, getStoredCartId, setStoredCartId, clearStoredCartId } from './cart';
import type { Cart } from './cart';

const mockCart: Cart = {
  id: 'cart-123',
  line_items: [
    {
      id: 'li-1',
      product_id: 'prod-1',
      product_title: 'Falafel Wrap',
      quantity: 2,
      unit_price: '8.50',
      line_total: '17.00',
    },
    {
      id: 'li-2',
      product_id: 'prod-2',
      product_title: 'Hummus',
      quantity: 1,
      unit_price: '4.00',
      line_total: '4.00',
      selected_options: [{ id: 'mod-1', name: 'Extra tahini', price: '0.50', quantity: 1 }],
    },
  ],
  cart_total: '21.00',
  cart_savings: '0.00',
  item_count: 3,
};

describe('cart store integration', () => {
  beforeEach(() => {
    $cart.set(null);
  });

  it('computed $itemCount reflects line item quantities', () => {
    expect($itemCount.get()).toBe(0);
    $cart.set(mockCart);
    expect($itemCount.get()).toBe(3); // 2 + 1
  });

  it('computed $cartTotal reflects cart total', () => {
    expect($cartTotal.get()).toBe('0.00');
    $cart.set(mockCart);
    expect($cartTotal.get()).toBe('21.00');
  });

  it('$itemCount updates when cart changes', () => {
    $cart.set(mockCart);
    expect($itemCount.get()).toBe(3);

    // Simulate removing an item
    const updatedCart: Cart = {
      ...mockCart,
      line_items: [mockCart.line_items[0]],
      cart_total: '17.00',
      item_count: 2,
    };
    $cart.set(updatedCart);
    expect($itemCount.get()).toBe(2);
  });

  it('handles null cart gracefully', () => {
    $cart.set(null);
    expect($itemCount.get()).toBe(0);
    expect($cartTotal.get()).toBe('0.00');
  });

  it('handles empty line_items', () => {
    $cart.set({ id: 'cart-empty', line_items: [], cart_total: '0.00', item_count: 0 });
    expect($itemCount.get()).toBe(0);
    expect($cartTotal.get()).toBe('0.00');
  });
});

describe('cart persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and retrieves cart ID', () => {
    expect(getStoredCartId()).toBeNull();
    setStoredCartId('cart-456');
    expect(getStoredCartId()).toBe('cart-456');
  });

  it('clears stored cart ID', () => {
    setStoredCartId('cart-789');
    expect(getStoredCartId()).toBe('cart-789');
    clearStoredCartId();
    expect(getStoredCartId()).toBeNull();
  });
});
