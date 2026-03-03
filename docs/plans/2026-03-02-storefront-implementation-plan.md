# Storefront Frontend Implementation Plan

> **For Claude:** If available, use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the eatsous multi-tenant restaurant ordering storefront frontend from scratch — a greenfield Astro 5 + Preact project deployed on Vercel.

**Architecture:** Single Vercel deployment serving all merchants via subdomain-based routing. Astro Islands architecture — zero JS by default, Preact islands hydrate only interactive parts. Edge-cached SSR for catalog pages, no cache for personalized/transactional pages.

**Tech Stack:** Astro 5, Preact, Tailwind CSS 4, nanostores, @sous/storefront-sdk (openapi-fetch), @inlang/paraglide-js, PostHog, Vitest, pnpm

**Design Document:** `docs/plans/2026-03-02-storefront-design.md` (1168 lines) — the authoritative spec for all features and behaviors.

**Current State:** Greenfield repo with only `README.md` committed. Design doc exists but is untracked.

**Commit strategy:** One commit per phase (not per micro-task). Instead, commit once at the end of each phase:

> **IMPORTANT:** Many tasks below still contain `git add`/`git commit` code blocks. **These are DEAD CODE — do not execute them.** They were part of an earlier per-task commit model. The phase-level table below is the only commit guidance.

| Phase | Commit message                                                          |
| ----- | ----------------------------------------------------------------------- |
| 1     | `feat: initialize Astro project with Preact, Tailwind, Vercel`          |
| 2     | `feat: add core types and TDD libraries (currency, pricing, theme)`     |
| 3     | `feat: add merchant config system with import.meta.glob`                |
| 4     | `feat: add middleware with subdomain routing and language resolution`   |
| 5     | `feat: add BaseLayout with theme injection and branded 404 page`        |
| 6     | `feat: add nanostores for merchant, cart, UI, and auth state`           |
| 7     | `feat: add SDK client factories for server and client`                  |
| 8     | `feat: set up Paraglide.js i18n with NL/EN/DE translations`             |
| 9     | `feat: add static Astro components (header, hero, cards, SEO)`          |
| 10    | `feat: add menu, category, and product detail pages`                    |
| 11    | `feat: add interactive Preact islands`                                  |
| 12    | `feat: add PostHog analytics integration with PII guard`                |
| 13    | `feat: add dynamic sitemap.xml and robots.txt`                          |
| 14    | `feat: add cart page and CMS pages`                                     |
| 15    | `feat: add checkout flow with address autofill and payment reliability` |
| 16    | `feat: add auth system (login page, OTP flow, cookie management)`       |
| 17    | `feat: add order history and detail pages`                              |
| 18    | `feat: add group order page and panel`                                  |
| 19    | `feat: add bundle size checks, accessibility pass, integration tests`   |

---

## Phase 0: Resolve Blockers (Hard Gates)

**Gates 1-3 block all implementation (Phases 1+). Gates 4-7 block only Phases 15-17 and can be resolved in parallel with Phases 1-14.**

### Gate 1: SDK availability (Go/No-Go)

Determine how to install `@sous/storefront-sdk`:

- Published to npm? → `pnpm add @sous/storefront-sdk`
- Git dependency? → `pnpm add "git+ssh://..."`
- Local link? → `pnpm add ../storefront-backend/storefront_backend/sdk/storefront-ts-client`

**Verification:** `pnpm add <chosen-source>` succeeds, and this resolves in a `.ts` file:

```typescript
import { createStorefrontClient } from '@sous/storefront-sdk';
```

### Gate 2: Image CDN contract (Go/No-Go)

Confirm where product images are hosted and whether the CDN supports responsive variants (width/format query params for `srcset`).

**Required output:** A documented image URL pattern, e.g.:

```
https://cdn.poweredbysous.com/{merchant}/{image_id}?w=400&format=webp
```

If no CDN resize API exists, fall back to `<img>` with a single `src` and defer `srcset` to a later sprint.

### Gate 3: API data contracts

Confirm two things against the live/staging API:

1. **Pagination strategy for catalog pages.** `GET /api/v1/products/` is paginated. Options:
   - **a)** API supports a `?category={id}` filter → fetch per-category (preferred, smaller pages)
   - **b)** API supports `?page_size=999` to fetch all in one shot → use for small menus, add cursor-based fallback for large ones
   - **c)** Neither → implement cursor-based `fetchAll()` helper that follows `next` URLs server-side

2. **Slug→ID resolution for product detail pages.** Routes use `/:lang/product/:slug` but the API uses `GET /products/{id}/`. Options:
   - **a)** API supports `GET /products/?slug={slug}` → resolve in page frontmatter
   - **b)** Product list results include both `id` and `slug` → build slug→id map from catalog fetch
   - **c)** Neither → use product ID in the URL instead of slug (less SEO-friendly)

**Required output:** Chosen option for each, documented here for use in Tasks 7, 17, 18.

### Gate 4: Cross-origin auth contract (Feature-blocker for checkout/orders)

Confirm the backend's CORS, cookie, and CSRF configuration for cross-subdomain authenticated requests. See Task 11 for the exact checklist. Without this, client-side authenticated API calls will silently fail.

**Required output:** Documented answers to:

- Does the backend echo requesting origin in `Access-Control-Allow-Origin`?
- What is the auth cookie name and domain setting?
- Is CSRF middleware active on API routes? If yes, what header/cookie name?

### Gate 5: Customer auth flow readiness (Feature-blocker for checkout/orders)

Is the Keycloak OTP integration ready? Can we test: request OTP → verify OTP → receive JWT → set httpOnly cookie?

**Required output:** A working OTP→JWT flow testable against staging.

### Gate 6: PostcodeAPI provider (Feature-blocker for checkout)

Which Dutch address autofill provider? (postcode.tech, postcodeapi.nu, etc.) Need API key and rate limit documentation.

**Required output:** Provider name, API key, and example request/response documented.

### Gate 7: Fulfilment location IDs (Feature-blocker for checkout)

Does the merchant config need a `locationId` for time slot fetching via the API?

**Required output:** Yes/no, and if yes, add field to `MerchantConfig` type.

---

**Gate timing:** Gates 1-3 block all implementation. Gates 4-7 block only Phases 15-17 (checkout, auth, orders) and can be resolved in parallel with Phases 1-14.

---

## Phase 1: Project Foundation

### Task 1: Initialize Astro project and install dependencies

**Files:**

- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `tailwind.config.mjs`
- Create: `vercel.json`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `src/env.d.ts`

**Step 1: Initialize Astro project with pnpm**

```bash
pnpm create astro@latest . --template minimal --install --no-git --typescript strict
```

If the interactive prompts block, create files manually.

**Step 2: Install runtime dependencies**

```bash
pnpm add preact @astrojs/preact @astrojs/vercel @astrojs/tailwind nanostores @nanostores/preact astro-seo astro-seo-schema posthog-js tailwindcss-animate lucide-preact
```

**Step 3: Install dev dependencies**

```bash
pnpm add -D tailwindcss typescript vitest @testing-library/preact jsdom happy-dom
```

Note: `@sous/storefront-sdk` — check open question #1 in design doc. If not published to npm, install via git dependency or local link:

```bash
# If published: pnpm add @sous/storefront-sdk
# If git: pnpm add "git+ssh://git@github.com:sous/storefront-sdk.git"
# If local: pnpm add ../storefront-backend/storefront_backend/sdk/storefront-ts-client
```

**Step 4: Configure Astro** (`astro.config.mjs`)

```javascript
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [preact({ compat: true }), tailwind()],
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
});
```

**Step 5: Configure TypeScript** (`tsconfig.json`)

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "jsx": "react-jsx",
    "jsxImportSource": "preact"
  }
}
```

**Step 6: Configure Tailwind** (`tailwind.config.mjs`)

Port from design doc section 3.2. HSL custom property pattern with `hsl(var(--token))` colors, `borderRadius` from `--radius`, `fontFamily` from `--font-*`, and `tailwindcss-animate` plugin.

Reference: design doc lines 194-211 for exact color mapping.

```javascript
import animate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
          image: 'hsl(var(--card-image))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      fontFamily: {
        sans: ['var(--font-body)'],
        heading: ['var(--font-heading)'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
};
```

**Step 7: Configure Vercel** (`vercel.json`)

```json
{
  "framework": "astro"
}
```

**Step 8: Create `.env.example`**

```
# API
API_BASE_URL=https://api.poweredbysous.com
PUBLIC_API_BASE_URL=https://api.poweredbysous.com

# Multi-tenancy
DEFAULT_MERCHANT=bar-sumac
CUSTOM_DOMAINS={}

# Analytics
PUBLIC_POSTHOG_KEY=phc_xxx
PUBLIC_POSTHOG_HOST=https://eu.posthog.com

# Auth cookies (env-driven — must differ per environment)
AUTH_COOKIE_DOMAIN=.poweredbysous.localhost
AUTH_COOKIE_SECURE=false

