# Shared foundations (B0)

Shared building blocks for the restaurant panel batches B1–B7, built against
PRD v0.3 (`docs/product/foodi-2-restaurant-panel-prd.md` on the PRD branch).
Nothing here talks to a real backend: there is no restaurant (seller) session
and no seller API yet.

## Data sources

| Piece | File | Rule |
|---|---|---|
| Mode | `src/lib/data-source/mode.ts` | Each module has its own variable (e.g. `FOODI_RESTAURANT_DATA_SOURCE`). `preview` (or the existing `fixtures`) turns preview on, **outside production only**. Anything else, and every production build, uses the API. |
| Adapter choice | `selectAdapter()` in `mode.ts` | Picks the API or the preview adapter once. The preview adapter is created only when chosen. Errors from the chosen adapter reach the caller: **no fallback to sample data after an API failure.** |
| Errors | `src/lib/data-source/errors.ts` | `ServiceError` with `not_configured`, `unavailable`, `forbidden`, `not_found`, `conflict` or `validation`. An optional `userMessage` holds wording written for the user (such as a business-rule refusal); it's the only error text the UI ever shows. |
| Action results | `src/lib/data-source/result.ts` | Every Server Action returns `ActionResult`. `runAction()` turns errors into safe user messages; raw error text never reaches the UI. Success carries `preview: true` when simulated. |
| Simulated writes | `src/lib/data-source/preview-store.ts` | In-memory collections for preview mode (G1). Every operation refuses to run in production. Copies on read and write; reset on server restart. |
| API seam | `src/lib/api/transport.ts` | The only way to call the Foodi API. Always `not_configured` today. |
| Idempotency | `src/lib/api/idempotency.ts` | One key per mutation form (PRD §7). |
| Name mapping | `src/lib/api/mapping.ts` | The only place backend enum names appear (G6). |
| Restaurant context | `src/lib/restaurant/context.ts` | Time zone, currency, locale. Preview restaurant in preview mode, `not_configured` otherwise. |

Orders (`FOODI_ORDERS_DATA_SOURCE`, since B1), Menu
(`FOODI_MENU_DATA_SOURCE`, since B2), Hours (`FOODI_HOURS_DATA_SOURCE`,
since B3a), Settings (`FOODI_RESTAURANT_DATA_SOURCE`, the restaurant's own
variable, since B4a) and Reviews (`FOODI_REVIEWS_DATA_SOURCE`, since B6a) all
use `selectAdapter()`. Production refusal and no-fallback
behaviour are covered by tests for each (`src/lib/orders/service.test.ts`,
`src/lib/menu/service.test.ts`, `src/lib/hours/service.test.ts`, `src/lib/reviews/service.test.ts`).

`ApiRequest` has an optional `ifMatch` field for the PROPOSED
optimistic-concurrency header Hours uses; like every API detail, it awaits
backend agreement.

## Preview wording (G1)

- `PREVIEW_ONLY_LABEL` ("Preview only, not saved to Foodi") lives in
  `src/lib/data-source/preview-copy.ts`.
- `PreviewNotice` shows it on any screen with preview data.
- `notify()` / `notifyActionResult()` add it to every simulated success
  automatically. Callers can't leave it out.
- `ActionResultMessage` adds it to inline success messages.
- Success text describes what happened in the preview ("Order accepted"). It
  never says a real order was accepted, cancelled or refunded, or that a menu
  change was saved to Foodi.

## Shared components

| Component | Use |
|---|---|
| `components/shared/confirm-dialog.tsx` | Consequential actions. Stays open, and can't be dismissed, while the server answers. |
| `components/shared/reason-picker.tsx` + `lib/forms/reasons.ts` | Required reason from a module-supplied list plus a note (reject reasons Q9, cancellation §4.3). Same validation on client and server. |
| `components/shared/notifications.tsx` | Toasts, mounted once in the dashboard shell. |
| `components/shared/action-result-message.tsx` | Inline form outcome; `role="alert"` for failures. |
| `components/shared/preview-notice.tsx` | Preview banner. |
| `components/shared/connection-status.tsx` | Live-update state for the order board. |
| `components/ui/{alert-dialog,tabs,switch,radio-group,popover,toast}.tsx` | Standard shadcn source over the existing `radix-ui` package; no new runtime dependencies. |

## Naming (G6)

Frontend models and labels use PRD terms: order types `delivery`, `takeaway`,
`dine_in`, and delivery by `foodi` or `restaurant` (own rider), in
`src/lib/domain/order-types.ts`. Orders uses these since B1.

## Time

- `src/lib/time/format.ts`: shows instants in the restaurant's IANA zone, so
  daylight-saving changes are handled by the zone rules.
- `src/lib/time/windows.ts`: validates "HH:MM" windows for editors (overnight
  windows, 15-minute minimum).
- `src/lib/time/weekly.ts` (B3a): weekdays and labels, per-day merging that
  keeps overnight windows on their start day, per-order-type merging, the
  All-day overlap check and day ranges. Shared by item schedules (Menu
  re-exports them unchanged) and restaurant hours.
- `src/lib/time/calendar.ts` (B3a): calendar dates, the local clock in a zone,
  local midnight and day length (23 or 25 hours on a DST change), for display
  and the preview data source.

None of these evaluate availability; where that evaluation runs is a backend
decision (§9.1).

## Navigation

`src/components/dashboard/navigation.ts` follows the PRD Release 1 module map.
Only built pages are links; the rest show "Soon". POS, QR dine-in and
multi-outlet are left out (Release 2; P1 unresolved). A unit test fails if a
nav link points at a page that doesn't exist.

## Tests

| Command | What |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit and component tests (`src/**/*.test.ts(x)`) |
| `npm run test:e2e` | Builds for production, then runs Playwright with axe accessibility checks (`tests/e2e`) against `next start` on port 3100 and a preview dev server on port 3101. |

Version notes:
- `vitest` is pinned to 4.0.18: 5.x needs `@types/node` 22 or later, and 4.1.x
  crashes npm 10.9 during install.
- `jsdom` is 29.x because 30.x needs Node 22.22.2 or later.
- `@playwright/test` is pinned to 1.56.1 to match the preinstalled Chromium.
- An `overrides` entry keeps a single `playwright-core`.

## Backend contracts later batches depend on (PRD §9.1)

- Seller authentication and session; route guard (AUTH-01). Blocks every real
  mutation.
- API paths and prefix, enum names (`takeaway` vs `pickup`), idempotency key
  format.
- Real-time transport and event payloads (order board, alarm).
- Where availability evaluation runs (the editor's "Next 7 days" preview).
- Refund status reporting (P2: never shown as successful until the provider
  confirms).
- Audit log schema.
