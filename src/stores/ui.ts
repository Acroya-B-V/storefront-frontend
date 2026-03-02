import { atom } from 'nanostores';

export const $activeCategory = atom<string>('');
export const $isCartOpen = atom(false);
export const $isCategoryDrawerOpen = atom(false);
export const $selectedProduct = atom<Record<string, unknown> | null>(null);