# Environment
PUBLIC_ENVIRONMENT=development
```

**Step 9: Create `.gitignore`**

Ensure it includes: `node_modules/`, `dist/`, `.vercel/`, `.astro/`, `.env`, `.env.local`.

**Step 10: Create `src/env.d.ts`**

```typescript
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly API_BASE_URL: string;
  readonly PUBLIC_API_BASE_URL: string;
  readonly DEFAULT_MERCHANT: string;
  readonly CUSTOM_DOMAINS: string;
  readonly PUBLIC_POSTHOG_KEY: string;
  readonly PUBLIC_POSTHOG_HOST: string;
  readonly AUTH_COOKIE_DOMAIN: string;
  readonly AUTH_COOKIE_SECURE: string;
  readonly PUBLIC_ENVIRONMENT: string;
}
```

**Step 11: Create Vitest config** (`vitest.config.ts`)

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
```

**Step 12: Verify project builds**

```bash
pnpm astro check && pnpm astro build
```

Expected: Build succeeds (may warn about no pages yet).

**Step 13: Commit**

```bash
git add -A
git commit -m "feat: initialize Astro project with Preact, Tailwind, Vercel"
```

---

### Task 2: Create global styles and directory scaffolding

**Files:**

- Create: `src/styles/global.css`
- Create: `public/fonts/.gitkeep`
- Create: `public/merchants/.gitkeep`
- Create: `src/lib/.gitkeep`

**Step 1: Create global CSS** (`src/styles/global.css`)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Step 2: Create directory structure**

```bash
mkdir -p src/{components/{astro,interactive},stores,lib,analytics,i18n/messages,types,merchants,layouts,pages/\[lang\]/{product,category,orders,group,pages}}
mkdir -p public/{fonts,merchants/bar-sumac}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add global styles and directory scaffolding"
```

---

## Phase 2: Types & Core Libraries (TDD)

### Task 3: Create MerchantConfig type

**Files:**

- Create: `src/types/merchant.ts`

**Step 1: Create the type** (`src/types/merchant.ts`)

Define the `MerchantConfig` TypeScript type exactly matching the JSON schema in design doc section 3.1 (lines 118-170). Fields:

```typescript
export interface MerchantTheme {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  cardImage: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  radius: string;
  fontHeading: string;
  fontBody: string;
}

export interface MerchantHours {
  days: string;
  open: string;
  close: string;
}

export interface MerchantConfig {
  slug: string;
  merchantId: string;
  name: string;
  description: string;
  logo: string;
  heroImage: string;
  favicon: string;
  languages: string[];
  defaultLanguage: string;
  currency: string;
  theme: MerchantTheme;
  layout: 'grid' | 'list';
  contact: {
    phone: string;
    email: string;
    address: string;
  };
  hours: MerchantHours[];
  social: Record<string, string>;
  seo: {
    titleTemplate: string;
    defaultDescription: string;
  };
}
```

**Step 2: Commit**

```bash
git add src/types/merchant.ts
git commit -m "feat: add MerchantConfig TypeScript type"
```

---

### Task 4: Currency formatting (TDD)

**Files:**

- Create: `src/lib/currency.ts`
- Create: `src/lib/currency.test.ts`

