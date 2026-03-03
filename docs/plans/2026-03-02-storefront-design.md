# eatsous Storefront Frontend — Design Document

**Date:** 2026-03-02
**Status:** Draft
**Authors:** William Hurst, Claude

---

## 1. Overview

Build the frontend for eatsous, a multi-tenant restaurant ordering storefront platform operating in the Netherlands and beyond. Each merchant gets a fully branded storefront page at `{merchant-slug}.poweredbysous.com`. This is a full-page storefront — not an embeddable widget.

### What we're building

- Menu browsing with category navigation
- Product detail with modifier groups (radio, checkbox, quantity), cross-sells, notes
- Cart management (add, update quantity, remove, discount codes)
- Multi-step checkout flow (fulfilment, delivery, payment, confirmation)
- Group orders with join codes
- Order history with reorder
- CMS pages (legal, FAQ, etc.)
- PostHog analytics with 31 tracked events
- Multi-language, multi-currency support

### What we're NOT building

- Backend, API, or database (Django + Saleor already exists)
- CMS or admin panel
- User authentication (handled by backend)
- Payment processing logic (Stripe Connect via backend)

---

## 2. Architecture

### 2.1 Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Astro 5 | Islands architecture — zero JS by default, hydrate only interactive parts |
| Interactive islands | Preact | 3KB React alternative with API compatibility. Team already knows React. |
| Hosting | Vercel | `@astrojs/vercel` adapter. Single deployment. |
| Rendering | SSR everywhere | Multi-tenant requires runtime merchant resolution. Edge-cached for catalog pages. |
| Styling | Tailwind CSS 4 | Utility-first, pairs with CSS custom properties for theming. `tailwindcss-animate` for animations. |
| State management | nanostores | Astro-recommended cross-island state. Framework-agnostic. ~1KB. |
| API client | `@sous/storefront-sdk` | Auto-generated TypeScript client from OpenAPI spec. Uses `openapi-fetch` (~2KB). |
| i18n routing | Path prefix (`/:lang/`) | `/nl/`, `/en/`, `/de/` — best for SEO, clean hreflang tags |
| i18n strings | Paraglide.js | Compile-time i18n. Tree-shakes to only active language. Zero runtime overhead. |
| Analytics | PostHog | 31 events with centralized capture wrapper. Async loading, no render blocking. |
| Package manager | pnpm | Fast, disk-efficient, strict dependency resolution. First-class Vercel support. |
| SEO | `astro-seo` + `astro-seo-schema` | Consolidates `<head>` tags. JSON-LD structured data for Restaurant/Menu/MenuItem. |

### 2.2 Multi-Tenancy Model

**Single deployment, subdomain-based routing, edge-cached SSR.**

```
User visits bar-sumac.poweredbysous.com/nl/
  → Vercel Edge Network (CDN)
  → Cache HIT? → Serve cached HTML instantly
  → Cache MISS? → Astro SSR (Vercel serverless function)
    → Middleware extracts subdomain "bar-sumac"
    → Loads src/merchants/bar-sumac.json (theme config, cached in-memory)
    → Extracts language from URL path prefix ("/nl/")
    → Injects merchant config + language into Astro.locals
    → Creates SDK client with vendor ID + language
    → Page renders with merchant's branding
    → Response includes Cache-Control headers
    → Vercel CDN caches the response at the edge
```

**Why not SSG?** With multi-tenancy via subdomains, we can't statically generate at build time because we don't know which merchant is being requested. SSR + edge cache gives us the same end-user performance with the flexibility of runtime merchant resolution.

**Why not per-merchant builds?** Managing N Vercel projects and a build pipeline is operationally complex and doesn't serve pages faster than edge-cached SSR.

### 2.3 Rendering Strategy

| Route | Rendering | Caching | Auth |
|---|---|---|---|
| `/:lang/` (menu) | SSR | `s-maxage=300, stale-while-revalidate=3600` | No |
| `/:lang/product/[slug]` | SSR | `s-maxage=300, stale-while-revalidate=3600` | No |
| `/:lang/category/[slug]` | SSR | `s-maxage=300, stale-while-revalidate=3600` | No |
| `/:lang/cart` | SSR | No cache | No |
| `/:lang/checkout` | SSR | No cache | Optional |
| `/:lang/orders` | SSR | No cache | Yes |
| `/:lang/orders/[number]` | SSR | No cache | Yes |
| `/:lang/group/[joinCode]` | SSR | No cache | No |
| `/:lang/pages/[slug]` (CMS) | SSR | `s-maxage=3600, stale-while-revalidate=86400` | No |
| `/sitemap.xml` | SSR | `s-maxage=3600` | No |
| `/robots.txt` | SSR | `s-maxage=86400` | No |

### 2.4 Data Freshness

Catalog pages are edge-cached for 5 minutes. Product availability can change at any moment (sold out, promotion start/end). We use a **two-layer freshness model**:

**Layer 1: Edge-cached SSR** — Fast initial paint with data as of cache time.

**Layer 2: Client-side availability refresh** — After hydration, a `FreshnessProvider` island fetches fresh product data and patches volatile fields:

- `sold_out`, `is_available`, `snoozed_until`, `availability_state`
- `price`, `compare_at_price` (promotions)
- Active promotion badges

**UX:** Silent update — show cached data immediately, patch when fresh data arrives. No loading indicators. User only sees a change if something actually changed.

**Belt and suspenders:** If a user tries to add a sold-out item (stale cache), the cart API rejects it with a 400/422. The UI reverts the optimistic update and marks the item as unavailable.

**Promotion timing:** Freshness check runs on page load and re-polls every 5 minutes for long-lived sessions.

---

## 3. Merchant Theme System

### 3.1 Config Files

Merchant branding config lives as JSON files in the repo at `src/merchants/`. Theme changes require a commit (no runtime config service).

