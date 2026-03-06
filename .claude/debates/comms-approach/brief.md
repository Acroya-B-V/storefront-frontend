# Debate Brief: Merchant Communications Implementation Approach

## Topic

Can the proposed implementation approach for "Merchant Communications" in this Astro 5 + Preact storefront be improved?

## Proposed Approach (Summary)

### Architecture

- Server-side fetch in BaseLayout.astro for top_banner, bottom_banner, modal, toast surfaces
- Single MerchantComms Preact island (client:idle) as orchestrator, with sub-components (not separate islands)
- InlineCallout fetched separately in cart/checkout pages
- Nanostores: $commsMessages atom, $dismissedMessages atom, computed stores per surface
- Dismiss state in localStorage (key: sous:comms:dismissed) with expiry timestamps
- Analytics: separate lightweight batcher for comms API endpoint + PostHog events

### Key Decisions

1. Add `--warning` CSS variable to theme system (Option A over remapping)
2. Extend Toast type union from 'error'|'success' to include comms themes
3. Single orchestrator island vs multiple independent islands
4. Duration parser supports both HH:MM:SS and ISO 8601 PT formats
5. Z-index: comms at z-50 (same as cart drawer), toast stays z-[60]
6. Bundle target: ~2.7 KB estimated within 3 KB budget
7. Feature flag via features.comms in MerchantConfig

### Codebase Context

- Astro 5 SSR with Preact islands, Nanostores, Tailwind CSS
- Existing patterns: $cart, $merchant, $toasts stores; useFocusTrap hook; Toast component
- SDK client: Astro.locals.sdk server-side, getClient() client-side
- Bundle limit: 65 KB gzipped total
- E2E: Playwright with mock API server on port 4322
- Unit: Vitest with happy-dom