**Step 1: Write failing tests** (`src/lib/currency.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { formatPrice } from './currency';

describe('formatPrice', () => {
  it('formats EUR in Dutch locale', () => {
    expect(formatPrice('23.50', 'EUR', 'nl-NL')).toContain('23,50');
  });

  it('formats EUR in English locale', () => {
    expect(formatPrice('23.50', 'EUR', 'en-GB')).toContain('23.50');
  });

  it('formats zero price', () => {
    expect(formatPrice('0.00', 'EUR', 'nl-NL')).toContain('0,00');
  });

  it('handles whole number strings', () => {
    const result = formatPrice('10', 'EUR', 'nl-NL');
    expect(result).toContain('10,00');
  });

  it('handles GBP currency', () => {
    expect(formatPrice('23.50', 'GBP', 'en-GB')).toContain('£');
  });
});
```

**Step 2: Run tests to verify failure**

```bash
pnpm vitest run src/lib/currency.test.ts
```

Expected: FAIL — `formatPrice` not found.

**Step 3: Implement** (`src/lib/currency.ts`)

```typescript
export function formatPrice(amount: string, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(Number(amount));
}
```

**Step 4: Run tests to verify pass**

```bash
pnpm vitest run src/lib/currency.test.ts
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add src/lib/currency.ts src/lib/currency.test.ts
git commit -m "feat: add currency formatting utility with tests"
```

---

### Task 5: Pricing engine (TDD)

**Files:**

- Create: `src/lib/pricing.ts`
- Create: `src/lib/pricing.test.ts`

This is the most complex pure-logic module. Port from the prototype's `lib/pricing.ts` design (design doc section 8).

**Step 1: Write failing tests** (`src/lib/pricing.test.ts`)

Cover all discount types from design doc section 8.1:

```typescript
import { describe, it, expect } from 'vitest';
import {
  getOriginalPrice,
  getEffectivePrice,
  hasUnitDiscount,
  getDiscountLabel,
  getLineTotal,
  getLineSavings,
} from './pricing';

// Test data factory
function makeItem(overrides = {}) {
  return {
    price: '10.00',
    discount: null,
    modifiers: [],
    ...overrides,
  };
}

describe('getOriginalPrice', () => {
  it('returns the item price as number', () => {
    expect(getOriginalPrice(makeItem())).toBe(10.0);
  });
});

describe('getEffectivePrice', () => {
  it('returns original price when no discount', () => {
    expect(getEffectivePrice(makeItem())).toBe(10.0);
  });

  it('applies percentage discount', () => {
    const item = makeItem({ discount: { type: 'percentage', value: 15 } });
    expect(getEffectivePrice(item)).toBe(8.5);
  });

  it('applies fixed discount', () => {
    const item = makeItem({ discount: { type: 'fixed', value: 2 } });
    expect(getEffectivePrice(item)).toBe(8.0);
  });

  it('does not go below zero', () => {
    const item = makeItem({ discount: { type: 'fixed', value: 20 } });
    expect(getEffectivePrice(item)).toBe(0);
  });

  it('does not apply BOGO at unit level', () => {
    const item = makeItem({ discount: { type: 'bogo', buyQuantity: 1, getQuantity: 1 } });
    expect(getEffectivePrice(item)).toBe(10.0);
  });

  it('does not apply tiered at unit level', () => {
    const item = makeItem({ discount: { type: 'tiered', quantity: 2, price: 15 } });
    expect(getEffectivePrice(item)).toBe(10.0);
  });
});

describe('hasUnitDiscount', () => {
  it('returns true for percentage', () => {
    expect(hasUnitDiscount(makeItem({ discount: { type: 'percentage', value: 10 } }))).toBe(true);
  });

  it('returns true for fixed', () => {
    expect(hasUnitDiscount(makeItem({ discount: { type: 'fixed', value: 2 } }))).toBe(true);
  });

  it('returns false for bogo', () => {
    expect(
      hasUnitDiscount(makeItem({ discount: { type: 'bogo', buyQuantity: 1, getQuantity: 1 } })),
    ).toBe(false);
  });

  it('returns false for no discount', () => {
    expect(hasUnitDiscount(makeItem())).toBe(false);
  });
});

describe('getDiscountLabel', () => {
  it('returns percentage label', () => {
    expect(
      getDiscountLabel(makeItem({ discount: { type: 'percentage', value: 15 } }), 'EUR', 'nl-NL'),
    ).toBe('-15%');
  });

  it('returns fixed label with currency', () => {
    const label = getDiscountLabel(
      makeItem({ discount: { type: 'fixed', value: 2 } }),
      'EUR',
      'nl-NL',
    );
    expect(label).toContain('2');
    expect(label).toContain('off');
  });

  it('returns bogo label', () => {
    const label = getDiscountLabel(
      makeItem({ discount: { type: 'bogo', buyQuantity: 1, getQuantity: 1 } }),
      'EUR',
      'nl-NL',
    );
    expect(label).toContain('Buy');
  });

  it('returns tiered label', () => {
    const label = getDiscountLabel(
      makeItem({ discount: { type: 'tiered', quantity: 2, price: 15 } }),
      'EUR',
      'nl-NL',
    );
    expect(label).toContain('2');
  });
});

describe('getLineTotal', () => {
  it('multiplies price by quantity for simple items', () => {
    expect(getLineTotal(makeItem(), 3)).toBe(30.0);
  });

  it('applies percentage discount then multiplies', () => {
    const item = makeItem({ discount: { type: 'percentage', value: 10 } });
    expect(getLineTotal(item, 2)).toBe(18.0);
  });

  it('applies BOGO correctly', () => {
    const item = makeItem({ discount: { type: 'bogo', buyQuantity: 1, getQuantity: 1 } });
    // Buy 2, pay for 1
    expect(getLineTotal(item, 2)).toBe(10.0);
    // Buy 3, pay for 2
    expect(getLineTotal(item, 3)).toBe(20.0);
  });

  it('applies tiered pricing', () => {
    const item = makeItem({ discount: { type: 'tiered', quantity: 2, price: 15 } });
    // 1 item: regular price
    expect(getLineTotal(item, 1)).toBe(10.0);
    // 2 items: tiered price
    expect(getLineTotal(item, 2)).toBe(15.0);
  });

  it('adds modifier prices', () => {
    const modifiers = [
      { price: '1.50', quantity: 1 },
      { price: '2.00', quantity: 2 },
    ];
    // (10 + 1.50 + 4.00) * 1 = 15.50
    expect(getLineTotal(makeItem(), 1, modifiers)).toBe(15.5);
  });

  it('rounds to 2 decimal places', () => {
    const item = makeItem({ price: '3.33', discount: { type: 'percentage', value: 10 } });
    // 3.33 * 0.9 = 2.997 → 3.00
    expect(getLineTotal(item, 1)).toBe(3.0);
  });
});

describe('getLineSavings', () => {
  it('returns 0 with no discount', () => {
    expect(getLineSavings(makeItem(), 2)).toBe(0);
  });

  it('calculates savings for percentage discount', () => {
    const item = makeItem({ discount: { type: 'percentage', value: 50 } });
    expect(getLineSavings(item, 2)).toBe(10.0);
  });
});
```

**Step 2: Run tests to verify failure**

```bash
pnpm vitest run src/lib/pricing.test.ts
```

Expected: FAIL.

**Step 3: Implement** (`src/lib/pricing.ts`)

Implement all 6 functions. Key rules:

- `Math.round(x * 100) / 100` at each step (never `toFixed()`)
- BOGO: `paidItems = qty - Math.floor(qty / (buy + get)) * get`
- Tiered: if `qty >= tier.quantity`, use `tier.price` as line total
- Modifiers: `sum(mod.price * mod.quantity)` added to base price before quantity multiplication

Reference: design doc section 8 (lines 637-672).

**Step 4: Run tests to verify pass**

```bash
pnpm vitest run src/lib/pricing.test.ts
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add src/lib/pricing.ts src/lib/pricing.test.ts
git commit -m "feat: add centralized pricing engine with discount support"
```

---

### Task 6: Theme mapping utility (TDD)

**Files:**

- Create: `src/lib/theme.ts`
- Create: `src/lib/theme.test.ts`

**Step 1: Write failing tests** (`src/lib/theme.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { themeToCSS } from './theme';

describe('themeToCSS', () => {
  it('converts camelCase keys to kebab-case CSS custom properties', () => {
    const css = themeToCSS({
      background: '0 0% 100%',
      cardForeground: '0 0% 3.9%',
      radius: '0.5rem',
      fontHeading: 'DM Sans',
      fontBody: 'Inter',
    });
    expect(css).toContain('--background: 0 0% 100%');
    expect(css).toContain('--card-foreground: 0 0% 3.9%');
    expect(css).toContain('--radius: 0.5rem');
    expect(css).toContain('--font-heading: DM Sans');
    expect(css).toContain('--font-body: Inter');
  });
});
```

**Step 2: Run to verify failure, implement, run to verify pass**

```typescript
// src/lib/theme.ts
import type { MerchantTheme } from '@/types/merchant';

export function themeToCSS(theme: Partial<MerchantTheme>): string {
  return Object.entries(theme)
    .map(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `--${cssKey}: ${value};`;
    })
    .join('\n  ');
}
```

**Step 3: Commit**

```bash
git add src/lib/theme.ts src/lib/theme.test.ts
git commit -m "feat: add theme-to-CSS mapping utility"
```

---

## Phase 3: Merchant Config System

### Task 7: Merchant config loader with caching (TDD)

**Files:**

- Create: `src/merchants/index.ts`
- Create: `src/merchants/index.test.ts`
- Create: `src/merchants/bar-sumac.json`

**Step 1: Create sample merchant config** (`src/merchants/bar-sumac.json`)

Copy the full JSON from design doc section 3.1 (lines 118-170).

**Step 2: Write failing tests** (`src/merchants/index.test.ts`)

Test `loadMerchantConfig(slug)`:

- Returns config for known slug
- Returns `null` for unknown slug
- Caches results (same object reference on second call)

**Step 3: Implement** (`src/merchants/index.ts`)

```typescript
import type { MerchantConfig } from '@/types/merchant';

// import.meta.glob is statically analyzable by Vite — every .json file in
// this directory is included in the build. Fully dynamic import(`${slug}.json`)
// would NOT be analyzable and could silently fail in production.
const configs = import.meta.glob<{ default: MerchantConfig }>('./*.json', {
  eager: true,
});

// Build slug → config map once at module load
const configMap = new Map<string, MerchantConfig>();
for (const [path, mod] of Object.entries(configs)) {
  // path is e.g. "./bar-sumac.json" → slug "bar-sumac"
  const slug = path.replace(/^\.\//, '').replace(/\.json$/, '');
  configMap.set(slug, mod.default);
}

export function loadMerchantConfig(slug: string): MerchantConfig | null {
  return configMap.get(slug) ?? null;
}
```

Note: This is synchronous — no `async` needed. All configs are eagerly loaded at build time. Adding a new merchant requires adding a JSON file and redeploying.

**Step 4: Run tests, verify pass, commit**

```bash
git add src/merchants/
git commit -m "feat: add merchant config loader with in-memory caching"
```

---

## Phase 4: Middleware

### Task 8: Implement middleware (TDD)

**Files:**

- Create: `src/middleware.ts`
- Create: `src/lib/resolve-merchant.ts`
- Create: `src/lib/resolve-merchant.test.ts`

The middleware is the most critical piece — every request flows through it. Extract `resolveMerchantSlug()` into a testable pure function.

**Step 1: Write failing tests** (`src/lib/resolve-merchant.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { resolveMerchantSlug } from './resolve-merchant';

describe('resolveMerchantSlug', () => {
  it('extracts slug from production domain', () => {
    expect(resolveMerchantSlug('bar-sumac.poweredbysous.com')).toBe('bar-sumac');
  });

  it('extracts slug from localhost with port', () => {
    expect(resolveMerchantSlug('bar-sumac.poweredbysous.localhost:4321')).toBe('bar-sumac');
  });

  it('extracts slug from Vercel preview, stripping branch', () => {
    expect(resolveMerchantSlug('bar-sumac--feat-xyz.vercel.app')).toBe('bar-sumac');
  });

  it('looks up custom domain from env map', () => {
    const customDomains = '{"barsumac.nl":"bar-sumac"}';
    expect(resolveMerchantSlug('barsumac.nl', customDomains)).toBe('bar-sumac');
  });

  it('handles malformed CUSTOM_DOMAINS JSON gracefully', () => {
    expect(resolveMerchantSlug('barsumac.nl', 'not-json')).toBe('bar-sumac');
  });

  it('falls back to DEFAULT_MERCHANT for bare localhost', () => {
    expect(resolveMerchantSlug('localhost:4321', '{}', 'test-merchant')).toBe('test-merchant');
  });

  it('falls back to bar-sumac when no DEFAULT_MERCHANT', () => {
    expect(resolveMerchantSlug('localhost:4321')).toBe('bar-sumac');
  });
});
```

**Step 2: Implement** (`src/lib/resolve-merchant.ts`)

Extract the pure function from design doc section 14 (lines 987-1012). Accept `hostname`, `customDomainsJson`, and `defaultMerchant` as parameters for testability.

**Step 3: Run tests, verify pass**

**Step 4: Implement middleware** (`src/middleware.ts`)

Full implementation from design doc section 14 (lines 973-1088):

- Calls `resolveMerchantSlug()` with env vars
- Loads merchant config, rewrites to `/404` if not found
- Extracts + validates language prefix, redirects preserving path+query
- Creates SDK client, injects into `locals`
- Adds cache headers with auth/personalization guards

Reference: design doc lines 1021-1087 for the exact `onRequest` handler.

**Step 5: Commit**

```bash
git add src/middleware.ts src/lib/resolve-merchant.ts src/lib/resolve-merchant.test.ts
git commit -m "feat: add middleware with subdomain routing and language resolution"
```

---

## Phase 5: Layout, Pages & 404

### Task 9: Create BaseLayout and 404 page

**Files:**

- Create: `src/layouts/BaseLayout.astro`
- Create: `src/pages/404.astro`

**Step 1: Create BaseLayout** (`src/layouts/BaseLayout.astro`)

The HTML shell that every page wraps. Key responsibilities:

- Accepts `title`, `description`, `merchant` props
- Injects merchant theme as CSS custom properties via `<style>` tag using `themeToCSS()`
- Loads fonts (preload body font)
- Sets `<html lang>` attribute from `Astro.locals.lang`
- Includes PostHog analytics stub (inline ~200 bytes)
- Includes `<link rel="preconnect">` for API and CDN domains
- Renders `<slot />`

Reference: design doc sections 3.2, 12.3, 12.4.

```astro
---
import { themeToCSS } from '@/lib/theme';
import type { MerchantConfig } from '@/types/merchant';
import '@/styles/global.css';

interface Props {
  title: string;
  description?: string;
}

const { title, description } = Astro.props;
const merchant = Astro.locals.merchant as MerchantConfig | undefined;
const lang = Astro.locals.lang as string | undefined;
const themeCSS = merchant ? themeToCSS(merchant.theme) : '';
---

<!doctype html>
<html lang={lang ?? 'en'}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    {merchant?.favicon && <link rel="icon" href={merchant.favicon} />}
    <title>{title}</title>
    {description && <meta name="description" content={description} />}
    <link rel="preconnect" href={import.meta.env.PUBLIC_API_BASE_URL} />
    {themeCSS && <style set:html={`:root { ${themeCSS} }`} />}
    <slot name="head" />
  </head>
  <body>
    <slot />
  </body>
</html>
```

**Step 2: Create 404 page** (`src/pages/404.astro`)

Branded page with Sous branding for unknown merchants. Does NOT use BaseLayout (no merchant context). Simple, self-contained page with inline styles.

**Step 3: Verify build**

```bash
pnpm astro build
```

**Step 4: Commit**

```bash
git add src/layouts/BaseLayout.astro src/pages/404.astro
git commit -m "feat: add BaseLayout with theme injection and branded 404 page"
```

---

## Phase 6: State Management

### Task 10: Create nanostores

**Files:**

- Create: `src/stores/merchant.ts`
- Create: `src/stores/cart.ts`
- Create: `src/stores/ui.ts`
- Create: `src/stores/auth.ts`

**Step 1: Create all stores**

Reference: design doc section 6 (lines 416-472) for exact shapes.

`merchant.ts` — `$merchant` atom holding `MerchantConfig | null`.

`cart.ts` — `$cart` atom + computed `$itemCount` and `$cartTotal`. Include persistence logic (localStorage for `cartId`).

`ui.ts` — `$activeCategory`, `$isCartOpen`, `$isCategoryDrawerOpen`, `$selectedProduct` atoms.

`auth.ts` — `$isAuthenticated` boolean, `$customerId` string. Comment: "JWT never exposed to client-side JS."

**Step 2: Commit**

```bash
git add src/stores/
git commit -m "feat: add nanostores for merchant, cart, UI, and auth state"
```

---

## Phase 7: API Client

### Task 11: Create SDK client factories

**Files:**

- Create: `src/lib/api.ts`

**Step 1: Create API client** (`src/lib/api.ts`)

Two patterns:

1. **Server-side** (created in middleware, stored in `Astro.locals.sdk`):

   ```typescript
   createStorefrontClient({ baseUrl, vendorId, language, token });
   ```

2. **Client-side** (singleton for browser, `getClient()`):
   ```typescript
   createStorefrontClient({
     baseUrl: import.meta.env.PUBLIC_API_BASE_URL,
     vendorId: merchant.merchantId,
     language: document.documentElement.lang,
     fetch: (url, init) => globalThis.fetch(url, { ...init, credentials: 'include' }),
   });
   ```

Note: The SDK accepts a custom `fetch` function (not `fetchOptions`). To send httpOnly auth cookies, wrap `globalThis.fetch` with `credentials: 'include'`.

**Cross-origin auth requirements (Phase 0 Gate 4):**

Client-side SDK calls go from `{merchant}.poweredbysous.com` to `api.poweredbysous.com`. These are **cross-origin** (different subdomain), so the backend must be configured correctly. The exact required settings must be confirmed with the backend team before Phase 15 (checkout):

1. **CORS origin:** The backend must echo the requesting origin exactly in `Access-Control-Allow-Origin` (e.g., `https://bar-sumac.poweredbysous.com`). A wildcard `*` is **not valid** when `Access-Control-Allow-Credentials: true` is set — the CORS spec forbids it. The backend needs an origin allowlist or a dynamic echo-back of `*.poweredbysous.com` origins.
2. **Credentials header:** `Access-Control-Allow-Credentials: true` must be set on every response, including preflight (`OPTIONS`).
3. **Cookie domain:** Auth cookies set by the API must use `Domain=.poweredbysous.com` (leading dot) so browsers send them to both `api.poweredbysous.com` and `*.poweredbysous.com` subdomains.
4. **SameSite:** All subdomains of `poweredbysous.com` are **same-site** (eTLD+1 is `poweredbysous.com`), so `SameSite=Lax` works for all HTTP methods, including POST/PATCH. `SameSite=None; Secure` is only needed if the API were on a completely different registrable domain.
5. **CSRF:** Confirm whether Django's CSRF middleware is active for API routes. If yes, the SDK's custom `fetch` wrapper must read the `csrftoken` cookie and send it as an `X-CSRFToken` header. If API routes are CSRF-exempt (common for token-authenticated APIs), document that explicitly.

**Action:** These must be confirmed in Phase 0 Gate 4 (defined above in Phase 0). Without them, client-side authenticated requests will silently fail. Gates 4-7 can be resolved in parallel with Phases 1-14 but must be complete before Phase 15 begins.

Reference: design doc section 7.1 (lines 486-527), SDK client options (`baseUrl`, `vendorId`, `language`, `token`, `fetch`, `headers`).

**Step 2: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add SDK client factories for server and client"
```

---

## Phase 8: i18n

### Task 12: Set up Paraglide.js

**Files:**

- Create: `src/i18n/messages/nl.json`
- Create: `src/i18n/messages/en.json`
- Create: `src/i18n/messages/de.json`
- Create: `project.inlang/settings.json`

**Step 1: Install Paraglide**

```bash
pnpm add @inlang/paraglide-js
```

**Step 2: Create inlang project settings** (`project.inlang/settings.json`)

```json
{
  "$schema": "https://inlang.com/schema/project-settings",
  "sourceLanguageTag": "nl",
  "languageTags": ["nl", "en", "de"],
  "modules": [],
  "plugin.inlang.messageFormat": {
    "pathPattern": "./src/i18n/messages/{languageTag}.json"
  }
}
```

**Step 3: Create initial message files**

Start with essential UI strings only (buttons, labels). More will be added per-feature:

```json
// nl.json
{
  "addToCart": "Toevoegen",
  "soldOut": "Uitverkocht",
  "cart": "Winkelwagen",
  "checkout": "Afrekenen",
  "items": "{count, plural, one {# item} other {# items}}",
  "close": "Sluiten",
  "search": "Zoeken",
  "required": "Verplicht",
  "remove": "Verwijderen",
  "notes": "Notitie toevoegen"
}
```

Create equivalent `en.json` and `de.json` files.

**Step 4: Update Astro config to add Paraglide integration**

**Step 5: Commit**

```bash
git add src/i18n/ project.inlang/
git commit -m "feat: set up Paraglide.js i18n with NL/EN/DE translations"
```

---

## Phase 9: Static Components (Astro — Zero JS)

### Task 13: Header and Footer

**Files:**

- Create: `src/components/astro/Header.astro`
- Create: `src/components/astro/Footer.astro`

Reference: design doc section 5.1 — both are static Astro components, zero JS.

**Header:** Merchant logo, name, optional search trigger, cart button (just the button — CartDrawer is a Preact island).

**Footer:** Merchant contact info, social links, hours, "Powered by Sous" link, legal links.

Accept `merchant: MerchantConfig` and `lang: string` as props from page.

**Commit:**

```bash
git add src/components/astro/Header.astro src/components/astro/Footer.astro
git commit -m "feat: add Header and Footer static components"
```

---

### Task 14: HeroSection

**Files:**

- Create: `src/components/astro/HeroSection.astro`

Reference: design doc section 5.3 — Cover image with overlapping logo, restaurant name, description, location, hours. Port from prototype's `restaurant-hero.tsx`.

Key details:

- Hero image preloaded in `<head>` via `<link rel="preload">`
- Logo overlaps the cover image (negative margin or absolute position)
- Responsive: full-bleed on mobile, constrained on desktop
- Uses `card-image` background token for image placeholder

**Commit:**

```bash
git add src/components/astro/HeroSection.astro
git commit -m "feat: add HeroSection component with cover image and merchant info"
```

---

### Task 15: ProductCard (grid + list variants) and PromoBadge

**Files:**

- Create: `src/components/astro/ProductCard.astro`
- Create: `src/components/astro/ProductGrid.astro`
- Create: `src/components/astro/ProductList.astro`
- Create: `src/components/astro/PromoBadge.astro`
- Create: `src/components/astro/MenuSection.astro`

Reference: design doc section 5.3 (lines 380-412).

**ProductCard:** Static markup wrapping an `<AddToCartButton>` Preact island. Two layout modes:

- Grid: column layout, full-width square image, title, description, price, button
- List (row): 104px fixed image left, content right

Both use `lazy` loading for images, `card-image` background placeholder.

**PromoBadge:** Renders discount label (e.g., "-15%", "Buy 1 Get 1 Free") using `getDiscountLabel()` from pricing engine.

**MenuSection:** Category heading + product grid/list. Uses `merchant.layout` to select variant.

**ProductGrid/ProductList:** Grid/list wrappers that render `ProductCard` in the correct layout.

**Commit:**

```bash
git add src/components/astro/ProductCard.astro src/components/astro/ProductGrid.astro src/components/astro/ProductList.astro src/components/astro/PromoBadge.astro src/components/astro/MenuSection.astro
git commit -m "feat: add ProductCard, MenuSection, and PromoBadge static components"
```

---

### Task 16: SEOHead and StructuredData

**Files:**

- Create: `src/components/astro/SEOHead.astro`
- Create: `src/components/astro/StructuredData.astro`
- Create: `src/lib/structured-data.ts`
- Create: `src/lib/structured-data.test.ts`

**Step 1: Write tests for structured data generators** (`src/lib/structured-data.test.ts`)

Test JSON-LD output for `generateRestaurantLD()`, `generateMenuItemLD()`, `generateBreadcrumbLD()`.

Reference: design doc section 11.3-11.4 (lines 824-839).

**Step 2: Implement** (`src/lib/structured-data.ts`)

Functions that return JSON-LD objects matching Schema.org types:

- `generateRestaurantLD(merchant)` → `Restaurant` with `Menu`, `MenuSection[]`, `MenuItem[]`
- `generateMenuItemLD(product, merchant)` → `MenuItem` + `Offer`
- `generateBreadcrumbLD(items)` → `BreadcrumbList`

**Step 3: Create SEOHead.astro**

Uses `astro-seo` to consolidate `<head>` tags. Reference design doc section 11.2 (lines 812-822):

- Title with merchant's `titleTemplate`
- Meta description
- Canonical URL
- OpenGraph + Twitter card
- `hreflang` for all language variants + `x-default`
- `robots` noindex for cart/checkout/orders

**Step 4: Create StructuredData.astro**

Renders JSON-LD `<script type="application/ld+json">` blocks.

**Step 5: Run tests, commit**

```bash
git add src/components/astro/SEOHead.astro src/components/astro/StructuredData.astro src/lib/structured-data.ts src/lib/structured-data.test.ts
git commit -m "feat: add SEO head, structured data components and JSON-LD generators"
```

---

## Phase 10: Menu Page (Critical Path)

### Task 17: Menu page

**Files:**

- Create: `src/pages/[lang]/index.astro`

This is the most important page — the entry point for every merchant storefront.

**Step 1: Create `fetchAllProducts` helper** (`src/lib/fetch-all.ts`)

The products API is cursor-paginated. Server-side pages must fetch all pages to build the full menu. This runs only at SSR time (not in the browser), so latency is acceptable.

```typescript
import type { paths } from '@sous/storefront-sdk';

// The SDK's typed GET only accepts known path literals, so we can't pass
// arbitrary `next` URLs to sdk.GET(). Instead, use the SDK for the first
// page (typed) and raw fetch for subsequent pages (the `next` URL is a
// full absolute URL from the API response).

type SDK = ReturnType<typeof import('@sous/storefront-sdk').createStorefrontClient>;

// Extract the product type from the SDK's typed response
type ProductListResponse =
  paths['/api/v1/products/']['get']['responses']['200']['content']['application/json'];
type Product = ProductListResponse['results'][number];

interface FetchAllOptions {
  vendorId: string;
  language: string;
}

export async function fetchAllProducts(sdk: SDK, opts: FetchAllOptions): Promise<Product[]> {
  // First page: use typed SDK call (handles headers automatically)
  const { data } = await sdk.GET('/api/v1/products/');
  if (!data) return [];

  const all: Product[] = [...(data.results ?? [])];
  let nextUrl: string | null = data.next ?? null;

  // Subsequent pages: follow `next` URLs with raw fetch.
  // Guards: res.ok check, seen-URL loop detection, hard page cap.
  const MAX_PAGES = 50;
  const seen = new Set<string>();
  let pageCount = 1;

  while (nextUrl) {
    if (seen.has(nextUrl)) {
      console.error('fetchAllProducts: circular next URL detected, stopping');
      break;
    }
    if (++pageCount > MAX_PAGES) {
      console.error(`fetchAllProducts: exceeded ${MAX_PAGES} page limit, stopping`);
      break;
    }
    seen.add(nextUrl);

    const res = await fetch(nextUrl, {
      headers: {
        'X-Vendor-ID': opts.vendorId,
        'Accept-Language': opts.language,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      console.error(
        `fetchAllProducts: page fetch failed (${res.status}), returning partial results`,
      );
      break;
    }

    const page = (await res.json()) as ProductListResponse;
    all.push(...(page.results ?? []));
    nextUrl = page.next ?? null;
  }

  return all;
}
```

Caller in `.astro` frontmatter passes values from `Astro.locals`:

```typescript
const products = await fetchAllProducts(sdk, {
  vendorId: merchant.merchantId,
  language: lang,
});
```

Add a unit test that verifies cursor following with a mock fetch (returns 2 pages then `next: null`).

**Step 2: Create menu page** (`src/pages/[lang]/index.astro`)

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import Header from '@/components/astro/Header.astro';
import HeroSection from '@/components/astro/HeroSection.astro';
import MenuSection from '@/components/astro/MenuSection.astro';
import Footer from '@/components/astro/Footer.astro';
import SEOHead from '@/components/astro/SEOHead.astro';
import StructuredData from '@/components/astro/StructuredData.astro';
import { fetchAllProducts } from '@/lib/fetch-all';

const { merchant, lang, sdk } = Astro.locals;
const { data: categories } = await sdk.GET('/api/v1/categories/');
const products = await fetchAllProducts(sdk);

// Group products by category, preserving category order
const sections =
  categories?.results?.map((cat) => ({
    category: cat,
    products: products.filter((p) => p.category_id === cat.id),
  })) ?? [];
---

<BaseLayout title={merchant.name} description={merchant.seo.defaultDescription}>
  <SEOHead slot="head" page="menu" merchant={merchant} lang={lang} />
  <StructuredData slot="head" type="restaurant" merchant={merchant} sections={sections} />
  <Header merchant={merchant} lang={lang} />
  <HeroSection merchant={merchant} />
  <!-- CategoryTabs Preact island: client:load -->
  {
    sections.map((s) => (
      <MenuSection category={s.category} products={s.products} merchant={merchant} lang={lang} />
    ))
  }
  <!-- CartBar, CartDrawer, ProductDetail: client:load -->
  <!-- FreshnessProvider: client:idle -->
  <Footer merchant={merchant} lang={lang} />
</BaseLayout>
```

Islands will be wired up in Phase 11 (Interactive Islands).

**Step 2: Verify build**

```bash
pnpm astro build
```

**Step 3: Commit**

```bash
git add src/pages/\[lang\]/index.astro
git commit -m "feat: add menu page with category sections and SSR data fetching"
```

---

### Task 18: Category and Product detail pages

**Files:**

- Create: `src/pages/[lang]/category/[slug].astro`
- Create: `src/pages/[lang]/product/[slug].astro`

**Category page:** Filters products by category slug. Reuses MenuSection and ProductGrid.

**Product detail page:** Full product detail view (for direct URL access / SEO). Slug→ID resolution strategy (chosen in Phase 0 Gate 3):

- **If API supports `?slug={slug}`:** Fetch directly in frontmatter:
  ```typescript
  const { data } = await sdk.GET('/api/v1/products/', {
    params: { query: { slug: Astro.params.slug } },
  });
  const product = data?.results?.[0];
  if (!product) return Astro.redirect('/404');
  ```
- **If slug is not supported:** Products include both `id` and `slug` in list results. Build a slug→id lookup from the category page's product list (passed via query param or fetched):
  ```typescript
  const products = await fetchAllProducts(sdk);
  const product = products.find((p) => p.slug === Astro.params.slug);
  if (!product) return Astro.redirect('/404');
  // Fetch full detail with modifiers using the resolved ID
  const { data: detail } = await sdk.GET('/api/v1/products/{id}/', {
    params: { path: { id: product.id } },
  });
  ```

Both pages include SEOHead + StructuredData (BreadcrumbList + relevant schema).

**Commit:**

```bash
git add src/pages/\[lang\]/category/ src/pages/\[lang\]/product/
git commit -m "feat: add category and product detail pages"
```

---

## Phase 11: Interactive Islands (Preact)

### Task 19: CategoryTabs

**Files:**

- Create: `src/components/interactive/CategoryTabs.tsx`

Reference: design doc section 5.3 (lines 387-390) and prototype `category-nav.tsx`.

Key behaviors:

- Horizontal scrollable tab bar
- Animated sliding pill indicator (CSS transform based on active tab position)
- Scroll-based active category tracking via IntersectionObserver on `MenuSection` headings
- When tabs overflow viewport: show list icon that opens category drawer (uses `$isCategoryDrawerOpen` store)
- Updates `$activeCategory` store on tab click/scroll
- Tab click smooth-scrolls to the category section

ARIA: `role="tablist"` + `role="tab"` + `aria-selected` + arrow key navigation.

Hydration: `client:load` (needs JS immediately).

**Commit:**

```bash
git add src/components/interactive/CategoryTabs.tsx
git commit -m "feat: add CategoryTabs island with scroll tracking and animated indicator"
```

---

### Task 20: QuantitySelector, AnimatedNumber, and ConfirmRemoveDialog

**Files:**

- Create: `src/components/interactive/QuantitySelector.tsx`
- Create: `src/components/interactive/AnimatedNumber.tsx`
- Create: `src/components/interactive/ConfirmRemoveDialog.tsx`

**QuantitySelector:** +/- buttons wrapping an AnimatedNumber display. When quantity is 1, minus becomes trash icon. Clicking trash opens ConfirmRemoveDialog. Touch target min 44px.

**AnimatedNumber:** Digit transition animation (slide up/down on change). Respects `prefers-reduced-motion`.

**ConfirmRemoveDialog:** Small `role="alertdialog"` confirmation. "Remove item?" with Cancel and Remove buttons. Focus-trapped.

These are shared building blocks used by AddToCartButton, CartDrawer, and ProductDetail.

**Commit:**

```bash
git add src/components/interactive/QuantitySelector.tsx src/components/interactive/AnimatedNumber.tsx src/components/interactive/ConfirmRemoveDialog.tsx
git commit -m "feat: add QuantitySelector, AnimatedNumber, and ConfirmRemoveDialog islands"
```

---

### Task 21: AddToCartButton

**Files:**

- Create: `src/components/interactive/AddToCartButton.tsx`

Reference: design doc section 5.3 (lines 381-385).

Key behaviors:

- Simple items (no modifiers): tap "Add" → instant add to cart via API, show quantity stepper
- Complex items (has modifiers): tap "Add" → opens ProductDetail modal (sets `$selectedProduct`)
- After first add: stepper mode (quantity count shown, expands to full stepper on hover/tap)
- Auto-collapses stepper to just count badge after 3 seconds of inactivity
- Optimistic UI: update `$cart` store immediately, revert on API error

Uses: `$cart` store, `$selectedProduct` store, `getClient()` for API calls.

Hydration: `client:visible` (hydrate when card scrolls into view).

**Commit:**

```bash
git add src/components/interactive/AddToCartButton.tsx
git commit -m "feat: add AddToCartButton island with quick-add and stepper modes"
```

---

### Task 22: CartBar and CartDrawer

**Files:**

- Create: `src/components/interactive/CartBar.tsx`
- Create: `src/components/interactive/CartDrawer.tsx`

**CartBar (mobile):** Port from prototype's `mobile-cart-bar.tsx`. Dark bottom bar (`#1C1C1E`), shows "Cart . N items" + total, `safe-area-inset-bottom`, hides when cart empty / cart drawer open / category drawer open. Tapping opens CartDrawer.

Hydration: `client:load`.

**CartDrawer:** Bottom sheet (mobile) / popover (desktop). Shows line items with: image, name, selected modifiers (truncated), discount badge, price (strikethrough if discounted), quantity stepper. "You save" total when discounts active. "Next: Checkout" CTA.

ARIA: `role="dialog"`, `aria-modal="true"`, focus trap, Escape to close.

Uses: `$cart`, `$isCartOpen`, `$itemCount`, `$cartTotal` stores.

Hydration: `client:load`.

**Commit:**

```bash
git add src/components/interactive/CartBar.tsx src/components/interactive/CartDrawer.tsx
git commit -m "feat: add CartBar and CartDrawer islands"
```

---

### Task 23: ProductDetail modal

**Files:**

- Create: `src/components/interactive/ProductDetail.tsx`

Reference: design doc section 5.3 (lines 392-399).

The most complex interactive component. Key behaviors:

- Bottom sheet on mobile (slides up), centered dialog on desktop (scales in)
- Modifier groups: `radio` (pick 1), `checkbox` (pick up to N), `quantity` (+/- per option)
- Required groups: "Required" badge, green checkmark when filled
- Unfilled required groups: shake animation on submit attempt, auto-scroll to first unfilled
- Cross-sells section: "Frequently combined with" with quantity steppers
- Notes field: expandable textarea
- Sticky bottom CTA: quantity stepper + "Add to order . EUR XX,XX" button with live price

Uses: `getLineTotal()`, `getLineSavings()` from pricing engine, `formatPrice()` from currency, `$cart` store, `getClient()` for API.

ARIA: `role="dialog"`, `aria-modal="true"`, focus trap, Escape to close.

Hydration: `client:load`.

**Commit:**

```bash
git add src/components/interactive/ProductDetail.tsx
git commit -m "feat: add ProductDetail modal island with modifiers and cross-sells"
```

---

### Task 24: SearchBar

**Files:**

- Create: `src/components/interactive/SearchBar.tsx`

Product search with autocomplete. Calls `GET /api/v1/products/search/` with debounced input. Renders results as a dropdown. Click navigates to product detail or opens modal.

Hydration: `client:idle`.

**Commit:**

```bash
git add src/components/interactive/SearchBar.tsx
git commit -m "feat: add SearchBar island with product search"
```

---

### Task 25: FreshnessProvider

**Files:**

- Create: `src/components/interactive/FreshnessProvider.tsx`

Reference: design doc section 2.4 (lines 92-108).

Background data refresh island. On mount:

1. Fetches fresh product data from API
2. Compares `sold_out`, `is_available`, `price`, `compare_at_price` against SSR-rendered data
3. Patches volatile fields silently (no loading indicators)
4. Re-polls every 5 minutes for long sessions

Hydration: `client:idle` (non-urgent, runs after main thread idle).

**Commit:**

```bash
git add src/components/interactive/FreshnessProvider.tsx
git commit -m "feat: add FreshnessProvider island for background data refresh"
```

---

### Task 26: Wire up islands in menu page

**Files:**

- Modify: `src/pages/[lang]/index.astro`

Add all Preact island imports with correct hydration directives:

- `<CategoryTabs client:load categories={...} />`
- `<CartBar client:load />`
- `<CartDrawer client:load />`
- `<ProductDetail client:load />`
- `<FreshnessProvider client:idle productIds={...} />`
- `<AddToCartButton client:visible />` inside each ProductCard

Also inject merchant config into `$merchant` store via an inline `<script>`:

```html
<script define:vars={{ merchantJSON: JSON.stringify(merchant) }}>
  // Hydrate merchant store for Preact islands
  window.__MERCHANT__ = JSON.parse(merchantJSON);
</script>
```

And in the store initialization, read from `window.__MERCHANT__`.

**Commit:**

```bash
git add src/pages/\[lang\]/index.astro
git commit -m "feat: wire up all Preact islands in menu page"
```

---

## Phase 12: Analytics

### Task 27: PostHog analytics integration

**Files:**

- Create: `src/analytics/types.ts`
- Create: `src/analytics/events.ts`
- Create: `src/analytics/context.ts`
- Create: `src/analytics/snapshots.ts`
- Create: `src/analytics/pii-guard.ts`
- Create: `src/analytics/pii-guard.test.ts`
- Create: `src/analytics/posthog.ts`
- Create: `src/analytics/index.ts`

Reference: design doc section 10 (lines 724-801).

**Step 1: Write PII guard tests** (`src/analytics/pii-guard.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { stripPII } from './pii-guard';

describe('stripPII', () => {
  it('strips email field', () => {
    const result = stripPII({ email: 'test@test.com', merchant_id: 'foo' });
    expect(result.email).toBeUndefined();
    expect(result.merchant_id).toBe('foo');
  });

  it('strips phone field', () => {
    expect(stripPII({ phone: '+31612345678' }).phone).toBeUndefined();
  });

  it('truncates postal_code to prefix', () => {
    expect(stripPII({ postal_code: '1015CJ' }).postal_code).toBe('1015');
  });

  it('passes allowed fields through', () => {
    const input = { merchant_id: 'x', cart_total: '50.00', currency: 'EUR' };
    expect(stripPII(input)).toEqual(input);
  });
});
```

**Step 2: Implement PII guard, run tests**

**Step 3: Create remaining analytics files**

- `types.ts` — TypeScript types for all 31 events and property layers
- `events.ts` — Event name constants
- `context.ts` — `getCoreProperties()`, session management, UTM tracking
- `snapshots.ts` — `getCartSnapshot()`, `getFulfilmentSnapshot()` (read from nanostores)
- `posthog.ts` — PostHog client init (async loading with stub queue)
- `index.ts` — Public API: `capture()`, `identify()`, `setContext()` per design doc section 10.3

**Step 4: Add analytics stub to BaseLayout**

Add the inline PostHog stub (~200 bytes) to `BaseLayout.astro` `<head>`. The stub is a plain array — `capture()` pushes `[eventName, props]` tuples onto it. When the real SDK loads, it drains the queue.

```html
<script is:inline>
  // Queue-based stub: events are pushed as arrays, NOT via a method override.
  // The real PostHog SDK replaces this array and replays queued calls on init.
  !(function () {
    var p = (window.posthog = window.posthog || []);
    if (!p.__loaded) {
      p._i = [];
      p.init = function (k, o) {
        p._i.push([k, o]);
      };
      p.capture = function () {
        p.push(Array.prototype.slice.call(arguments));
      };
      p.identify = function () {
        p.push(['$identify'].concat(Array.prototype.slice.call(arguments)));
      };
    }
  })();
</script>
```

**Do NOT use `posthog.push = function() { posthog.push(arguments) }`** — that creates infinite recursion.

**Step 5: Commit**

```bash
git add src/analytics/
git commit -m "feat: add PostHog analytics with 31 events, PII guard, and async loading"
```

---

## Phase 13: SEO Endpoints

### Task 28: Sitemap and robots.txt

**Files:**

- Create: `src/pages/sitemap.xml.ts`
- Create: `src/pages/robots.txt.ts`

**sitemap.xml.ts:** SSR endpoint that:

- Reads merchant from `Astro.locals`
- Fetches all products, categories, CMS pages via SDK
- Generates XML sitemap with `<xhtml:link>` for language alternates
- Sets `Cache-Control: public, s-maxage=3600`

**robots.txt.ts:** SSR endpoint that generates per-merchant robots.txt.
Reference: design doc section 11.5 (lines 843-852).

**Commit:**

```bash
git add src/pages/sitemap.xml.ts src/pages/robots.txt.ts
git commit -m "feat: add dynamic sitemap.xml and robots.txt endpoints"
```

---

## Phase 14: Cart and CMS Pages

### Task 29: Cart page and CMS pages

**Files:**

- Create: `src/pages/[lang]/cart.astro`
- Create: `src/pages/[lang]/pages/[slug].astro`

**Cart page:** Full-page cart view. Server-rendered layout with CartDrawer island inlined (opened by default on this page).

**CMS page:** Fetches page content via `GET /api/v1/pages/{slug}/`, renders HTML content. Cached with `s-maxage=3600, stale-while-revalidate=86400`.

**Commit:**

```bash
git add src/pages/\[lang\]/cart.astro src/pages/\[lang\]/pages/
git commit -m "feat: add cart page and CMS pages"
```

---

## Phase 15: Checkout (Requires Gates 5, 6, 7)

### Task 30: Checkout flow

**Files:**

- Create: `src/components/interactive/CheckoutFlow.tsx`
- Create: `src/components/interactive/AddressForm.tsx`
- Create: `src/pages/[lang]/checkout.astro`

**BLOCKER:** Requires Phase 0 gates:

- Gate 5: Customer auth flow readiness (Keycloak OTP)
- Gate 6: PostcodeAPI provider chosen
- Gate 7: Fulfilment location IDs confirmed

**CheckoutFlow.tsx:** Multi-step form island. Steps:

1. Fulfilment mode (delivery/pickup)
2. Delivery info (address, time slot)
3. Payment method selection
4. Review + pay

Key reliability features (design doc section 7.2, lines 558-581):

- Duplicate submit prevention (`submittingRef`)
- Idempotency keys on payment/complete calls
- Retry with exponential backoff for 502/503/504
- Payment redirect recovery

**AddressForm.tsx:** Dutch postcode autofill (4 digits + 2 letters + house number → street + city).

**Checkout page:** SSR, no cache. Loads CheckoutFlow island with `client:load`.

**Commit:**

```bash
git add src/components/interactive/CheckoutFlow.tsx src/components/interactive/AddressForm.tsx src/pages/\[lang\]/checkout.astro
git commit -m "feat: add checkout flow with address autofill and payment reliability"
```

---

## Phase 16: Auth Routes

### Task 31: Auth API routes

**Files:**

- Create: `src/pages/[lang]/login.astro` — user-facing login page (OTP entry form)
- Create: `src/components/interactive/LoginFlow.tsx` — Preact island for OTP request/verify
- Create: `src/pages/api/auth/request-otp.ts` — API route: proxy OTP request to backend
- Create: `src/pages/api/auth/verify-otp.ts` — API route: verify OTP, receive JWT, set httpOnly cookie
- Create: `src/pages/api/auth/refresh.ts` — API route: refresh JWT cookie
- Create: `src/pages/api/auth/logout.ts` — API route: clear httpOnly cookie

**BLOCKER:** Requires Phase 0 Gates 4+5 (auth contract + Keycloak readiness).

**Login page** (`/:lang/login`): User-facing page that middleware redirects to when an authenticated route is accessed without an auth cookie. Accepts a `?redirect=` query param to return users to their original destination after login. SEO: `noindex`.

**LoginFlow.tsx** (Preact island, `client:load`): Two-step form:

1. Enter phone number → calls `POST /api/auth/request-otp`
2. Enter OTP code → calls `POST /api/auth/verify-otp` → on success, redirects to `?redirect` param or `/:lang/`

**API routes** (server-side only):

- **request-otp:** Proxies to `POST /api/v1/auth/otp/request/` on backend
- **verify-otp:** Proxies to `POST /api/v1/auth/otp/verify/`, receives JWT, sets httpOnly cookie with **env-driven attributes**:
  ```
  # .env.example
  AUTH_COOKIE_DOMAIN=.poweredbysous.com   # production
  # AUTH_COOKIE_DOMAIN=.poweredbysous.localhost  # local dev
  AUTH_COOKIE_SECURE=true                 # false for localhost (no HTTPS)
  ```
  Cookie: `httpOnly; Secure=${AUTH_COOKIE_SECURE}; SameSite=Lax; Domain=${AUTH_COOKIE_DOMAIN}`
- **refresh:** Reads httpOnly cookie, calls `POST /api/v1/auth/token/refresh/`, sets new cookie
- **logout:** Clears the httpOnly cookie

Reference: design doc section 6.4 (lines 474-480).

**Phase 16 commit** (see commit strategy table above) stages all auth files:
`src/pages/[lang]/login.astro`, `src/components/interactive/LoginFlow.tsx`, `src/pages/api/auth/*`

---

## Phase 17: Orders

### Task 32: Order history and detail pages

**Files:**

- Create: `src/components/interactive/OrderHistory.tsx`
- Create: `src/pages/[lang]/orders/index.astro`
- Create: `src/pages/[lang]/orders/[number].astro`

**BLOCKER:** Requires auth (Task 31).

**OrderHistory.tsx:** Preact island showing order list with reorder button. Uses `GET /api/v1/orders/` (cursor-paginated). Reorder calls `POST /api/v1/orders/{number}/reorder/`.

**Order pages:** Authenticated SSR pages. Page frontmatter checks for auth cookie; if absent, redirect to `/${lang}/login?redirect=${encodeURIComponent(Astro.url.pathname)}`. `robots` noindex.

**Commit:**

```bash
git add src/components/interactive/OrderHistory.tsx src/pages/\[lang\]/orders/
git commit -m "feat: add order history and detail pages"
```

---

## Phase 18: Group Orders

### Task 33: Group order page

**Files:**

- Create: `src/components/interactive/GroupOrderPanel.tsx`
- Create: `src/pages/[lang]/group/[joinCode].astro`

**GroupOrderPanel.tsx:** Preact island for group order management. Create group, share join code, view participants' carts, close group and proceed to checkout.

API: `POST /api/v1/group-orders/`, `GET/POST /api/v1/group-orders/{join_code}/`, etc.

**Group page:** SSR page with GroupOrderPanel island. No cache.

**Commit:**

```bash
git add src/components/interactive/GroupOrderPanel.tsx src/pages/\[lang\]/group/
git commit -m "feat: add group order page and panel"
```

---

## Phase 19: Performance & Accessibility Polish

### Task 34: Bundle size CI check

**Files:**

- Create: `.github/workflows/bundle-size.yml` (or add to existing CI)
- Modify: `package.json` (add `size-limit` config)

**Step 1: Install size-limit**

```bash
pnpm add -D size-limit @size-limit/file
```

**Step 2: Add size-limit config to package.json**

Bundle size is hard to check reliably with `size-limit` alone because Astro/Vite chunk graphs don't cleanly separate "blocking" from "async" JS by file path. Instead, use a two-pronged approach:

**Approach A: Lighthouse CI budget (reliable, measures real loading)**

Add a Lighthouse CI budget file (`lighthouserc.json`) that measures actual transfer size per resource type on the menu page:

```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:4321/nl/"],
      "settings": { "preset": "perf", "throttling": { "cpuSlowdownMultiplier": 4 } }
    },
    "assert": {
      "assertions": {
        "resource-summary:script:size": ["error", { "maxNumericValue": 65000 }],
        "total-blocking-time": ["error", { "maxNumericValue": 300 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }]
      }
    }
  }
}
```

This catches real critical-path regressions because Lighthouse measures what actually blocks rendering, not what lives in a directory.

**Approach B: Total JS guard (simple, catches large regressions)**

```json
{
  "size-limit": [
    {
      "name": "Total client JS (all chunks)",
      "path": "dist/client/**/*.js",
      "limit": "65 KB",
      "gzip": true
    }
  ]
}
```

This is a coarse ceiling. If it trips, investigate with `pnpm astro build --verbose` and Lighthouse to find which chunks grew.

**Step 3: Add npm scripts**

```json
{
  "scripts": {
    "size": "size-limit",
    "size:check": "size-limit --limit"
  }
}
```

**Files created in this task:** `lighthouserc.json`, `package.json` (modified with size-limit config + scripts). Both staged as part of the Phase 19 commit (see commit strategy table).

---

### Task 35: Accessibility review pass

**Files:**

- Modify: All interactive components as needed

Verify:

- [ ] All interactive elements have min 44px touch targets (`min-h-11 min-w-11`)
- [ ] Category tabs: arrow key navigation, `aria-selected`, `tabindex` management
- [ ] Cart drawer: focus trap, Escape to close, `role="dialog"`, `aria-modal="true"`
- [ ] Product modal: focus trap, Escape to close, `role="dialog"`, `aria-modal="true"`
- [ ] Cart updates: `aria-live="polite"` region
- [ ] Sold out items: `aria-disabled="true"`
- [ ] Confirm remove: `role="alertdialog"`
- [ ] All animations respect `prefers-reduced-motion`
- [ ] Theme contrast validation in `theme.ts` (warn if < 4.5:1 AA)

Reference: design doc section 13 (lines 928-967).

**Commit:**

```bash
git commit -am "fix: accessibility review pass — ARIA, focus traps, touch targets"
```

---

### Task 35b: Integration tests for critical flows

**Files:**

- Create: `src/lib/resolve-merchant.integration.test.ts`
- Create: `src/stores/cart.integration.test.ts`
- Create: `src/middleware.integration.test.ts`

The unit tests in Phase 2 cover pure functions. These integration tests cover **behavioral flows** that cross module boundaries.

**Middleware integration tests** (`src/middleware.integration.test.ts`):

Test the full `onRequest` handler with a mock `next()`:

- Unknown merchant slug → returns rewritten 404 response
- Valid merchant, no lang prefix → redirects to `/{defaultLang}{originalPath}{query}`
- Valid merchant, invalid lang → redirects preserving path
- Valid merchant, valid lang → injects `locals.merchant`, `locals.lang`, `locals.sdk`
- Cacheable route without auth → sets `Cache-Control: public, s-maxage=...`
- Cacheable route with auth cookie → sets `Cache-Control: private, no-store`
- Non-cacheable route → no cache header added

```typescript
import { describe, it, expect, vi } from 'vitest';
import { onRequest } from '@/middleware';

function makeContext(url: string, overrides = {}) {
  return {
    request: new Request(url),
    locals: {} as any,
    redirect: vi.fn(
      (path: string) => new Response(null, { status: 302, headers: { Location: path } }),
    ),
    rewrite: vi.fn((path: string) => new Response(`rewritten:${path}`, { status: 404 })),
    ...overrides,
  };
}

describe('middleware', () => {
  it('rewrites to /404 for unknown merchant', async () => {
    const ctx = makeContext('https://nonexistent.poweredbysous.com/nl/');
    await onRequest(ctx, async () => new Response('ok'));
    expect(ctx.rewrite).toHaveBeenCalledWith('/404');
  });

  it('redirects bare path to default language, preserving path+query', async () => {
    const ctx = makeContext('https://bar-sumac.poweredbysous.com/product/falafel?ref=share');
    const response = await onRequest(ctx, async () => new Response('ok'));
    expect(ctx.redirect).toHaveBeenCalledWith('/nl/product/falafel?ref=share');
  });
  // ... etc
});
```

**Cart store integration tests** (`src/stores/cart.integration.test.ts`):

Test optimistic update → API failure → rollback:

```typescript
describe('cart optimistic rollback', () => {
  it('reverts $cart on API error after optimistic add', async () => {
    // 1. Set initial cart state
    // 2. Mock getClient().POST to reject
    // 3. Call addToCart(product)
    // 4. Assert $cart was optimistically updated
    // 5. Await the API call settling
    // 6. Assert $cart reverted to original state
  });
});
```

**Checkout idempotency test** (placeholder — implement in Phase 15):

```typescript
describe('checkout payment', () => {
  it('sends Idempotency-Key header on payment call', async () => {
    /* ... */
  });
  it('reuses same key on retry after network failure', async () => {
    /* ... */
  });
  it('prevents duplicate submit via submittingRef guard', async () => {
    /* ... */
  });
});
```

**Auth route tests** (placeholder — implement in Phase 16):

```typescript
describe('auth routes', () => {
  it('POST /api/auth/login sets httpOnly cookie on success', async () => {
    /* ... */
  });
  it('POST /api/auth/refresh replaces cookie', async () => {
    /* ... */
  });
  it('POST /api/auth/logout clears cookie', async () => {
    /* ... */
  });
});
```

**Commit (with Phase 19 commit):**

```bash
git add src/**/*.integration.test.ts
```

---

### Task 36: Final integration test

**Step 1: Start dev server**

```bash
DEFAULT_MERCHANT=bar-sumac pnpm astro dev
```

**Step 2: Verify in browser**

Visit `http://bar-sumac.poweredbysous.localhost:4321/nl/` and confirm:

- [ ] Menu page renders with merchant branding
- [ ] Category tabs work (click + scroll tracking)
- [ ] Add to cart works (quick-add + modal for complex items)
- [ ] Cart bar appears on mobile, cart drawer opens
- [ ] Product detail modal works with modifiers
- [ ] Language switching works (`/en/` vs `/nl/`)
- [ ] Unknown subdomain shows branded 404 page
- [ ] SEO tags present in `<head>`
- [ ] JSON-LD structured data present
- [ ] PostHog events fire in browser console

**Step 3: Run Lighthouse**

```bash
pnpm dlx lighthouse http://bar-sumac.poweredbysous.localhost:4321/nl/ --output json --output-path ./lighthouse.json
```

Verify: LCP < 2.0s, INP < 150ms, CLS < 0.1 (on simulated mobile 4G).

**Step 4: Run all tests**

```bash
pnpm vitest run
```

Expected: All tests pass.

---

## Dependency Graph

```
Phase 0 (blockers) ─── HARD GATE ───┐
                                     ▼
Phase 1:  Task 1-2   (scaffold, styles)
Phase 2:  Task 3-6   (types, currency, pricing, theme — TDD)
Phase 3:  Task 7     (merchant config — import.meta.glob)
Phase 4:  Task 8     (middleware + resolve-merchant — TDD)
Phase 5:  Task 9     (layout, 404)
Phase 6:  Task 10    (nanostores)
Phase 7:  Task 11    (API client — confirm CORS/cookie reqs)
Phase 8:  Task 12    (i18n)
Phase 9:  Task 13-16 (static components, SEO/structured data)
Phase 10: Task 17-18 (menu, category, product pages — uses fetchAll)
Phase 11: Task 19-26 (interactive islands)
Phase 12: Task 27    (analytics — correct PostHog stub)
Phase 13: Task 28    (sitemap, robots.txt)
Phase 14: Task 29    (cart page, CMS pages)
Phase 15: Task 30    (checkout) ──── requires Gates 4,5,6,7
Phase 16: Task 31    (auth routes) ─ requires Gates 4,5
Phase 17: Task 32    (orders) ───── requires Task 31
Phase 18: Task 33    (group orders)
Phase 19: Task 34-35b-36 (bundle check, a11y, integration tests, final test)
```

## Verification

### After Phases 1-14 (core storefront, no auth-gated features):

1. **Unit tests:** `pnpm vitest run` — all pass (pricing, currency, theme, PII guard, structured data, resolve-merchant)
2. **Integration tests:** `pnpm vitest run --reporter=verbose` — middleware and cart rollback tests pass
3. **Type check:** `pnpm astro check` — no errors
4. **Build:** `pnpm astro build` — succeeds, output in `dist/`
5. **Bundle size:** `pnpm size:check` — total JS < 65KB gzipped
6. **Dev server:** Menu page renders correctly at `http://bar-sumac.poweredbysous.localhost:4321/nl/`
7. **404:** Unknown subdomain shows branded page
8. **Lighthouse:** Performance score > 90 on menu page

### After Phases 15-19 (checkout, auth, orders — requires Gates 4-7):

9. **Auth integration tests pass:** login sets cookie, refresh replaces it, logout clears it
10. **Checkout integration tests pass:** idempotency key sent, duplicate submit blocked, retry on 502
11. **Login flow:** `/:lang/login` → enter phone → enter OTP → redirected to original page with auth cookie set
12. **Orders page:** accessible when authenticated, redirects to login when not