```json
{
  "slug": "bar-sumac",
  "merchantId": "BAR_SUMAC_01",
  "name": "Bar Sumac",
  "description": "Mediterranean-inspired kitchen serving seasonal mezze, grilled meats, and natural wines.",
  "logo": "/merchants/bar-sumac/logo.svg",
  "heroImage": "/merchants/bar-sumac/hero.jpg",
  "favicon": "/merchants/bar-sumac/favicon.ico",
  "languages": ["nl", "en"],
  "defaultLanguage": "nl",
  "currency": "EUR",
  "theme": {
    "background": "0 0% 100%",
    "foreground": "0 0% 3.9%",
    "card": "0 0% 100%",
    "cardForeground": "0 0% 3.9%",
    "cardImage": "40 10% 91%",
    "primary": "0 0% 9%",
    "primaryForeground": "0 0% 98%",
    "secondary": "0 0% 96.1%",
    "secondaryForeground": "0 0% 9%",
    "muted": "0 0% 96.1%",
    "mutedForeground": "0 0% 45.1%",
    "accent": "0 0% 96.1%",
    "accentForeground": "0 0% 9%",
    "destructive": "0 84.2% 60.2%",
    "destructiveForeground": "0 0% 98%",
    "border": "0 0% 89.8%",
    "input": "0 0% 89.8%",
    "ring": "0 0% 3.9%",
    "radius": "0.5rem",
    "fontHeading": "DM Sans",
    "fontBody": "Inter"
  },
  "layout": "grid",
  "contact": {
    "phone": "+31 20 123 4567",
    "email": "info@barsumac.nl",
    "address": "Keizersgracht 123, 1015 Amsterdam"
  },
  "hours": [
    { "days": "Mon-Fri", "open": "11:00", "close": "22:00" },
    { "days": "Sat-Sun", "open": "10:00", "close": "23:00" }
  ],
  "social": {
    "instagram": "https://instagram.com/barsumac"
  },
  "seo": {
    "titleTemplate": "%s | Bar Sumac",
    "defaultDescription": "Bestel online bij Bar Sumac — Mediterraans eten in Amsterdam"
  }
}
```

### 3.2 HSL Token Pattern

Theme tokens use the **shadcn/ui HSL pattern**: values stored as `"H S% L%"` (no `hsl()` wrapper), consumed by Tailwind as `hsl(var(--token))`. This allows opacity modifiers to work natively (e.g., `bg-primary/50`).

```css
/* Injected by BaseLayout.astro from merchant config */
:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 0 0% 3.9%;
  --card-image: 40 10% 91%;
  --primary: 0 0% 9%;
  --primary-foreground: 0 0% 98%;
  --accent: 0 0% 96.1%;
  --accent-foreground: 0 0% 9%;
  /* ... etc */
  --radius: 0.5rem;
}
```

Tailwind config maps these to utilities:

```js
colors: {
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  card: {
    DEFAULT: 'hsl(var(--card))',
    foreground: 'hsl(var(--card-foreground))',
    image: 'hsl(var(--card-image))',
  },
  primary: {
    DEFAULT: 'hsl(var(--primary))',
    foreground: 'hsl(var(--primary-foreground))',
  },
  // ... etc
}
```

### 3.3 Layout Variants

The merchant config `layout` field selects the product listing component:

- `"grid"` — product cards in a responsive grid (default, matches prototype)
- `"list"` — products as horizontal rows with image on the left

This is a component-level switch, not a CSS toggle.

---

## 4. Project Structure

```
eatsous-storefront/
├── astro.config.mjs              # Astro + Preact + Vercel + sitemap
├── tailwind.config.mjs           # Tailwind with HSL theme tokens
├── tsconfig.json
├── package.json
├── pnpm-workspace.yaml
├── vercel.json
├── .env.example
│
├── public/
│   ├── fonts/                    # Self-hosted web fonts (Inter, DM Sans)
│   └── merchants/                # Per-merchant static assets
│       └── bar-sumac/
│           ├── logo.svg
│           ├── hero.jpg
│           └── favicon.ico
│
├── src/
│   ├── middleware.ts              # Subdomain → merchant + language resolution
│   │
│   ├── merchants/                 # Merchant config JSON files
│   │   ├── bar-sumac.json
│   │   └── index.ts              # Config loader with in-memory caching
│   │
│   ├── layouts/
│   │   └── BaseLayout.astro      # HTML shell, <head>, theme injection, fonts, analytics stub
│   │
│   ├── pages/
│   │   ├── [lang]/
│   │   │   ├── index.astro                # Menu/catalog page
│   │   │   ├── product/
│   │   │   │   └── [slug].astro           # Product detail page (also modal from menu)
│   │   │   ├── category/
│   │   │   │   └── [slug].astro           # Category filtered view
│   │   │   ├── cart.astro                 # Full cart page
│   │   │   ├── checkout.astro             # Checkout flow (SSR, no cache)
│   │   │   ├── orders/
│   │   │   │   ├── index.astro            # Order history (authenticated)
│   │   │   │   └── [number].astro         # Order detail
│   │   │   ├── group/
│   │   │   │   └── [joinCode].astro       # Group order join page
│   │   │   └── pages/
│   │   │       └── [slug].astro           # CMS pages (legal, FAQ)
│   │   ├── sitemap.xml.ts                 # Dynamic per-merchant sitemap
│   │   ├── robots.txt.ts                  # Dynamic per-merchant robots.txt
│   │   └── 404.astro                      # Branded "merchant not found" page (Sous branding)
│   │
│   ├── components/
│   │   ├── astro/                         # Zero-JS static components
│   │   │   ├── Header.astro
│   │   │   ├── HeroSection.astro          # Cover image, logo, name, description, hours
│   │   │   ├── ProductCard.astro          # Static card markup (wraps interactive button)
│   │   │   ├── ProductGrid.astro          # Grid layout variant
│   │   │   ├── ProductList.astro          # List layout variant
│   │   │   ├── MenuSection.astro          # Category section with heading + product grid
│   │   │   ├── PromoBadge.astro           # Discount label badge
│   │   │   ├── Footer.astro
│   │   │   ├── SEOHead.astro              # astro-seo wrapper with OG/Twitter/hreflang
│   │   │   └── StructuredData.astro       # JSON-LD injection
│   │   │
│   │   └── interactive/                   # Preact islands (ship JS)
│   │       ├── CategoryTabs.tsx           # Horizontal scroll, animated indicator, overflow drawer
│   │       ├── AddToCartButton.tsx        # Quick-add or open modal, collapsible stepper
│   │       ├── CartBar.tsx                # Sticky bottom bar (mobile: dark, desktop: hidden)
│   │       ├── CartDrawer.tsx             # Bottom sheet (mobile) / popover (desktop)
│   │       ├── ProductDetail.tsx          # Modal with modifiers, cross-sells, notes, quantity
│   │       ├── QuantitySelector.tsx       # +/- controls with animated number
│   │       ├── AnimatedNumber.tsx         # Digit transition animation
│   │       ├── ConfirmRemoveDialog.tsx    # "Remove item?" confirmation
│   │       ├── CheckoutFlow.tsx           # Multi-step checkout form
│   │       ├── SearchBar.tsx              # Product search with autocomplete
│   │       ├── GroupOrderPanel.tsx        # Group order management
│   │       ├── OrderHistory.tsx           # Order list + reorder
│   │       ├── AddressForm.tsx            # Dutch postcode autofill
│   │       └── FreshnessProvider.tsx      # Background availability refresh
│   │
│   ├── stores/                            # Nanostores for cross-island state
│   │   ├── cart.ts                        # Cart state + API sync + localStorage persistence
│   │   ├── merchant.ts                    # Merchant config (set from SSR)
│   │   ├── ui.ts                          # UI state (drawer open, active tab, modal)
│   │   └── auth.ts                        # Auth state (boolean flags only, no token)
│   │
│   ├── lib/
│   │   ├── api.ts                         # SDK client factory (wraps @sous/storefront-sdk)
│   │   ├── theme.ts                       # Theme config → CSS custom properties mapping
│   │   ├── pricing.ts                     # Centralized pricing engine (discounts, line totals)
│   │   ├── currency.ts                    # Intl.NumberFormat currency formatting
│   │   ├── structured-data.ts             # JSON-LD generators (Restaurant, Menu, MenuItem, etc.)
│   │   ├── cache.ts                       # In-memory TTL cache for merchant configs
│   │   └── dutch-address.ts              # PostcodeAPI integration
│   │
│   ├── analytics/
│   │   ├── index.ts                       # Public API: capture(), identify(), setContext()
│   │   ├── posthog.ts                     # PostHog client init (client-side only)
│   │   ├── snapshots.ts                   # getCartSnapshot(), getFulfilmentSnapshot()
│   │   ├── context.ts                     # Core properties, session persistence, UTM tracking
│   │   ├── pii-guard.ts                   # Allowlist/denylist, strips sensitive fields
│   │   ├── events.ts                      # Event name constants + per-event property types
│   │   └── types.ts                       # Full property contract as TypeScript types
│   │
│   ├── i18n/
│   │   ├── messages/
│   │   │   ├── nl.json                    # Dutch UI strings
│   │   │   ├── en.json                    # English UI strings
│   │   │   └── de.json                    # German UI strings
│   │   └── index.ts                       # Paraglide.js setup
│   │
│   ├── styles/
│   │   └── global.css                     # Tailwind directives, base resets, font-face, animations
│   │
│   └── types/
│       └── merchant.ts                    # MerchantConfig TypeScript type
```

