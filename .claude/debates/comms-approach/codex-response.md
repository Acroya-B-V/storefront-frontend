## Merchant Communications Approach Debate

1. **Single orchestrator island vs multiple islands per surface — IMPROVE**  
   A single orchestrator is good for coordination logic (priority, dedupe, frequency caps), but I would not ship every surface in one always-hydrated bundle. The layout already mounts several shared islands at `client:idle` ([BaseLayout.astro#L69](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/layouts/BaseLayout.astro#L69)), and you still have a strict client bundle budget ([CLAUDE.md#L185](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/CLAUDE.md#L185)). Best shape: one orchestration store/module + per-surface renderers loaded only when needed.

2. **Adding `--warning` to theme system vs remapping to existing tokens — IMPROVE**  
   Do not add `warning` as a required token right now. Theme is currently strict and fully required ([merchant.ts#L1](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/types/merchant.ts#L1)), Tailwind has no warning color mapping yet ([tailwind.config.mjs#L9](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/tailwind.config.mjs#L9)), and `themeToCSS` blindly emits keys ([theme.ts#L3](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/lib/theme.ts#L3)). Make `warning` optional with fallback to `secondary` or `accent` to avoid merchant config churn.

3. **Extending Toast type union vs keeping comms toasts separate — DISAGREE**  
   Current toast system is intentionally narrow (`error | success`) ([toast.ts#L3](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/stores/toast.ts#L3)) and style logic assumes only those two paths ([Toast.tsx#L21](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/components/interactive/Toast.tsx#L21)). It also caps queue length to 3 and auto-dismisses at 4s ([toast.ts#L11](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/stores/toast.ts#L11)), which is risky for mixing critical transactional errors with marketing/comms messages. Keep comms toast state separate or enforce priority lanes.

4. **`localStorage` for dismiss state vs `sessionStorage` or cookies — AGREE**  
   `localStorage` is the right default for multi-visit dismissal persistence, and this codebase already uses that pattern robustly for cart state ([cart.ts#L64](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/stores/cart.ts#L64)). `sessionStorage` is too short-lived for “dismiss for N days,” and cookies add request overhead without server-side need. Add namespacing by merchant/lang/message-id and prune expired entries.

5. **Custom analytics batcher vs existing `capture()` — DISAGREE**  
   You already have an analytics abstraction that merges context and strips PII before send ([analytics/index.ts#L37](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/analytics/index.ts#L37)), plus PostHog queue bootstrapping in layout ([BaseLayout.astro#L37](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/layouts/BaseLayout.astro#L37)). A second batcher duplicates behavior and creates schema drift risk. Add comms events to typed analytics events ([analytics/types.ts#L8](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/analytics/types.ts#L8)) and use `capture()`.

6. **Server-side fetch in `BaseLayout` vs client-side fetch — IMPROVE**  
   Fetching all comms surfaces server-side in base layout can penalize every page request because `BaseLayout` is globally used ([BaseLayout.astro#L19](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/layouts/BaseLayout.astro#L19)). It also wastes work on pages with altered shared-island behavior, e.g. cart (`hideSharedIslands`) ([cart.astro#L14](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/pages/[lang]/cart.astro#L14)). Hybrid is stronger: SSR top/bottom banners (for no-flash), client-fetch modal/toast after idle and after local dismissal checks.

7. **Computed nanostores per surface vs filtering in components — AGREE**  
   This matches existing store design: derived values are computed once in stores (`$itemCount`, `$cartTotal`) ([cart.ts#L48](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/stores/cart.ts#L48)). Keeping per-surface computed stores avoids repeated ad hoc filters in render paths and improves testability.

8. **2-second modal delay approach — DISAGREE**  
   A fixed delay is brittle and likely to collide with current overlay UX. Multiple existing dialogs already use `z-50` ([CartDrawer.tsx#L223](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/components/interactive/CartDrawer.tsx#L223), [ProductDetail.tsx#L374](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/components/interactive/ProductDetail.tsx#L374), [SearchBar.tsx#L122](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/components/interactive/SearchBar.tsx#L122)) and focus/scroll locking is global/ref-counted ([use-focus-trap.ts#L6](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/hooks/use-focus-trap.ts#L6)). Use eligibility gates (no other modal open, no recent interaction, once/session) rather than hardcoded 2000ms.

9. **Z-index strategy (`z-50` banners, `z-[60]` toasts) — DISAGREE**  
   `z-[60]` for toasts aligns with current layering ([Toast.tsx#L15](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/components/interactive/Toast.tsx#L15)); `z-50` for banners does not. Existing overlays are already at `z-50`, while header is `z-40` ([Header.astro#L15](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/components/astro/Header.astro#L15)). Banners should stay below modal/drawer overlays; define a shared layer scale and stick to it.

10. **Other improvements after reading code — IMPROVE**  
    Create a unified overlay-state store before adding comms modal. Today, SearchBar keeps open-state local and is triggered via DOM listeners ([SearchBar.tsx#L35](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/components/interactive/SearchBar.tsx#L35), [SearchBar.tsx#L103](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/components/interactive/SearchBar.tsx#L103)), which makes orchestration hard.  
    Extend merchant feature typing explicitly for comms; current `features` only models `upsells` ([merchant.ts#L63](/Users/williamhurst/emdash-projects/worktrees/banners-2h6/src/types/merchant.ts#L63)).  
    Add tests for: dismissal expiry parsing, overlay-collision prevention, and comms-vs-transactional-toast priority behavior.
