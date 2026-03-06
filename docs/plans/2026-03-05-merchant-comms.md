# Merchant Communications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render merchant-created messages (banners, modals, toasts, inline callouts) on the storefront, with dismiss persistence and analytics tracking.

**Architecture:** Server-side fetch of active messages in BaseLayout.astro, passed to a single MerchantComms Preact island that distributes content to surface-specific sub-components via nanostores. Dismiss state persisted in localStorage with expiry. Analytics dual-tracked: lightweight batcher for the backend comms API + PostHog events for funnel data.

**Tech Stack:** Astro 5 SSR, Preact islands, Nanostores, Tailwind CSS, TypeScript, Vitest, Playwright

---

## Phase 1: Foundation (Store + Helpers + i18n)

### Task 1: Add comms types and store

**Files:**

- Create: `src/stores/comms.ts`

**Step 1: Write the failing test**

Create `src/stores/comms.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  $commsMessages,
  $dismissedMessages,
  $topBannerMessages,
  $bottomBannerMessages,
  $modalMessages,
  $toastMessages,
} from './comms';

function makeMessage(overrides = {}) {
  return {
    id: 'msg-1',
    priority: 0,
    dismissible: true,
    dismiss_duration: null,
    contents: [
      {
        id: 'cnt-1',
        surface: 'top_banner',
        headline: 'Test banner',
        body: 'Test body',
        cta_label: '',
        cta_url: '',
        theme: 'info' as const,
        custom_colors: {},
        extra: {},
      },
    ],
    ...overrides,
  };
}

describe('comms store', () => {
  beforeEach(() => {
    $commsMessages.set([]);
    $dismissedMessages.set({});
  });

  it('$topBannerMessages filters by surface', () => {
    $commsMessages.set([makeMessage()]);
    expect($topBannerMessages.get()).toHaveLength(1);
    expect($bottomBannerMessages.get()).toHaveLength(0);
  });

  it('filters out dismissed messages', () => {
    $commsMessages.set([makeMessage()]);
    $dismissedMessages.set({ 'msg-1': Infinity });
    expect($topBannerMessages.get()).toHaveLength(0);
  });

  it('shows message if dismiss has expired', () => {
    $commsMessages.set([makeMessage()]);
    $dismissedMessages.set({ 'msg-1': Date.now() - 1000 });
    expect($topBannerMessages.get()).toHaveLength(1);
  });

  it('returns highest priority first', () => {
    $commsMessages.set([
      makeMessage({
        id: 'low',
        priority: 10,
        contents: [
          {
            id: 'c1',
            surface: 'top_banner',
            headline: 'Low',
            body: '',
            cta_label: '',
            cta_url: '',
            theme: 'info',
            custom_colors: {},
            extra: {},
          },
        ],
      }),
      makeMessage({
        id: 'high',
        priority: 1,
        contents: [
          {
            id: 'c2',
            surface: 'top_banner',
            headline: 'High',
            body: '',
            cta_label: '',
            cta_url: '',
            theme: 'info',
            custom_colors: {},
            extra: {},
          },
        ],
      }),
    ]);
    const msgs = $topBannerMessages.get();
    expect(msgs[0].message.id).toBe('high');
  });

  it('handles multi-surface messages', () => {
    const msg = makeMessage({
      contents: [
        {
          id: 'c1',
          surface: 'top_banner',
          headline: 'Top',
          body: '',
          cta_label: '',
          cta_url: '',
          theme: 'info',
          custom_colors: {},
          extra: {},
        },
        {
          id: 'c2',
          surface: 'modal',
          headline: 'Modal',
          body: '',
          cta_label: '',
          cta_url: '',
          theme: 'info',
          custom_colors: {},
          extra: {},
        },
      ],
    });
    $commsMessages.set([msg]);
    expect($topBannerMessages.get()).toHaveLength(1);
    expect($modalMessages.get()).toHaveLength(1);
    expect($toastMessages.get()).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- src/stores/comms.test.ts`
Expected: FAIL — module `./comms` not found

**Step 3: Write minimal implementation**

Create `src/stores/comms.ts`:

```typescript
import { atom, computed } from 'nanostores';

// ── Types ────────────────────────────────────────────────────────

export type CommsTheme = 'info' | 'success' | 'warning' | 'urgent' | 'promotional';

export interface CommsContent {
  id: string;
  surface: string;
  headline: string;
  body: string;
  cta_label: string;
  cta_url: string;
  theme: CommsTheme;
  custom_colors: Record<string, string>;
  extra: Record<string, unknown>;
}

export interface CommsMessage {
  id: string;
  priority: number;
  dismissible: boolean;
  dismiss_duration: string | null;
  contents: CommsContent[];
}

/** Flattened view: one content piece paired with its parent message. */
export interface SurfaceEntry {
  message: CommsMessage;
  content: CommsContent;
}

// ── Atoms ────────────────────────────────────────────────────────

/** Set from server-side data via MerchantComms island props. */
export const $commsMessages = atom<CommsMessage[]>([]);

/** Dismissed message IDs → expiry timestamp (Infinity = permanent). */
export const $dismissedMessages = atom<Record<string, number>>({});

// ── Helpers ──────────────────────────────────────────────────────

function filterForSurface(
  messages: CommsMessage[],
  dismissed: Record<string, number>,
  surface: string,
): SurfaceEntry[] {
  const now = Date.now();
  const entries: SurfaceEntry[] = [];

  for (const msg of messages) {
    // Skip dismissed (unless expiry has passed)
    const expiry = dismissed[msg.id];
    if (expiry !== undefined && (expiry === Infinity || expiry > now)) continue;

    for (const content of msg.contents) {
      if (content.surface === surface) {
        entries.push({ message: msg, content });
      }
    }
  }

  // Sort by priority (lower = higher priority)
  entries.sort((a, b) => a.message.priority - b.message.priority);
  return entries;
}

// ── Computed stores (one per surface) ────────────────────────────

export const $topBannerMessages = computed(
  [$commsMessages, $dismissedMessages],
  (msgs, dismissed) => filterForSurface(msgs, dismissed, 'top_banner'),
);

export const $bottomBannerMessages = computed(
  [$commsMessages, $dismissedMessages],
  (msgs, dismissed) => filterForSurface(msgs, dismissed, 'bottom_banner'),
);

export const $modalMessages = computed([$commsMessages, $dismissedMessages], (msgs, dismissed) =>
  filterForSurface(msgs, dismissed, 'modal'),
);

export const $toastMessages = computed([$commsMessages, $dismissedMessages], (msgs, dismissed) =>
  filterForSurface(msgs, dismissed, 'toast'),
);

export const $inlineCartMessages = computed(
  [$commsMessages, $dismissedMessages],
  (msgs, dismissed) => filterForSurface(msgs, dismissed, 'inline_cart'),
);

export const $inlineCheckoutMessages = computed(
  [$commsMessages, $dismissedMessages],
  (msgs, dismissed) => filterForSurface(msgs, dismissed, 'inline_checkout'),
);
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- src/stores/comms.test.ts`
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add src/stores/comms.ts src/stores/comms.test.ts
git commit -m "feat(comms): add comms message store with per-surface computed filters"
```

---

### Task 2: Add dismiss logic and duration parser

**Files:**

- Create: `src/lib/comms.ts`

**Step 1: Write the failing test**

Create `src/lib/comms.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseDurationMs,
  dismissMessage,
  isDismissed,
  loadDismissedState,
  DISMISSED_STORAGE_KEY,
} from './comms';

describe('parseDurationMs', () => {
  it('parses HH:MM:SS format', () => {
    expect(parseDurationMs('1:00:00')).toBe(3_600_000);
    expect(parseDurationMs('0:30:00')).toBe(1_800_000);
    expect(parseDurationMs('24:00:00')).toBe(86_400_000);
  });

  it('parses H:MM:SS with leading zero', () => {
    expect(parseDurationMs('01:30:00')).toBe(5_400_000);
  });

  it('returns Infinity for invalid strings', () => {
    expect(parseDurationMs('garbage')).toBe(Infinity);
  });
});

describe('dismiss logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-05T12:00:00Z'));
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('dismissMessage stores permanent dismiss when duration is null', () => {
    dismissMessage('msg-1', null);
    expect(isDismissed('msg-1')).toBe(true);
  });

  it('dismissMessage stores timed dismiss', () => {
    dismissMessage('msg-2', '1:00:00');
    expect(isDismissed('msg-2')).toBe(true);
    // Advance past the 1-hour duration
    vi.advanceTimersByTime(3_600_001);
    expect(isDismissed('msg-2')).toBe(false);
  });

  it('persists to localStorage', () => {
    dismissMessage('msg-3', null);
    const stored = JSON.parse(localStorage.getItem(DISMISSED_STORAGE_KEY) ?? '{}');
    expect(stored['msg-3']).toBeDefined();
  });

  it('loadDismissedState reads from localStorage', () => {
    localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify({ 'msg-4': Infinity }));
    const state = loadDismissedState();
    expect(state['msg-4']).toBe(Infinity);
  });

  it('loadDismissedState prunes expired entries', () => {
    const past = Date.now() - 1000;
    localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify({ old: past, perm: Infinity }));
    const state = loadDismissedState();
    expect(state['old']).toBeUndefined();
    expect(state['perm']).toBe(Infinity);
  });

  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem(DISMISSED_STORAGE_KEY, 'not-json');
    const state = loadDismissedState();
    expect(state).toEqual({});
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- src/lib/comms.test.ts`
Expected: FAIL — module `./comms` not found

**Step 3: Write minimal implementation**

Create `src/lib/comms.ts`:

```typescript
import { $dismissedMessages } from '@/stores/comms';

export const DISMISSED_STORAGE_KEY = 'sous:comms:dismissed';

// ── Duration parsing ─────────────────────────────────────────────

/**
 * Parse a duration string to milliseconds.
 * Supports Python timedelta format "H:MM:SS" (from the backend).
 * Returns Infinity if the format is unrecognised.
 */
export function parseDurationMs(duration: string): number {
  const hms = duration.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (hms) {
    return (Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3])) * 1000;
  }
  return Infinity;
}

// ── Dismiss state ────────────────────────────────────────────────

function saveDismissedState(state: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save comms dismiss state:', e);
  }
}

/**
 * Load dismissed state from localStorage, pruning expired entries.
 */
export function loadDismissedState(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    const now = Date.now();
    const pruned: Record<string, number> = {};
    for (const [id, expiry] of Object.entries(parsed)) {
      if (expiry === Infinity || expiry === null || expiry > now) {
        pruned[id] = expiry === null ? Infinity : expiry;
      }
    }
    // Save pruned version back
    if (Object.keys(pruned).length !== Object.keys(parsed).length) {
      saveDismissedState(pruned);
    }
    return pruned;
  } catch (e) {
    console.warn('Failed to load comms dismiss state:', e);
    return {};
  }
}