---

## 5. Component Architecture

### 5.1 Hydration Strategy

Astro components ship zero JavaScript. Preact islands hydrate independently with different strategies:

| Component | Type | Hydration | Rationale |
|---|---|---|---|
| Header | Astro | None | Static logo + nav |
| HeroSection | Astro | None | Static image + text |
| CategoryTabs | Preact | `client:load` | Needs JS immediately for tab switching + scroll tracking |
| ProductCard | Astro | None | Static card markup |
| PromoBadge | Astro | None | Static badge |
| AddToCartButton | Preact | `client:visible` | Hydrate when card scrolls into view |
| CartBar | Preact | `client:load` | Always visible, needs immediate reactivity |
| CartDrawer | Preact | `client:load` | Must respond to cart state changes |
| ProductDetail | Preact | `client:load` | Modal with modifier selection |
| SearchBar | Preact | `client:idle` | Hydrate after page is idle |
| FreshnessProvider | Preact | `client:idle` | Background data refresh, non-urgent |
| CheckoutFlow | Preact | `client:load` | Full interactive form |
| Footer | Astro | None | Static HTML |

### 5.2 Cross-Island Communication

Preact islands share state via nanostores. No prop drilling, no context providers.

```
User clicks AddToCartButton → updates $cart store
  → CartBar re-renders (new count/total)
  → CartDrawer re-renders (new line item)
  → FreshnessProvider reads current products from cart
```

Nanostores work across islands because they share the same JavaScript module instance.

### 5.3 Key UX Patterns (from prototype)

**Product cards:**
- Responsive: row layout on mobile (104px fixed image), column on desktop (full-width square image)
- Quick-add for simple items (no modifiers) — tap "Add" button, instant add
- Complex items (with modifiers) — tap "Add" or card opens the product modal
- Quantity stepper appears after first add, auto-collapses to just the count after 3 seconds of inactivity, expands on hover/tap
- When quantity is 1, minus button becomes a trash icon with confirm dialog

**Category navigation:**
- Horizontal scrollable tab bar with animated sliding pill indicator
- Scroll-based active category tracking (intersection observer pattern)
- When tabs overflow, a list icon appears that opens a bottom sheet drawer with all categories

**Product modal:**
- Bottom sheet on mobile (slides up), centered dialog on desktop (scales in)
- Modifier groups: radio (pick 1), checkbox (pick up to N), quantity (add 0-N of each)
- Required groups show "Required" badge, turn green with checkmark when filled
- Unfilled required groups shake on submit attempt, auto-scroll to first unfilled
- Cross-sells section: "Frequently combined with" — each item has its own quantity stepper
- Notes field: "Add a note" with textarea
- Sticky bottom CTA: quantity stepper + "Add to order · €XX,XX" button

**Cart:**
- Desktop: popover dropdown from cart button in header
- Mobile: bottom sheet sliding up from cart bar
- Line items show: image, name, selected modifiers (truncated), discount badge, price (with strikethrough if discounted), quantity stepper
- "You save" total displayed when discounts are active
- "Next: Checkout" CTA at bottom

**Mobile cart bar:**
- Dark background (`#1C1C1E`), sticky bottom
- Shows "Cart · N items" and total
- Hides when: cart is empty, cart drawer is open, or category drawer is open
- Respects `safe-area-inset-bottom` for iPhone notch

---

## 6. State Management

### 6.1 Cart Store

The cart is the most complex piece of state. Server-side cart (via API) is the source of truth; client-side store provides optimistic UI.

```typescript
// stores/cart.ts — conceptual shape
import { atom, computed } from 'nanostores';

export const $cart = atom<Cart | null>(null);
export const $cartLoading = atom(false);

export const $itemCount = computed($cart, cart =>
  cart?.line_items.reduce((sum, item) => sum + item.quantity, 0) ?? 0
);

export const $cartTotal = computed($cart, cart => cart?.cart_total ?? "0.00");
```

