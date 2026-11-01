# Feature / Task: Restaurant portal visual redesign

## Status
In Progress (phase 1 implemented; awaiting visual review)

## Requirement and Acceptance Criteria
Modern, premium look for the restaurant portal. Foodi orange stays the primary
colour but is used sparingly; warm white, charcoal, soft sage and peach support
it. Smooth, lightweight animation, polished sidebar/header, a richer dashboard
(KPI cards, order chart, recent orders, status, empty states), responsive on
desktop, tablet and mobile. No change to APIs, routing, auth or business logic.
Heavy or non-critical client code is lazy loaded.

## Approved Solution / Architecture
- Tokens: add `sage-*` and `peach-*` tokens (globals.css + tokens.ts + test);
  calmer page background (warm white with faint sage/peach glows).
- Motion: `framer-motion` (new dependency). `MotionProvider` wraps the shell in
  `LazyMotion` with `domMax` loaded asynchronously, and components use `m.*`, so
  the animation engine stays out of the initial bundle. `Reveal`/`Stagger`
  for entrances, `CountUp` (plain rAF, no library) for numbers, `template.tsx`
  for page transitions. All honour `prefers-reduced-motion`.
- Shell: sliding active indicator in the sidebar (`layoutId`), softer active
  state, polished restaurant switcher, header with initials avatar.
- Dashboard: animated KPI tiles, a donut chart of today's orders by status
  (SVG, from the existing `getTodayOrdersSummary()`; no new data), richer empty
  state, shimmer skeletons, hover lift on cards.
- Lazy loading: motion features (async `LazyMotion`), the chart
  (`next/dynamic`, `ssr: false` inside a client wrapper, skeleton while
  loading), sections stream through their existing Suspense boundaries.
- Phase 2 (after review): other pages pick up the new shared `Card`, `Button`,
  `Badge`, `Table` styling; any page-specific polish is a follow-up.

## Database and API Changes
None.

## Affected Files
globals.css, lib/design/tokens.ts (+test), components/motion/*, (dashboard)/template.tsx,
dashboard-shell, header, sidebar, sidebar-nav, restaurant-switcher, live-orders-card,
today-orders-card, empty-state, dashboard-section, page-header usage in dashboard page,
ui/skeleton, package.json.

## Implementation Checklist
- [x] Tokens (sage, peach, background)
- [x] framer-motion + motion components
- [x] Page transition template
- [x] Sidebar / switcher / header
- [x] Dashboard cards, chart, empty state, skeleton
- [x] Static checks (tsc, eslint, vitest)
- [ ] Phase 2: per-page polish (after review)

## Testing Plan
tsc, eslint, vitest. Browser check at desktop/tablet/mobile widths only with
the user's permission.

## Decisions and Change History
- 2026-10-31: order trend chart limited to today's orders by status (no trend
  data exists; real trends stay in B5b).
- 2026-10-31: user asked for lazy loading; added to the plan.

## Final Result
(phase 1 done, see chat summary)

## Remaining Issues
(phase 1 done, see chat summary)
