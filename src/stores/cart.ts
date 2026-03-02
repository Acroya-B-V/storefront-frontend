import { atom, computed } from 'nanostores';

export interface CartLineItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image?: string;
  quantity: number;
  unit_price: string;
  line_total: string;
  modifiers: Array<{
    id: string;
    name: string;
    price: string;
    quantity: number;
  }>;
  discount?: {
    type: string;
    label: string;
    savings: string;
  };
  notes?: string;
}

export interface Cart {
  id: string;
  line_items: CartLineItem[];
  cart_total: string;
  cart_savings?: string;
  item_count: number;
}

export const $cart = atom<Cart | null>(null);
export const $cartLoading = atom(false);

export const $itemCount = computed($cart, (cart) =>
  cart?.line_items.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
);

export const $cartTotal = computed($cart, (cart) => cart?.cart_total ?? '0.00');

const CART_ID_KEY = 'sous_cart_id';

export function getStoredCartId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CART_ID_KEY);
}

export function setStoredCartId(cartId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CART_ID_KEY, cartId);
}

export function clearStoredCartId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CART_ID_KEY);
}