**Persistence:**
1. On page load → check `localStorage` for `cartId`
2. If found → `GET /api/v1/cart/{cartId}/` to restore server-side cart
3. If expired/missing → user starts fresh, cart created on first "Add to Cart"
4. Cart operations always go through the API (server is source of truth)
5. Optimistic UI: update local store immediately, revert if API fails
6. `cartId` stored in `localStorage` + cookie (cookie for SSR access)

### 6.2 Merchant Store

```typescript
// stores/merchant.ts
import { atom } from 'nanostores';
export const $merchant = atom<MerchantConfig | null>(null);
// Set once from SSR-injected <script> tag, read by all islands
```

### 6.3 UI Store

```typescript
// stores/ui.ts
import { atom } from 'nanostores';
export const $activeCategory = atom<string>('');
export const $isCartOpen = atom(false);
export const $isCategoryDrawerOpen = atom(false);
export const $selectedProduct = atom<Product | null>(null);
```

### 6.4 Auth Store

```typescript
// stores/auth.ts
import { atom } from 'nanostores';
export const $isAuthenticated = atom<boolean>(false);
export const $customerId = atom<string | null>(null);
// Auth state derived from SSR-injected data. The JWT itself is NEVER
// exposed to client-side JavaScript.
```

**Token storage model:** Customer JWTs are stored exclusively in **httpOnly, Secure, SameSite=Lax cookies**. This prevents XSS attacks from accessing tokens.

- **SSR:** Middleware reads the cookie and passes the token to the SDK client for authenticated API calls. The token value is never serialized to HTML or client-side JavaScript.
- **Client-side:** Preact islands know *whether* the user is authenticated (via `$isAuthenticated`, set from SSR-injected data), but never have access to the raw token. Client-side API calls that require auth use `credentials: 'include'` to send the cookie automatically, or go through an Astro API route that proxies the request with the token.
- **Token refresh:** Handled via a server-side Astro API route (`/api/auth/refresh`) that reads the httpOnly cookie, calls the backend's refresh endpoint, and sets the new cookie.
- **Logout:** Clears the httpOnly cookie via a server-side route.

---

## 7. API Integration

### 7.1 SDK Client

The backend generates `@sous/storefront-sdk` — a TypeScript client using `openapi-fetch` with full type safety, automatic `X-Vendor-ID` headers, and language support.

**Server-side (Astro pages):**

```typescript
// Created in middleware, shared via Astro.locals
const sdk = createStorefrontClient({
  baseUrl: import.meta.env.API_BASE_URL,
  vendorId: merchant.merchantId,
  language: lang,
});
locals.sdk = sdk;

// In .astro page frontmatter
const { sdk } = Astro.locals;
const { data: products } = await sdk.GET("/api/v1/products/");
```

**Client-side (Preact islands):**

```typescript
// lib/api.ts — singleton client for browser
import { createStorefrontClient } from '@sous/storefront-sdk';
import { $merchant } from '@/stores/merchant';

let client: ReturnType<typeof createStorefrontClient>;

export function getClient() {
  if (!client) {
    const merchant = $merchant.get();
    client = createStorefrontClient({
      baseUrl: import.meta.env.PUBLIC_API_BASE_URL,
      vendorId: merchant!.merchantId,
      language: document.documentElement.lang,
      // Send httpOnly auth cookie automatically on every request
      fetchOptions: { credentials: 'include' },
    });
  }
  return client;
}
```

### 7.2 Key API Endpoints

**Catalog (SSR data fetching):**
- `GET /api/v1/categories/` — category list
- `GET /api/v1/products/` — product list (paginated)
- `GET /api/v1/products/{id}/` — product detail with modifiers, variants, images
- `GET /api/v1/products/search/` — search products
- `GET /api/v1/collections/` — curated product collections
- `GET /api/v1/promotions/` — active promotions

**Cart (client-side, optimistic UI):**
- `POST /api/v1/cart/` — create cart
- `GET /api/v1/cart/{cart_id}/` — get cart
- `POST /api/v1/cart/{cart_id}/items/` — add item (product_id, quantity, options[])
- `PATCH /api/v1/cart/{cart_id}/items/{item_id}/` — update quantity
- `POST /api/v1/cart/{cart_id}/validate/` — validate before checkout
- `GET /api/v1/cart/{cart_id}/suggestions/` — upsell recommendations

**Checkout (client-side, sequential):**
- `POST /api/v1/checkout/` — create from cart
- `PATCH /api/v1/checkout/{id}/delivery/` — set delivery info
- `GET /api/v1/checkout/{id}/shipping/` — available shipping methods
- `POST /api/v1/checkout/{id}/shipping/select/` — select shipping
- `POST /api/v1/checkout/{id}/apply-discount/` — apply discount code
- `GET /api/v1/checkout/{id}/payment-gateways/` — available payment methods
- `POST /api/v1/checkout/{id}/payment/` — initiate payment
- `POST /api/v1/checkout/{id}/complete/` — complete checkout

**Checkout reliability (idempotency, retries, duplicate-submit prevention):**

Payment and order completion are the most failure-sensitive operations. The frontend must handle:

1. **Duplicate submit prevention:** The "Pay" and "Complete" buttons are disabled immediately on click and show a spinner. Re-enabling only happens on explicit error response. A `submittingRef` (not state — survives React re-renders) gates the handler:
   ```typescript
   const submittingRef = useRef(false);
   async function handlePay() {
     if (submittingRef.current) return;
     submittingRef.current = true;
     try { ... } catch { submittingRef.current = false; }
   }
   ```

2. **Idempotency keys:** All mutating checkout calls (`POST /payment/`, `POST /complete/`) include an `Idempotency-Key` header (UUID generated once per user action, stored in component state). If the network fails mid-request, retrying with the same key is safe — the backend deduplicates.

3. **Retry strategy:** For retryable errors (network timeout, 502/503/504), retry up to 2 times with exponential backoff (1s, 3s). The SDK's `sdkErrorFromResponse` provides `error.retryable` to determine this. Non-retryable errors (400, 422) surface immediately to the user.

4. **Payment redirect recovery:** After redirecting to iDEAL/Stripe, the user returns to a callback URL. If the return callback fails or the user closes the tab mid-payment:
   - On next visit, the checkout page checks `GET /api/v1/checkout/{id}/` for current status
   - If `payment_status` is already "paid", proceed to confirmation
   - If still pending, show "Resume payment" or "Your payment is being processed"

