import { atom } from 'nanostores';

/**
 * Auth state derived from SSR-injected data.
 * The JWT itself is NEVER exposed to client-side JavaScript —
 * it lives exclusively in httpOnly cookies.
 */
export const $isAuthenticated = atom<boolean>(false);
export const $customerId = atom<string | null>(null);
