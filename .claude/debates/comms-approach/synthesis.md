# Debate Synthesis: Merchant Communications Approach

## Consensus Decisions (All Agree)

| Decision                        | Verdict  | Notes                                                               |
| ------------------------------- | -------- | ------------------------------------------------------------------- |
| localStorage for dismiss state  | **KEEP** | Matches cart persistence pattern, correct for multi-visit dismissal |
| Computed nanostores per surface | **KEEP** | Follows $itemCount/$cartTotal precedent, improves testability       |
| Server-side fetch for banners   | **KEEP** | Zero layout shift outweighs ~20-50ms latency cost                   |
| Single orchestrator island      | **KEEP** | 2.7 KB is too small to benefit from code-splitting                  |

## Revised Decisions (Improved Through Debate)

### 1. Warning Theme Token → Make Optional

- **Original**: Add required `warning`/`warningForeground` to MerchantTheme
- **Revised**: Add as optional fields, fall back to `accent`/`accentForeground`
- **Why**: Avoids updating every merchant JSON file; zero-churn rollout

### 2. Toast Integration → Priority Lanes

- **Original**: Extend Toast type union to include comms themes
- **Revised**: Add `priority` field to Toast interface. Comms toasts = low priority, never evict transactional toasts. Keep comms themes but ensure error/success always win the 3-toast cap.
- **Why**: Prevents marketing messages from hiding cart errors

### 3. Analytics → Dual Track (Both Systems)

- **Original debate**: Custom batcher vs PostHog capture()
- **Revised**: BOTH. Lightweight batcher for comms API endpoint (required by backend contract) + PostHog capture() for funnel analytics. These serve different purposes.
- **Why**: Backend needs structured events; product team needs funnel data

### 4. Modal Delay → Eligibility Gates

- **Original**: Show after 2-second hardcoded delay
- **Revised**: Show when: no other overlay is open AND once per session AND after requestIdleCallback/minimum delay
- **Why**: Prevents modal collision with cart drawer, product detail, search overlay

### 5. Z-Index → Proper Layer Scale

- **Original**: z-50 for banners (same as overlays)
- **Revised**: z-30 for sticky banners, z-40 header (existing), z-50 overlays (existing), z-[60] toasts (existing)
- **Why**: Banners are page elements, not overlays. They should sit below the header.

### 6. Custom Colors → Sanitize

- **Added**: Validate custom_colors values (hex format only) before applying as inline styles
- **Why**: Prevents potential XSS from API-sourced CSS values

### 7. Error Boundary

- **Added**: Wrap MerchantComms island in an error boundary
- **Why**: A broken banner should never crash the storefront

## Phased Rollout Recommendation

| Phase | Scope                                          | Bundle Impact |
| ----- | ---------------------------------------------- | ------------- |
| 1     | TopBanner + BottomBanner + dismiss + analytics | ~1.8 KB       |
| 2     | CommsModal + InlineCallout                     | ~0.7 KB       |
| 3     | Toast integration with priority lanes          | ~0.2 KB       |

## Final File List (Unchanged from Spec)

New files: stores/comms.ts, lib/comms.ts, MerchantComms.tsx, TopBanner.tsx, BottomBanner.tsx, CommsModal.tsx, InlineCallout.tsx
Modified files: BaseLayout.astro, Toast.tsx (phase 3), i18n messages, merchant.ts (optional warning field)