5. **Cart version conflicts:** The cart uses `version` (optimistic locking). If a `PATCH` returns a version conflict (409), re-fetch the cart and show the user what changed before retrying.

**Orders (authenticated):**
- `GET /api/v1/orders/` — order history (cursor-paginated)
- `GET /api/v1/orders/{order_number}/` — order detail
- `POST /api/v1/orders/{order_number}/reorder/` — create cart from previous order

**Group orders:**
- `POST /api/v1/group-orders/` — create group order
- `GET /api/v1/group-orders/{join_code}/` — get group order
- `POST /api/v1/group-orders/{join_code}/join/` — join
- `POST /api/v1/group-orders/{join_code}/items/` — add items
- `POST /api/v1/group-orders/{join_code}/close/` — close group

**CMS:**
- `GET /api/v1/pages/` — list pages
- `GET /api/v1/pages/navigation/` — nav structure
- `GET /api/v1/pages/{slug}/` — page content

### 7.3 Authentication

- **Merchant identity:** `X-Vendor-ID` header on every request (handled by SDK)
- **Customer auth:** JWT from Keycloak via `POST /api/v1/auth/otp/request/` → `POST /api/v1/auth/otp/verify/`
- **Token refresh:** `POST /api/v1/auth/token/refresh/`

### 7.4 Data Types & Money Precision

All money fields from the API are **string-encoded decimals** (e.g., `"12.50"`, not `12.5`). The frontend must handle money carefully:

**Principle:** The backend is the source of truth for all money calculations. The frontend should display values from the API, not compute them independently. Where the frontend does compute (e.g., estimating a line total before the API responds), treat the result as a **preview** and replace it with the API response.

**Display-only formatting:** `Intl.NumberFormat` with `Number(amount)` is acceptable because IEEE 754 doubles represent all integers up to 2^53 and all two-decimal-place values up to ~$70 trillion. For display of menu prices and cart totals this is safe:

```typescript
// lib/currency.ts — for DISPLAY only
export function formatPrice(amount: string, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(amount));
}
```

**Client-side arithmetic (pricing engine):** The prototype's pricing engine uses `number` for discount calculations (percentage, BOGO, tiered). This is acceptable for preview totals shown in the product modal and cart drawer, because:
- All values are capped at menu-price scale (< €10,000)
- Results are rounded to 2 decimal places at each step: `Math.round(x * 100) / 100`
- The cart API recalculates and returns authoritative totals — the frontend replaces its estimate

**What we do NOT do:**
- Never accumulate money across many operations without rounding at each step
- Never use the frontend's calculated total as the payment amount — always use the backend's `cart_total` / `checkout.total`
- Never use `toFixed()` for rounding (it rounds incorrectly for some edge cases) — use `Math.round(x * 100) / 100`

**If precision issues surface:** Add `decimal.js-light` (~3KB) to the pricing engine. This is a deliberate escalation path, not a first-day dependency.

Pagination uses **cursor-based** pagination (next/previous URLs).

---

## 8. Pricing Engine

Port the prototype's centralized pricing engine to TypeScript. All price calculations go through these helpers — no inline math.

### 8.1 Discount Types

| Type | Behaviour | Badge Example |
|---|---|---|
| `percentage` | Unit price reduced by N% | "-15%" |
| `fixed` | Unit price reduced by fixed amount | "€2,00 off" |
| `bogo` | Buy X get Y free (line-level) | "Buy 1 Get 1 Free" |
| `tiered` | Quantity-based pricing (line-level) | "2 for €15" |

### 8.2 Core Functions

```typescript
getOriginalPrice(item)        // Always item.price
getEffectivePrice(item)       // After percentage/fixed discount (BOGO/tiered: unchanged)
hasUnitDiscount(item)         // True for percentage/fixed
getDiscountLabel(item)        // Badge text: "-15%", "€2,00 off", "2 for €15"
getLineTotal(item, qty, mods) // Full line calculation including quantity-dependent discounts
getLineSavings(item, qty, mods) // How much customer saves vs. full price
```

### 8.3 Modifier Pricing

Modifiers have three types mapping to backend `ProductModifierGroup.selection_type`:

| Prototype Type | Backend `selection_type` | UI |
|---|---|---|
| `radio` | `single` | Radio buttons — pick exactly 1 |
| `checkbox` | `multiple` | Checkboxes — pick up to `max_selections` |
| `quantity` | `multiple` (with quantity) | +/- stepper per option |

Modifier prices are additive per unit: `(base_price + sum(modifier_prices)) × quantity`.

---

## 9. Internationalization & Localization

### 9.1 URL Structure

```
/:lang/                          → Menu page
/:lang/product/:slug             → Product detail
/:lang/category/:slug            → Category view
/:lang/cart                      → Cart
/:lang/checkout                  → Checkout
/:lang/orders                    → Order history
/:lang/orders/:number            → Order detail
/:lang/group/:joinCode           → Group order
/:lang/pages/:slug               → CMS pages
```

Invalid language codes redirect to the merchant's default language, preserving the original path and query string (e.g., `/xx/product/caesar-salad?ref=share` → `/nl/product/caesar-salad?ref=share`).

### 9.2 Translation Layers

**Content translations** (product titles, descriptions): Handled by the backend. The SDK's `language` parameter sets `Accept-Language`, and the API returns translations with fallback to default.

**UI string translations** (buttons, labels, errors): Paraglide.js with compile-time message functions. Only the active language's strings are bundled per page.

```
src/i18n/messages/
  nl.json → { "addToCart": "Toevoegen", "soldOut": "Uitverkocht", ... }
  en.json → { "addToCart": "Add to cart", "soldOut": "Sold out", ... }
```

### 9.3 Currency Formatting

```typescript
// lib/currency.ts
export function formatPrice(amount: string, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(Number(amount));
}
// formatPrice("23.50", "EUR", "nl-NL") → "€ 23,50"
// formatPrice("23.50", "EUR", "en-GB") → "€23.50"
// formatPrice("23.50", "GBP", "en-GB") → "£23.50"
```

The `locale` from the URL path drives both API language and number/date/currency formatting. The `currency` comes from the merchant config.

---

## 10. Analytics — PostHog Integration

### 10.1 Event Contract

31 tracked events, ported from the existing widget storefront analytics:

**Navigation:** `widget_opened` (→ `session_started`), `widget_closed` (→ `session_ended`), `screen_viewed`, `category_viewed`, `product_viewed`, `deep_link_activated`

**Interaction:** `product_added_to_cart`, `product_removed_from_cart`, `cart_quantity_updated`, `delivery_option_selected`, `delivery_date_selected`, `payment_method_selected`, `checkout_started`, `checkout_info_entered`

**Conversion:** `payment_initiated`, `payment_completed`, `order_completed`, `order_failed`

**Error:** `error_occurred`, `product_load_failed`, `cart_operation_failed`, `checkout_failed`, `payment_failed`

**Engagement:** `session_started`, `session_ended`, `cart_abandoned`

**Upsell:** `upsell_viewed`, `upsell_product_clicked`, `upsell_accepted`, `upsell_dismissed`

**Pickup/Delivery:** `pickup_timeslot_conflict`, `pickup_time_selected`, `delivery_restriction_conflict`, `delivery_method_enforced`, `pickup_slot_unavailable`

### 10.2 Property Contract

Every event includes three layers of properties merged automatically:

**1. Core properties (ALL events):**
`merchant_id`, `storefront_version`, `environment`, `session_id`, `anonymous_id`, `user_id`, `customer_type`, `currency`, `country`, `locale`, `page_url`, `page_path`, `referrer`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `device_type`

**2. Cart/value snapshot (ALL events):**
`cart_id`, `cart_item_count`, `cart_distinct_sku_count`, `cart_subtotal`, `cart_tax`, `cart_delivery_fee`, `cart_service_fee`, `cart_discount_total`, `cart_total`, `expected_order_value`, `minimum_order_value`, `minimum_order_gap`, `is_below_minimum_order`

**3. Fulfilment snapshot (ALL events):**
`fulfilment_mode`, `fulfilment_selected_at`, `delivery_postcode_prefix`, `delivery_distance_km`, `prep_time_minutes`, `eta_min_minutes`, `eta_max_minutes`, `fulfilment_slot_date`, `fulfilment_slot_start`, `fulfilment_slot_end`

**4. Event-specific properties** added where relevant (product, error, payment, order details).

### 10.3 Architecture

```typescript
// analytics/index.ts
export function capture(eventName: EventName, eventProps: EventSpecificProps = {}) {
  const payload = {
    ...getCoreProperties(),
    ...getCartSnapshot(),       // reads from $cart nanostore
    ...getFulfilmentSnapshot(),
    ...eventProps,
  };
  const sanitized = stripPII(payload);
  if (shouldDeduplicate(eventName, sanitized)) return;
  posthog.capture(eventName, sanitized);
}
```

### 10.4 Loading Strategy

PostHog loads asynchronously with no impact on LCP/INP:

1. Tiny inline stub (~200 bytes) queues events during hydration
2. PostHog SDK (~20KB gzipped) loads async via separate script
3. On load, stub is replaced with real `capture()`, queued events are flushed

### 10.5 PII Guard

Hard allowlist approach — blocked fields (`email`, `phone`, `name`, `address`, `postal_code`) are stripped before any event is sent. Postcodes are truncated to prefix only (NL: first 4 chars).

### 10.6 De-duplication

- `product_viewed`: fires once per `product_id` per session
- `screen_viewed`: debounced during rapid navigation

### 10.7 Session Management

Since this is a multi-page app (not SPA), session state is persisted across navigations:

- `session_id`: generated on first visit, stored in `sessionStorage`
- `anonymous_id`: generated on first visit, stored in `localStorage` (survives sessions)
- UTM params: captured from URL on entry, stored in `sessionStorage`
- `customer_type`: `"new"` if no `anonymous_id` existed, `"returning"` if it did

---

## 11. SEO & Structured Data

### 11.1 Packages

- `astro-seo` — consolidates all `<head>` SEO tags into a single component
- `astro-seo-schema` — JSON-LD output helper
- Dynamic `sitemap.xml` and `robots.txt` endpoints (per-merchant, SSR)

### 11.2 SEOHead.astro

Uses `astro-seo` to manage per-page metadata:

- `<title>` using merchant's `titleTemplate`
- `<meta name="description">`
- Canonical URL (`Astro.url.href`)
- Open Graph tags (title, description, image, locale)
- Twitter card tags
- `hreflang` links for all language variants + `x-default`
- `robots` meta (noindex for cart/checkout/orders)

### 11.3 Structured Data (JSON-LD)

| Page | Schema Types |
|---|---|
| Menu (`/:lang/`) | `Restaurant` + `Menu` with `MenuSection[]` containing `MenuItem[]` |
| Product (`/:lang/product/[slug]`) | `MenuItem` + `Offer` (price, availability, promo pricing) + `BreadcrumbList` |
| Category (`/:lang/category/[slug]`) | `ItemList` + `BreadcrumbList` |
| CMS page (`/:lang/pages/[slug]`) | `WebPage` + `BreadcrumbList` |

### 11.4 Sitemap

Dynamic SSR endpoint at `/sitemap.xml`:
- Per-merchant: lists all product URLs, category URLs, CMS pages
- Includes `<xhtml:link>` for language alternates
- `lastmod` from product `updated_at`
- Cached: `s-maxage=3600`

### 11.5 robots.txt

Dynamic SSR endpoint at `/robots.txt`:

```
User-agent: *
Allow: /
Disallow: /*/cart
Disallow: /*/checkout
Disallow: /*/orders
Sitemap: https://{merchant-slug}.poweredbysous.com/sitemap.xml
```

### 11.6 View Transitions

**Not used in initial release.** Standard MPA navigation ensures every page is a clean HTML document that crawlers handle natively. View Transitions can be added as a progressive enhancement after confirming solid crawl coverage.

---

## 12. Performance

### 12.1 Budget

**JS budget for the menu page (critical path):**

| Chunk | Estimated gzipped |
|---|---|
| Preact runtime | ~4KB |
| nanostores + @nanostores/preact | ~1.5KB |
| @sous/storefront-sdk (openapi-fetch) | ~2KB |
| CategoryTabs (`client:load`) | ~3KB |
| AddToCartButton × N (`client:visible`) | ~4KB shared + ~0.5KB per instance |
| CartBar + CartDrawer (`client:load`) | ~6KB |
| ProductDetail modal (`client:load`) | ~8KB |
| FreshnessProvider (`client:idle`) | ~2KB |
| Analytics stub (inline) | ~0.2KB |
| Shared: pricing engine, currency, stores | ~4KB |
| **Menu page total** | **~35KB** |
| PostHog SDK (`async`, not blocking) | ~20KB (loaded after interactive) |