/**
 * Dismiss a message. Updates both the nanostore and localStorage.
 * @param dismiss_duration — "H:MM:SS" string or null (permanent dismiss).
 */
export function dismissMessage(messageId: string, dismissDuration: string | null): void {
  const expiry =
    dismissDuration === null ? Infinity : Date.now() + parseDurationMs(dismissDuration);
  const current = $dismissedMessages.get();
  const next = { ...current, [messageId]: expiry };
  $dismissedMessages.set(next);
  saveDismissedState(next);
}

/**
 * Check if a message is currently dismissed (not expired).
 */
export function isDismissed(messageId: string): boolean {
  const state = $dismissedMessages.get();
  const expiry = state[messageId];
  if (expiry === undefined) return false;
  if (expiry === Infinity) return true;
  return expiry > Date.now();
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- src/lib/comms.test.ts`
Expected: PASS (all 8 tests)

**Step 5: Commit**

```bash
git add src/lib/comms.ts src/lib/comms.test.ts
git commit -m "feat(comms): add dismiss logic with localStorage persistence and duration parsing"
```

---

### Task 3: Add analytics batching for comms events

**Files:**

- Modify: `src/lib/comms.ts` (append analytics section)
- Modify: `src/analytics/types.ts:8-50` (add comms event names)

**Step 1: Write the failing test**

Append to `src/lib/comms.test.ts`:

```typescript
import { createCommsBatcher, type CommsEvent } from './comms';

describe('analytics batching', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('queues events and flushes after 5 seconds', () => {
    const batcher = createCommsBatcher('http://localhost:4322');
    batcher.track({
      message_id: 'm1',
      content_id: 'c1',
      event_type: 'impression',
      subject_key: 'anon-1',
      metadata: {},
    });
    expect(fetch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('sends batched events in correct format', () => {
    const batcher = createCommsBatcher('http://localhost:4322');
    batcher.track({
      message_id: 'm1',
      content_id: 'c1',
      event_type: 'impression',
      subject_key: 'anon-1',
      metadata: {},
    });
    batcher.track({
      message_id: 'm2',
      content_id: 'c2',
      event_type: 'click',
      subject_key: 'anon-1',
      metadata: {},
    });
    vi.advanceTimersByTime(5000);
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.events).toHaveLength(2);
    expect(body.events[0].event_type).toBe('impression');
  });

  it('does not flush when queue is empty', () => {
    const batcher = createCommsBatcher('http://localhost:4322');
    vi.advanceTimersByTime(5000);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('caps batch at 50 events', () => {
    const batcher = createCommsBatcher('http://localhost:4322');
    for (let i = 0; i < 55; i++) {
      batcher.track({
        message_id: `m${i}`,
        content_id: `c${i}`,
        event_type: 'impression',
        subject_key: 'anon',
        metadata: {},
      });
    }
    vi.advanceTimersByTime(5000);
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.events).toHaveLength(50);
    // Remaining 5 flushed on next interval
    vi.advanceTimersByTime(5000);
    const body2 = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[1][1].body);
    expect(body2.events).toHaveLength(5);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- src/lib/comms.test.ts`
Expected: FAIL — `createCommsBatcher` not exported

**Step 3: Write minimal implementation**

Append to `src/lib/comms.ts`:

```typescript
// ── Analytics batching ───────────────────────────────────────────

export interface CommsEvent {
  message_id: string;
  content_id: string;
  event_type: 'impression' | 'click' | 'dismiss';
  subject_key: string;
  metadata: Record<string, unknown>;
}

const MAX_BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 5000;

export function createCommsBatcher(apiBaseUrl: string) {
  let queue: CommsEvent[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;

  function flush() {
    if (queue.length === 0) return;
    const batch = queue.splice(0, MAX_BATCH_SIZE);
    const url = `${apiBaseUrl}/api/v1/merchant-comms/widget/events/`;
    // Fire-and-forget — don't block UI
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    }).catch(() => {
      // Silently ignore analytics failures
    });
  }

  function start() {
    if (timer) return;
    timer = setInterval(flush, FLUSH_INTERVAL_MS);
  }

  function track(event: CommsEvent) {
    queue.push(event);
    if (!timer) start();
  }

  function destroy() {
    flush();
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return { track, flush, destroy };
}
```

Also add comms events to `src/analytics/types.ts` (after line 48, before the closing `} as const;`):

```typescript
  // Comms
  COMMS_IMPRESSION: 'comms_impression',
  COMMS_CLICK: 'comms_click',
  COMMS_DISMISS: 'comms_dismiss',
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- src/lib/comms.test.ts`
Expected: PASS (all 12 tests)

**Step 5: Commit**

```bash
git add src/lib/comms.ts src/lib/comms.test.ts src/analytics/types.ts
git commit -m "feat(comms): add analytics event batcher and PostHog event types"
```

---

### Task 4: Add i18n keys for comms

**Files:**

- Modify: `src/i18n/messages/en.json` (add key after line 61)
- Modify: `src/i18n/messages/nl.json` (add key after line 61)
- Modify: `src/i18n/messages/de.json` (add key after line 61)

**Step 1: Add the key to all three files**

In `en.json`, add before the closing `}`:

```json
  "dismissBanner": "Dismiss notification"
```

In `nl.json`:

```json
  "dismissBanner": "Melding sluiten"
```

In `de.json`:

```json
  "dismissBanner": "Benachrichtigung schließen"
```

**Step 2: Run existing i18n test to verify nothing broke**

Run: `pnpm test -- src/i18n/index.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/i18n/messages/en.json src/i18n/messages/nl.json src/i18n/messages/de.json
git commit -m "feat(comms): add dismissBanner i18n key in en/nl/de"
```

---

### Task 5: Add optional warning theme token

**Files:**

- Modify: `src/types/merchant.ts:1-23` (add optional fields)
- Modify: `tailwind.config.mjs:9-44` (add warning color)

**Step 1: Add optional warning fields to MerchantTheme**

In `src/types/merchant.ts`, add after line 16 (`destructiveForeground`):

```typescript
  warning?: string;
  warningForeground?: string;
```

**Step 2: Add warning to Tailwind config**

In `tailwind.config.mjs`, add after the `destructive` color block (line 40):

```javascript
        warning: {
          DEFAULT: 'hsl(var(--warning, var(--accent)))',
          foreground: 'hsl(var(--warning-foreground, var(--accent-foreground)))',
        },
```

This uses CSS `var()` fallback syntax — if `--warning` is not defined by the merchant theme, it falls back to `--accent`. Zero merchant config changes needed.

**Step 3: Run existing theme test**

Run: `pnpm test -- src/lib/theme.test.ts`
Expected: PASS (existing tests unaffected — optional fields don't break `themeToCSS`)

**Step 4: Commit**

```bash
git add src/types/merchant.ts tailwind.config.mjs
git commit -m "feat(comms): add optional warning theme token with accent fallback"
```

---

## Phase 2: Surface Components

### Task 6: Create TopBanner component

**Files:**

- Create: `src/components/interactive/TopBanner.tsx`

**Step 1: Write the component**

```tsx
import { useStore } from '@nanostores/preact';
import { $topBannerMessages } from '@/stores/comms';
import { dismissMessage } from '@/lib/comms';
import { t } from '@/i18n';
import type { CommsTheme } from '@/stores/comms';

interface Props {
  lang: string;
  onImpression?: (messageId: string, contentId: string) => void;
  onClick?: (messageId: string, contentId: string) => void;
  onDismiss?: (messageId: string, contentId: string) => void;
}

const THEME_CLASSES: Record<CommsTheme, string> = {
  info: 'bg-muted text-muted-foreground',
  success: 'bg-primary/10 text-primary',
  warning: 'bg-warning/10 text-warning',
  urgent: 'bg-destructive/10 text-destructive',
  promotional: 'bg-accent text-accent-foreground',
};

function colorStyle(custom: Record<string, string>): Record<string, string> | undefined {
  if (!custom.bg && !custom.text) return undefined;
  const style: Record<string, string> = {};
  if (custom.bg && /^#[0-9a-fA-F]{3,8}$/.test(custom.bg)) style.backgroundColor = custom.bg;
  if (custom.text && /^#[0-9a-fA-F]{3,8}$/.test(custom.text)) style.color = custom.text;
  return Object.keys(style).length > 0 ? style : undefined;
}

export default function TopBanner({ lang, onImpression, onClick, onDismiss }: Props) {
  const entries = useStore($topBannerMessages);
  const entry = entries[0]; // Show highest-priority only
  if (!entry) return null;

  const { message, content } = entry;

  // Fire impression callback on render
  if (onImpression) {
    // Use a ref to avoid firing on every re-render — handled by orchestrator
    onImpression(message.id, content.id);
  }

  const themeClass = THEME_CLASSES[content.theme] ?? THEME_CLASSES.info;
  const style = colorStyle(content.custom_colors);

  return (
    <div
      role="status"
      class={`sticky top-0 z-30 flex w-full items-center justify-center gap-3 px-4 py-2.5 text-sm animate-in slide-in-from-top ${themeClass}`}
      style={style}
      data-comms-banner="top"
    >
      <div class="flex items-center gap-2">
        {content.headline && <span class="font-medium">{content.headline}</span>}
        {content.body && <span class="opacity-80">{content.body}</span>}
        {content.cta_label && content.cta_url && (
          <a
            href={content.cta_url}
            class="ml-1 underline underline-offset-2 font-medium hover:opacity-80"
            onClick={() => onClick?.(message.id, content.id)}
          >
            {content.cta_label}
          </a>
        )}
      </div>
      {message.dismissible && (
        <button
          type="button"
          onClick={() => {
            onDismiss?.(message.id, content.id);
            dismissMessage(message.id, message.dismiss_duration);
          }}
          class="ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-60 hover:opacity-100"
          aria-label={t('dismissBanner', lang)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/interactive/TopBanner.tsx
git commit -m "feat(comms): add TopBanner surface component"
```

---

### Task 7: Create BottomBanner component

**Files:**

- Create: `src/components/interactive/BottomBanner.tsx`

**Step 1: Write the component**

Same structure as TopBanner but with bottom positioning:

```tsx
import { useStore } from '@nanostores/preact';
import { $bottomBannerMessages } from '@/stores/comms';
import { dismissMessage } from '@/lib/comms';
import { t } from '@/i18n';
import type { CommsTheme } from '@/stores/comms';

interface Props {
  lang: string;
  onImpression?: (messageId: string, contentId: string) => void;
  onClick?: (messageId: string, contentId: string) => void;
  onDismiss?: (messageId: string, contentId: string) => void;
}

const THEME_CLASSES: Record<CommsTheme, string> = {
  info: 'bg-muted text-muted-foreground',
  success: 'bg-primary/10 text-primary',
  warning: 'bg-warning/10 text-warning',
  urgent: 'bg-destructive/10 text-destructive',
  promotional: 'bg-accent text-accent-foreground',
};

function colorStyle(custom: Record<string, string>): Record<string, string> | undefined {
  if (!custom.bg && !custom.text) return undefined;
  const style: Record<string, string> = {};
  if (custom.bg && /^#[0-9a-fA-F]{3,8}$/.test(custom.bg)) style.backgroundColor = custom.bg;
  if (custom.text && /^#[0-9a-fA-F]{3,8}$/.test(custom.text)) style.color = custom.text;
  return Object.keys(style).length > 0 ? style : undefined;
}

export default function BottomBanner({ lang, onImpression, onClick, onDismiss }: Props) {
  const entries = useStore($bottomBannerMessages);
  const entry = entries[0];
  if (!entry) return null;

  const { message, content } = entry;

  if (onImpression) onImpression(message.id, content.id);

  const themeClass = THEME_CLASSES[content.theme] ?? THEME_CLASSES.info;
  const style = colorStyle(content.custom_colors);

  return (
    <div
      role="status"
      class={`fixed bottom-0 left-0 right-0 z-30 flex w-full items-center justify-center gap-3 px-4 py-2.5 text-sm animate-in slide-in-from-bottom ${themeClass}`}
      style={style}
      data-comms-banner="bottom"
    >
      <div class="flex items-center gap-2">
        {content.headline && <span class="font-medium">{content.headline}</span>}
        {content.body && <span class="opacity-80">{content.body}</span>}
        {content.cta_label && content.cta_url && (
          <a
            href={content.cta_url}
            class="ml-1 underline underline-offset-2 font-medium hover:opacity-80"
            onClick={() => onClick?.(message.id, content.id)}
          >
            {content.cta_label}
          </a>
        )}
      </div>
      {message.dismissible && (
        <button
          type="button"
          onClick={() => {
            onDismiss?.(message.id, content.id);
            dismissMessage(message.id, message.dismiss_duration);
          }}
          class="ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-60 hover:opacity-100"
          aria-label={t('dismissBanner', lang)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/interactive/BottomBanner.tsx
git commit -m "feat(comms): add BottomBanner surface component"
```

---

### Task 8: Create CommsModal component

**Files:**

- Create: `src/components/interactive/CommsModal.tsx`

**Step 1: Write the component**

Uses the existing `useFocusTrap` hook from `src/hooks/use-focus-trap.ts` and follows the modal pattern from `ProductDetail.tsx` (fixed inset-0 z-50, backdrop, dialog ref, aria-modal).

```tsx
import { useRef, useState, useEffect, useCallback } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $modalMessages } from '@/stores/comms';
import { $isCartOpen } from '@/stores/ui';
import { $selectedProduct } from '@/stores/ui';
import { dismissMessage } from '@/lib/comms';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { t } from '@/i18n';
import type { CommsTheme } from '@/stores/comms';

const SESSION_KEY = 'sous:comms:modal_shown';

interface Props {
  lang: string;
  onImpression?: (messageId: string, contentId: string) => void;
  onClick?: (messageId: string, contentId: string) => void;
  onDismiss?: (messageId: string, contentId: string) => void;
}

const THEME_CLASSES: Record<CommsTheme, string> = {
  info: 'bg-card text-card-foreground border-muted',
  success: 'bg-card text-card-foreground border-primary/30',
  warning: 'bg-card text-card-foreground border-warning/30',
  urgent: 'bg-card text-card-foreground border-destructive/30',
  promotional: 'bg-card text-card-foreground border-accent/30',
};

export default function CommsModal({ lang, onImpression, onClick, onDismiss }: Props) {
  const entries = useStore($modalMessages);
  const isCartOpen = useStore($isCartOpen);
  const selectedProduct = useStore($selectedProduct);
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const entry = entries[0];

  const close = useCallback(() => {
    if (entry) {
      onDismiss?.(entry.message.id, entry.content.id);
      dismissMessage(entry.message.id, entry.message.dismiss_duration);
    }
    setIsOpen(false);
  }, [entry, onDismiss]);

  useFocusTrap(dialogRef, isOpen, close);

  // Eligibility-gated opening: no other overlay open, once per session, after idle
  useEffect(() => {
    if (!entry) return;
    if (isCartOpen || selectedProduct) return;

    // Once per session check
    if (typeof sessionStorage !== 'undefined') {
      const shown = sessionStorage.getItem(SESSION_KEY);
      if (shown) return;
    }

    const id = requestIdleCallback(
      () => {
        // Re-check overlay state at callback time
        if ($isCartOpen.get() || $selectedProduct.get()) return;
        setIsOpen(true);
        onImpression?.(entry.message.id, entry.content.id);
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(SESSION_KEY, '1');
        }
      },
      { timeout: 2000 },
    );

    return () => cancelIdleCallback(id);
  }, [entry, isCartOpen, selectedProduct]);

  if (!isOpen || !entry) return null;

  const { message, content } = entry;
  const themeClass = THEME_CLASSES[content.theme] ?? THEME_CLASSES.info;

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={content.headline || 'Notification'}
        class={`relative mx-4 w-full max-w-md rounded-lg border-2 p-6 shadow-xl animate-in fade-in zoom-in-95 ${themeClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {content.headline && (
          <h2 class="text-lg font-heading font-semibold mb-2">{content.headline}</h2>
        )}
        {content.body && <p class="text-sm opacity-80 mb-4">{content.body}</p>}
        <div class="flex items-center gap-3">
          {content.cta_label && content.cta_url && (
            <a
              href={content.cta_url}
              class="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              onClick={() => onClick?.(message.id, content.id)}
            >
              {content.cta_label}
            </a>
          )}
          <button
            type="button"
            onClick={close}
            class="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            {t('dismissBanner', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/interactive/CommsModal.tsx
git commit -m "feat(comms): add CommsModal with focus trap and eligibility gates"
```

---

### Task 9: Create InlineCallout component

**Files:**

- Create: `src/components/interactive/InlineCallout.tsx`

**Step 1: Write the component**

```tsx
import { dismissMessage } from '@/lib/comms';
import { t } from '@/i18n';
import type { CommsTheme, SurfaceEntry } from '@/stores/comms';

interface Props {
  lang: string;
  entries: SurfaceEntry[];
  onImpression?: (messageId: string, contentId: string) => void;
  onClick?: (messageId: string, contentId: string) => void;
  onDismiss?: (messageId: string, contentId: string) => void;
}

const THEME_CLASSES: Record<CommsTheme, string> = {
  info: 'bg-muted text-muted-foreground border-muted',
  success: 'bg-primary/10 text-primary border-primary/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  urgent: 'bg-destructive/10 text-destructive border-destructive/20',
  promotional: 'bg-accent text-accent-foreground border-accent/20',
};

export default function InlineCallout({ lang, entries, onImpression, onClick, onDismiss }: Props) {
  if (entries.length === 0) return null;

  return (
    <div class="flex flex-col gap-2">
      {entries.map(({ message, content }) => {
        onImpression?.(message.id, content.id);
        const themeClass = THEME_CLASSES[content.theme] ?? THEME_CLASSES.info;
        return (
          <div
            key={content.id}
            role="status"
            class={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${themeClass}`}
            data-comms-callout={content.surface}
          >
            <div class="flex-1">
              {content.headline && <span class="font-medium">{content.headline}</span>}
              {content.body && <span class="ml-1 opacity-80">{content.body}</span>}
              {content.cta_label && content.cta_url && (
                <a
                  href={content.cta_url}
                  class="ml-2 underline underline-offset-2 font-medium hover:opacity-80"
                  onClick={() => onClick?.(message.id, content.id)}
                >
                  {content.cta_label}
                </a>
              )}
            </div>
            {message.dismissible && (
              <button
                type="button"
                onClick={() => {
                  onDismiss?.(message.id, content.id);
                  dismissMessage(message.id, message.dismiss_duration);
                }}
                class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-60 hover:opacity-100"
                aria-label={t('dismissBanner', lang)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/interactive/InlineCallout.tsx
git commit -m "feat(comms): add InlineCallout surface component"
```

---

## Phase 3: Orchestrator + Integration

### Task 10: Create MerchantComms orchestrator island

**Files:**

- Create: `src/components/interactive/MerchantComms.tsx`

**Step 1: Write the orchestrator**

This is the single island mounted in BaseLayout. It initialises stores from SSR props, wires up analytics callbacks, and renders surface sub-components.

```tsx
import { useEffect, useRef } from 'preact/hooks';
import { $commsMessages, $dismissedMessages } from '@/stores/comms';
import { $toastMessages } from '@/stores/comms';
import type { CommsMessage } from '@/stores/comms';
import { loadDismissedState, createCommsBatcher } from '@/lib/comms';
import { showToast } from '@/stores/toast';
import { capture, EVENTS } from '@/analytics';
import TopBanner from './TopBanner';
import BottomBanner from './BottomBanner';
import CommsModal from './CommsModal';

interface Props {
  lang: string;
  messages: CommsMessage[];
}

function getSubjectKey(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    const key = 'sous:comms:subject';
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return 'anonymous';
  }
}

export default function MerchantComms({ lang, messages }: Props) {
  const batcherRef = useRef<ReturnType<typeof createCommsBatcher> | null>(null);
  const impressedRef = useRef(new Set<string>());

  // Initialise stores and batcher on mount
  useEffect(() => {
    $commsMessages.set(messages);
    $dismissedMessages.set(loadDismissedState());

    const apiBase =
      (typeof window !== 'undefined' && (window as any).__PUBLIC_API_BASE_URL__) ||
      import.meta.env.PUBLIC_API_BASE_URL ||
      '';
    batcherRef.current = createCommsBatcher(apiBase);

    // Feed toast-surface messages into the existing toast system
    const toastEntries = $toastMessages.get();
    for (const { content } of toastEntries) {
      const toastType =
        content.theme === 'urgent' || content.theme === 'warning' ? 'error' : 'success';
      showToast(content.headline || content.body, toastType);
    }

    return () => {
      batcherRef.current?.destroy();
    };
  }, []);

  const subjectKey = useRef(getSubjectKey());

  const trackEvent = (
    messageId: string,
    contentId: string,
    eventType: 'impression' | 'click' | 'dismiss',
  ) => {
    batcherRef.current?.track({
      message_id: messageId,
      content_id: contentId,
      event_type: eventType,
      subject_key: subjectKey.current,
      metadata: {},
    });

    // Also fire PostHog event
    const eventMap = {
      impression: EVENTS.COMMS_IMPRESSION,
      click: EVENTS.COMMS_CLICK,
      dismiss: EVENTS.COMMS_DISMISS,
    } as const;
    capture(eventMap[eventType], { message_id: messageId, content_id: contentId });
  };

  const onImpression = (messageId: string, contentId: string) => {
    const key = `${messageId}:${contentId}`;
    if (impressedRef.current.has(key)) return;
    impressedRef.current.add(key);
    trackEvent(messageId, contentId, 'impression');
  };

  const onClick = (messageId: string, contentId: string) => {
    trackEvent(messageId, contentId, 'click');
  };

  const onDismiss = (messageId: string, contentId: string) => {
    trackEvent(messageId, contentId, 'dismiss');
  };

  return (
    <>
      <TopBanner lang={lang} onImpression={onImpression} onClick={onClick} onDismiss={onDismiss} />
      <BottomBanner
        lang={lang}
        onImpression={onImpression}
        onClick={onClick}
        onDismiss={onDismiss}
      />
      <CommsModal lang={lang} onImpression={onImpression} onClick={onClick} onDismiss={onDismiss} />
    </>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/interactive/MerchantComms.tsx
git commit -m "feat(comms): add MerchantComms orchestrator island"
```

---

### Task 11: Mount in BaseLayout and add server-side fetch

**Files:**

- Modify: `src/layouts/BaseLayout.astro`

**Step 1: Add the server-side fetch and island mount**

In the frontmatter (after line 24, `const langValue = lang ?? 'en';`), add:

```typescript
// Fetch active merchant communications
import MerchantComms from '@/components/interactive/MerchantComms';
import type { CommsMessage } from '@/stores/comms';

let commsMessages: CommsMessage[] = [];
if (Astro.locals.sdk) {
  try {
    const { data } = await Astro.locals.sdk.GET('/api/v1/merchant-comms/widget/active/', {
      params: { query: { surfaces: 'top_banner,bottom_banner,modal,toast' } },
    });
    if (data) commsMessages = data as CommsMessage[];
  } catch {
    // Silently degrade — no banners is better than a broken page
  }
}
```

In the body, add the island after the `<slot />` and before the shared islands block (between line 66 and 68):

```astro
<MerchantComms client:idle lang={langValue} messages={commsMessages} />
```

**Step 2: Run dev server to verify no errors**

Run: `pnpm dev` (verify page loads without errors, check terminal output)

**Step 3: Commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "feat(comms): server-side fetch and MerchantComms island in BaseLayout"
```

---

## Phase 4: E2E Tests

### Task 12: Add comms fixtures and mock API routes

**Files:**

- Create: `e2e/fixtures/comms.ts`
- Modify: `e2e/helpers/mock-api.ts` (add routes before the fallback on line 311)

**Step 1: Create fixture file**

Create `e2e/fixtures/comms.ts`:

```typescript
export interface CommsFixture {
  id: string;
  priority: number;
  dismissible: boolean;
  dismiss_duration: string | null;
  contents: Array<{
    id: string;
    surface: string;
    headline: string;
    body: string;
    cta_label: string;
    cta_url: string;
    theme: string;
    custom_colors: Record<string, string>;
    extra: Record<string, unknown>;
  }>;
}

export function topBannerMessage(overrides: Partial<CommsFixture> = {}): CommsFixture {
  return {
    id: 'comms-banner-1',
    priority: 0,
    dismissible: true,
    dismiss_duration: '1:00:00',
    contents: [
      {
        id: 'cnt-banner-1',
        surface: 'top_banner',
        headline: 'Free delivery this weekend!',
        body: 'Orders over €25 ship free.',
        cta_label: 'Shop now',
        cta_url: '/nl/collection/weekend-deals',
        theme: 'info',
        custom_colors: {},
        extra: {},
      },
    ],
    ...overrides,
  };
}

export function modalMessage(overrides: Partial<CommsFixture> = {}): CommsFixture {
  return {
    id: 'comms-modal-1',
    priority: 0,
    dismissible: true,
    dismiss_duration: null,
    contents: [
      {
        id: 'cnt-modal-1',
        surface: 'modal',
        headline: 'Welcome!',
        body: 'First order? Get 10% off.',
        cta_label: 'Claim offer',
        cta_url: '/nl/',
        theme: 'promotional',
        custom_colors: {},
        extra: {},
      },
    ],
    ...overrides,
  };
}

export function bottomBannerMessage(overrides: Partial<CommsFixture> = {}): CommsFixture {
  return {
    id: 'comms-bottom-1',
    priority: 0,
    dismissible: true,
    dismiss_duration: '0:30:00',
    contents: [
      {
        id: 'cnt-bottom-1',
        surface: 'bottom_banner',
        headline: 'New: order tracking!',
        body: '',
        cta_label: '',
        cta_url: '',
        theme: 'success',
        custom_colors: {},
        extra: {},
      },
    ],
    ...overrides,
  };
}

export function noCommsMessages(): CommsFixture[] {
  return [];
}

export function allSurfaceMessages(): CommsFixture[] {
  return [topBannerMessage(), bottomBannerMessage(), modalMessage()];
}
```

**Step 2: Add mock API routes**

In `e2e/helpers/mock-api.ts`, add these routes before `// ── Fallback ──` (line 311). Also add the import at the top:

```typescript
import { allSurfaceMessages } from '../fixtures/comms';
```

Routes to add:

```typescript
// ── Comms: active messages ──
if (method === 'GET' && path.startsWith('/api/v1/merchant-comms/widget/active/')) {
  json(res, allSurfaceMessages());
  return;
}

// ── Comms: events ingest (fire-and-forget) ──
if (method === 'POST' && path === '/api/v1/merchant-comms/widget/events/') {
  await readBody(req); // consume body
  json(res, { status: 'ok' }, 202);
  return;
}
```

**Step 3: Commit**

```bash
git add e2e/fixtures/comms.ts e2e/helpers/mock-api.ts
git commit -m "test(comms): add comms fixtures and mock API routes"
```

---

### Task 13: Write E2E test spec

**Files:**

- Create: `e2e/comms.spec.ts`

**Step 1: Write the spec**

```typescript
import { test, expect } from '@playwright/test';
import { resetMockApi, menuPage, waitForHydration, blockAnalytics } from './helpers/test-utils';

test.describe('Merchant Communications — banners', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockApi(page);
    await blockAnalytics(page);
  });

  test('top banner renders with correct content', async ({ page }) => {
    await page.goto(menuPage());
    await waitForHydration(page);

    const banner = page.locator('[data-comms-banner="top"]');
    await banner.waitFor({ state: 'visible', timeout: 5_000 });
    await expect(banner).toContainText('Free delivery this weekend!');
    await expect(banner).toContainText('Orders over €25 ship free.');
    await expect(banner.getByRole('link', { name: 'Shop now' })).toBeVisible();
  });

  test('bottom banner renders', async ({ page }) => {
    await page.goto(menuPage());
    await waitForHydration(page);

    const banner = page.locator('[data-comms-banner="bottom"]');
    await banner.waitFor({ state: 'visible', timeout: 5_000 });
    await expect(banner).toContainText('New: order tracking!');
  });

  test('dismiss button hides top banner', async ({ page }) => {
    await page.goto(menuPage());
    await waitForHydration(page);

    const banner = page.locator('[data-comms-banner="top"]');
    await banner.waitFor({ state: 'visible', timeout: 5_000 });

    await banner.getByRole('button', { name: /dismiss|sluiten|schließen/i }).click();
    await expect(banner).not.toBeVisible();
  });

  test('dismissed banner stays hidden after navigation', async ({ page }) => {
    await page.goto(menuPage());
    await waitForHydration(page);

    const banner = page.locator('[data-comms-banner="top"]');
    await banner.waitFor({ state: 'visible', timeout: 5_000 });
    await banner.getByRole('button', { name: /dismiss|sluiten|schließen/i }).click();
    await expect(banner).not.toBeVisible();

    // Navigate away and back
    await page.goto(menuPage('en'));
    await waitForHydration(page);
    // Banner should still be hidden (localStorage persisted)
    await expect(page.locator('[data-comms-banner="top"]')).not.toBeVisible();
  });

  test('no banners when API returns empty array', async ({ page }) => {
    // Override the comms route to return empty
    await page.route('**/merchant-comms/widget/active/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await page.goto(menuPage());
    await waitForHydration(page);

    await expect(page.locator('[data-comms-banner="top"]')).not.toBeVisible();
    await expect(page.locator('[data-comms-banner="bottom"]')).not.toBeVisible();
  });

  test('CTA link navigates correctly', async ({ page }) => {
    await page.goto(menuPage());
    await waitForHydration(page);

    const banner = page.locator('[data-comms-banner="top"]');
    await banner.waitFor({ state: 'visible', timeout: 5_000 });
    const ctaLink = banner.getByRole('link', { name: 'Shop now' });
    await expect(ctaLink).toHaveAttribute('href', '/nl/collection/weekend-deals');
  });
});
```

**Step 2: Run the E2E test**

Run: `pnpm test:e2e -- --grep "Merchant Communications"`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add e2e/comms.spec.ts
git commit -m "test(comms): add E2E tests for banners render, dismiss, and navigation"
```

---

## Phase 5: Final Validation

### Task 14: Bundle size check

**Step 1: Run production build and size check**

Run: `pnpm build && pnpm size:check`
Expected: Total client JS < 65 KB gzipped

If the build fails or size exceeds budget, investigate which comms modules are being included and consider lazy-loading the analytics batcher.

**Step 2: Commit any adjustments**

---

### Task 15: Run full test suite

**Step 1: Run unit tests**

Run: `pnpm test`
Expected: All PASS

**Step 2: Run E2E tests**

Run: `pnpm test:e2e`
Expected: All PASS (including new comms tests and existing tests unbroken)

**Step 3: Run type check**

Run: `pnpm check`
Expected: No type errors

**Step 4: Final commit if any fixes were needed**

---

## Summary

| Phase          | Tasks | New Files                                                                  | Modified Files                                                         |
| -------------- | ----- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1: Foundation  | 1-5   | `stores/comms.ts`, `lib/comms.ts`, tests                                   | `analytics/types.ts`, `merchant.ts`, `tailwind.config.mjs`, i18n JSONs |
| 2: Surfaces    | 6-9   | `TopBanner.tsx`, `BottomBanner.tsx`, `CommsModal.tsx`, `InlineCallout.tsx` | —                                                                      |
| 3: Integration | 10-11 | `MerchantComms.tsx`                                                        | `BaseLayout.astro`                                                     |
| 4: E2E Tests   | 12-13 | `e2e/fixtures/comms.ts`, `e2e/comms.spec.ts`                               | `e2e/helpers/mock-api.ts`                                              |
| 5: Validation  | 14-15 | —                                                                          | —                                                                      |

**Estimated bundle impact:** ~2.5-3 KB gzipped client JS (within the 3 KB budget).

**Key architectural decisions from debate synthesis applied:**

- Optional `--warning` with CSS `var()` fallback (zero merchant config churn)
- Modal eligibility gates (no overlay collisions)
- `z-30` for banners (below header at `z-40`)
- Dual analytics (backend batcher + PostHog)
- Hex-only validation on `custom_colors` (XSS prevention)
- Error-safe SSR fetch with silent degradation