**Realistic total with PostHog: ~55KB.** The 50KB budget was optimistic. Revised targets:

- Blocking JS (menu page, before interactive): **< 35KB gzipped**
- Total JS including async (PostHog): **< 60KB gzipped**
- LCP target: < 2.0s on mobile 4G
- INP target: < 150ms
- CLS target: < 0.1

**Enforcement:**
- Add `bundlesize` or `size-limit` to CI — fail the build if blocking JS exceeds 40KB gzipped
- Measure after first implementation sprint with Lighthouse CI on Vercel preview deployments
- If budget is exceeded, escalation path: move ProductDetail to `client:visible` (lazy), reduce icon imports, or split CartDrawer into a separate lazy-loaded chunk

### 12.2 Image Optimization

- **Hero/logo:** Astro's `<Image />` component — generates AVIF/WebP with srcset
- **Product images from CDN:** `<img>` with `srcset`, `sizes`, `loading="lazy"`, `decoding="async"`
- **Hero image:** preloaded with `<link rel="preload" as="image">` in `<head>`
- **Placeholders:** CSS `background-color` from card-image token (no layout shift)

### 12.3 Font Loading

- Self-hosted in `public/fonts/` (no Google Fonts request)
- `font-display: swap` for fast text rendering
- Preload primary body font: `<link rel="preload" as="font" crossorigin>`

### 12.4 Prefetching

- Astro's built-in `prefetch` for product links on hover/viewport intersection
- `<link rel="preconnect">` for API domain, CDN, and font origins

### 12.5 Code Splitting

- Each Preact island is a separate chunk
- `client:visible` on below-fold islands — JS not loaded until user scrolls there
- `client:idle` on non-critical islands — loads after main thread is idle
- Checkout JS never loads on the menu page

### 12.6 Edge Caching

- Catalog pages: `Cache-Control: public, s-maxage=300, stale-while-revalidate=3600`
- CMS pages: `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`
- Static assets: immutable hashes, long cache
- Cart/checkout/orders: no caching

---

## 13. Accessibility

### 13.1 Keyboard Navigation

- Category tabs: arrow keys to move, Enter/Space to select
- Product grid: tab to each card, Enter opens product detail
- Cart drawer: focus trap when open, Escape to close
- Product modal: focus trap, Escape to close
- Checkout form: logical tab order, field-level error association

### 13.2 ARIA Patterns

- Category tabs: `role="tablist"` + `role="tab"` + `aria-selected` + `tabindex` management (active tab `tabindex="0"`, others `tabindex="-1"`, arrow keys move focus)
- Cart drawer: `role="dialog"` + `aria-modal="true"` + `aria-label`
- Product modal: `role="dialog"` + `aria-modal="true"` + `aria-label`
- Cart updates: `aria-live="polite"` region announces item count changes
- Sold out items: `aria-disabled="true"` on add button
- Confirm remove dialog: `role="alertdialog"`

### 13.3 Motion

All animations respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 13.4 Color Contrast

Theme system validates merchant theme colors at load time and warns if contrast ratio < 4.5:1 (AA) for text, < 3:1 for large text.

### 13.5 Touch Targets

All interactive elements: `min-height: 44px; min-width: 44px` (Tailwind `min-h-11 min-w-11`).

---

## 14. Middleware

```typescript
// src/middleware.ts
import type { MiddlewareHandler } from 'astro';
import { loadMerchantConfig } from './merchants';
import { createStorefrontClient } from '@sous/storefront-sdk';

/**
 * Resolves merchant slug from hostname.
 * Handles:
 *  - Production:  bar-sumac.poweredbysous.com           → "bar-sumac"
 *  - Local dev:   bar-sumac.localhost:4321        → "bar-sumac"
 *  - Vercel preview: bar-sumac--branch.vercel.app → "bar-sumac"
 *  - Custom domain: barsumac.nl                   → looked up via CUSTOM_DOMAINS env map
 *  - Fallback:    uses DEFAULT_MERCHANT env var   → for plain localhost / CI
 */
function resolveMerchantSlug(hostname: string): string {
  // Strip port
  const host = hostname.split(':')[0];

  // Custom domain mapping (env: JSON string of { "barsumac.nl": "bar-sumac" })
  let customDomains: Record<string, string> = {};
  try {
    customDomains = JSON.parse(import.meta.env.CUSTOM_DOMAINS || '{}');
  } catch {
    console.error('CUSTOM_DOMAINS env var is not valid JSON — ignoring');
  }
  if (customDomains[host]) return customDomains[host];

  // Known platform domains: extract first segment before known suffixes
  const platformSuffixes = ['.poweredbysous.com', '.poweredbysous.localhost', '.vercel.app'];
  for (const suffix of platformSuffixes) {
    if (host.endsWith(suffix)) {
      const prefix = host.slice(0, -suffix.length);
      // Vercel preview branches: "bar-sumac--branch-name" → "bar-sumac"
      return prefix.split('--')[0];
    }
  }

  // Bare localhost / unknown host: fall back to env default
  return import.meta.env.DEFAULT_MERCHANT || 'bar-sumac';
}

const CACHEABLE_PATTERNS = [
  /^\/[a-z]{2}\/?$/,                    // menu page
  /^\/[a-z]{2}\/product\//,             // product pages
  /^\/[a-z]{2}\/category\//,            // category pages
  /^\/[a-z]{2}\/pages\//,               // CMS pages
];

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { request, locals, redirect } = context;
  const url = new URL(request.url);

  // 1. Resolve merchant from hostname
  //    Supports: bar-sumac.poweredbysous.com, bar-sumac.poweredbysous.localhost:4321,
  //              bar-sumac--preview-abc.vercel.app, custom-domain.com
  const slug = resolveMerchantSlug(url.hostname);
  const merchant = await loadMerchantConfig(slug);

  if (!merchant) {
    // Render the branded 404 page (src/pages/404.astro) with Sous branding
    // context.rewrite() renders the page content without a client-side redirect
    return context.rewrite('/404');
  }

  // 2. Extract and validate language from path, preserving path + query on redirect
  const pathMatch = url.pathname.match(/^\/([a-z]{2})(\/.*)?$/);
  const lang = pathMatch?.[1];
  const restOfPath = pathMatch?.[2] ?? '/';

  if (!lang || !merchant.languages.includes(lang)) {
    // No valid language prefix found — redirect to default language.
    // Two cases:
    //   a) Path starts with an invalid 2-letter lang code (e.g. /xx/product/slug)
    //      → replace the bad prefix, keep restOfPath
    //   b) Path has no lang prefix at all (e.g. /product/slug?x=1)
    //      → prepend the default language to the full original pathname
    const targetPath = lang
      ? `/${merchant.defaultLanguage}${restOfPath}${url.search}`   // case (a)
      : `/${merchant.defaultLanguage}${url.pathname}${url.search}`; // case (b)
    return redirect(targetPath);
  }

  // 3. Create SDK client
  const sdk = createStorefrontClient({
    baseUrl: import.meta.env.API_BASE_URL,
    vendorId: merchant.merchantId,
    language: lang,
  });

  // 4. Inject into locals
  locals.merchant = merchant;
  locals.lang = lang;
  locals.sdk = sdk;

  // 5. Execute page
  const response = await next();

  // 6. Add cache headers — with safety guardrails against caching personalized responses
  const isCacheable = CACHEABLE_PATTERNS.some(p => p.test(url.pathname));
  const hasAuthCookie = request.headers.get('cookie')?.includes('auth_token');
  const responseSetsCookie = response.headers.has('set-cookie');

  if (isCacheable && !hasAuthCookie && !responseSetsCookie) {
    const ttl = url.pathname.includes('/pages/') ? 3600 : 300;
    response.headers.set(
      'Cache-Control',
      `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 12}`
    );
  } else if (isCacheable && (hasAuthCookie || responseSetsCookie)) {
    // Authenticated user on a cacheable route — serve fresh but don't poison the cache
    response.headers.set('Cache-Control', 'private, no-store');
  }

  return response;
};
```

---

## 15. Conversion Optimization

- **Guest checkout as default** — no account required to place an order
- **Dutch address autofill** — postcode (4 digits + 2 letters) + house number → street + city via PostcodeAPI
- **iDEAL as primary payment method** — prominently displayed, NL's most popular payment method
- **VAT-inclusive pricing** — legally required in NL B2C, enforced via `StorefrontConfig.tax_inclusive`
- **Optimistic UI** — instant "add to cart" feedback, revert on error
- **Persistent cart** — survives page refreshes and navigation via localStorage + server-side cart
- **Minimum order value** — clear display of gap: "Nog €5,00 tot minimale bestelwaarde"
- **Upsell suggestions** — `GET /api/v1/cart/{id}/suggestions/` and `GET /api/v1/products/{id}/suggestions/`
- **Reorder** — `POST /api/v1/orders/{number}/reorder/` creates cart from previous order
- **Trust signals** — payment provider logos, clear delivery times, order tracking

---

## 16. Agentic Commerce Readiness

- **Clean semantic HTML** — Astro's zero-JS default means pages are pure HTML, parseable by LLMs and AI agents
- **Structured data everywhere** — JSON-LD for Restaurant, Menu, MenuItem, Offer, BreadcrumbList
- **Stable URL patterns** — predictable, clean routes (`/:lang/product/:slug`)
- **Headless-first checkout** — the checkout flow is entirely API-driven, completable programmatically
- **Product feed** — `GET /api/v1/products/` returns structured product data with availability, pricing, and modifiers

---

## 17. Dependencies

### Runtime

| Package | Purpose | Size |
|---|---|---|
| `astro` | Framework | — |
| `@astrojs/preact` | Preact integration | — |
| `@astrojs/vercel` | Vercel adapter | — |
| `@astrojs/tailwind` | Tailwind integration | — |
| `preact` | UI library for islands | ~4KB |
| `nanostores` | Cross-island state | ~1KB |
| `@nanostores/preact` | Preact bindings for nanostores | ~0.5KB |
| `@sous/storefront-sdk` | API client | ~2KB |
| `astro-seo` | SEO `<head>` management | — |
| `astro-seo-schema` | JSON-LD helpers | — |
| `posthog-js` | Analytics | ~20KB (async) |
| `tailwindcss-animate` | Animation utilities | — |
| `lucide-preact` | Icon library | Tree-shaken |

### Build-time

| Package | Purpose |
|---|---|
| `tailwindcss` | CSS utility framework |
| `typescript` | Type checking |
| `@anthropic-ai/paraglide-js` | Compile-time i18n |

### NOT included

- No React (Preact only)
- No state management library beyond nanostores
- No CSS-in-JS
- No heavyweight component library (custom components matching prototype)
- No decimal.js — `Intl.NumberFormat` for display, string decimals from API for calculations

---

## 18. Open Questions — Delivery Blockers

These must be resolved before implementation can begin on the affected features. Each is tagged with a severity indicating whether it blocks the entire project or just a specific feature.

| # | Question | Blocks | Severity | Owner | Target |
|---|---|---|---|---|---|
| 1 | **SDK installation** — Is `@sous/storefront-sdk` published to npm, or do we need to link it locally / use a git dependency? | All API integration | **Go/No-Go** | TBD | Before sprint 1 |
| 2 | **Image CDN** — Where are product images hosted? Do they support responsive variants (width/format params)? | Image optimization, `srcset` | **Go/No-Go** | TBD | Before sprint 1 |
| 3 | **Customer auth flow** — Is the Keycloak OTP integration ready? Can we test login → JWT → httpOnly cookie flow? | Orders, checkout with saved addresses | Feature-blocker | TBD | Before checkout sprint |
| 4 | **PostcodeAPI provider** — Which provider for Dutch address autofill? (postcode.tech, postcodeapi.nu, etc.) Need API key. | Address autofill in checkout | Feature-blocker | TBD | Before checkout sprint |
| 5 | **Fulfilment locations** — Does the merchant config need a `locationId` for time slot fetching? | Delivery/pickup slot selection | Feature-blocker | TBD | Before checkout sprint |
| 6 | **Dark mode** — The prototype has dark mode CSS variables defined. Do merchants need dark mode support in MVP? | Theme system scope | Nice-to-have | TBD | Before theme finalization |
| 7 | **Font licensing** — Are DM Sans and Inter the default fonts, or per-merchant? Both are open source (OFL). | Font loading strategy | Low | TBD | Before first merchant onboarding |
