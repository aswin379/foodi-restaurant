# Dashboard UI (B5a)

The `/dashboard` page follows PRD v0.3 (the restaurant's day at a glance),
with the B5a decisions B5-D1 to B5-D6. It only reads. It adds no data source
of its own: every figure comes from an existing module's service (Orders,
Menu, Hours), so there is no second copy of order, menu or hours rules.
Everything below about the API is a **PROPOSAL** awaiting the backend team.

## Sections

The header and the B3a opening status (pause banner, status per order type,
"Manage hours and pause", resume from the dashboard) are unchanged. Below
them:

| Section | Data | Links |
|---|---|---|
| **Live orders** | `getOrderBoard()`, the same data the Orders board shows, counted by status: New, In kitchen, Ready, Out for delivery, Scheduled | Each count goes to its board column: `/orders#board-new`, `#board-kitchen`, `#board-ready` (Ready and Out for delivery share that column), `#board-scheduled` |
| **Needs attention** | Hours (pause), the board (waiting, late, unavailable lines) and the menu (sold-out items) | See "Attention rules" |
| **Recent orders** | `listOrders()` page 1 of 5, any status, newest placement first (B5-D4) | Each reference goes to `/orders/[orderId]`; "See all orders" to `/orders/history` |
| **Today's orders** | `getTodayOrdersSummary()` (B5-D2): orders placed today, by status | The total goes to `/orders/history?from=D&to=D`; each status to the same with `&status=…` |
| **Quick links** | Static | `/orders`, `/menu`, `/hours`, `/settings/profile`, `/settings/orders` |

Removed (B5-D1): the four "—" stat cards (Today's orders, Today's sales,
Pending, Completed), the "Sales & order trends" placeholder and the "Soon"
quick actions. Sales, average prep time, acceptance rate, cancellation
analytics, top items and trend charts are deferred to B5b.

"Live orders" and "Today's orders" answer different questions. A scheduled
order placed yesterday for today is live (on the board) but not one of
today's orders.

## States

Each section is its own Suspense boundary and server component, and loads
and fails on its own. One section failing never hides another.

- **Loading:** a titled card with a skeleton (`role="status"`).
- **Not connected** (`not_configured`, every order section in production
  today): "Live orders aren't connected yet. Nothing is shown until the Foodi
  service is connected." No figures and no links.
- **Permission refused** (`forbidden`): "You don't have permission to see …",
  as an alert, without a retry.
- **Error:** "We couldn't load … Nothing has changed." as an alert, with
  "Try again" (reloads `/dashboard`).
- **Empty:** Live orders shows zeros; Today's orders shows 0; Recent orders
  shows the shared `EmptyState` ("No orders yet"); Needs attention says
  "Nothing needs attention right now."
- **Preview:** sections built from preview data carry a badge naming the
  source: "Preview: sample orders" (Live orders, Recent orders), "Preview
  estimate from sample orders" (Today's orders, worked out from preview
  orders rather than counted by a server), and for Needs attention the
  sources actually in preview (e.g. "Preview: sample hours, orders and
  menu"). The B3a opening status keeps its own preview notice. Attention items from a preview source
  end in "(preview)". A section never mixes preview and server values: each
  figure comes from one module, and each module is either preview or API.
- **Unknown status:** an order status that isn't canonical (or isn't an
  active one on the board) fails that section as an error, never folded into
  another count. The summary mapping refuses unknown, missing or malformed
  counts the same way.

Needs attention handles failures per check: a check that couldn't run is
listed as "Not checked: … (not connected yet / couldn't be loaded / you
don't have permission to see this)". The section never says "Nothing needs
attention right now" unless every check ran; when only some ran it says
"Nothing needs attention in the checks that loaded"; when none ran (as in
production today) it says "These checks couldn't run, so nothing can be
shown yet."

## Attention rules (B5-D3)

Built in `src/lib/dashboard/attention.ts` from module data, using the
Orders module's `orderTiming()` and `NEW_ORDER_ATTENTION_MINUTES` (5,
**provisional**, from B1). No timing rule is re-decided here.

| Alert | When | Link |
|---|---|---|
| New orders are paused | The hours pause state says paused; the description gives the reason, if any | `/hours` |
| N new orders waiting 5 minutes or more | Board orders whose `orderTiming` is `waiting` with `needsAttention` | `/orders#board-new` |
| N orders past the ready time | Board orders whose `orderTiming` is `late` | `/orders#board-kitchen` |
| N active orders have items marked unavailable after placing | Board orders with a line whose server flag `unavailableAfterPlacement` is set (never current sold-out or stock state) | The order, if there's one; otherwise `/orders` |
| N menu items are sold out | The menu list with the `sold_out` filter; the total is its `totalItems`, with up to 3 names | `/menu?filter=sold_out` |

Each alert appears once, lists up to three references or names ("and N
more"), and shows when the checks ran ("Checked at …").

## Refresh (B5-D5)

`src/components/shared/use-visible-refresh.ts` refreshes the page's server
data every 15 seconds (`REFRESH_INTERVAL_MS`, PRD §7 polling fallback) while
the tab is visible:

- hidden tabs don't poll; showing the tab again refreshes once;
- a refresh isn't started while the previous one is still running;
- the timer and listener are removed on unmount;
- it only reads.

The Orders board (B1) used its own copy of this polling. It now uses the
shared hook with the same interval and conditions (only while online), and
gains the in-flight guard. Its behaviour is otherwise unchanged.

## Today's orders: semantics (B5-D2)

- **Date:** the current calendar date in the restaurant's time zone, from
  the shared restaurant context, never the browser's.
- **Counted:** every order *placed* on that date, by its current status,
  including rejected and cancelled ones (payment failures are cancelled
  orders with closure reason `payment_failed`, D4), as long as an order
  record exists.
- **Not counted:** orders placed on an earlier day, even when scheduled for
  today.
- **Preview:** the preview adapter counts its sample orders with the same
  rule (`countOrdersPlacedOn`, by `localDateOf(placedAt, zone)`) and returns
  `source: "preview_estimate"`. The total equals the order history filtered
  to today (unit-tested).

## Proposed API (PROPOSED, for the backend team)

| Method + path | Request | Response |
|---|---|---|
| GET `/seller/orders/summary` | `?date=YYYY-MM-DD` (restaurant-local) | `OrdersDaySummary` (below) |

```ts
type OrdersDaySummaryResponse = {
  /** Must equal the requested date. */
  date: string
  /** The restaurant's IANA zone; must equal the session's. */
  timeZone: string
  /** Every canonical status (PRD §4.1), each a non-negative integer. */
  countsByStatus: Record<"scheduled" | "pending" | "accepted" | "ready" | "out_for_delivery" | "completed" | "rejected" | "cancelled", number>
  /** When the counts were taken (ISO 8601). */
  asOf: string
}
```

The client (`src/lib/orders/api-mapping.ts`) refuses the response, showing
the section's error state, when:

- the date or zone differs from what was asked;
- `asOf` isn't a valid instant;
- a status is unknown or missing;
- a count isn't a non-negative integer.

API data is always marked `source: "server"`.

Unsupported or undecided fields: the backend's status names (canonical names
are assumed; mapping would go in `api-mapping.ts`), sales or money totals
(B5b), and per-order-type breakdowns. None is invented here.

## Backend dependencies (open)

- The summary endpoint above, counted on the server by placement time in the
  restaurant's zone.
- The orders list (`GET /seller/orders`) must be sorted by placement time,
  newest first, for "Recent orders" (the preview does this; the B1 contract
  doesn't state it yet).
- The board, menu sold-out list and pause state as already proposed in
  `docs/orders-ui.md`, `docs/menu-ui.md` and `docs/hours-ui.md`.
- `unavailableAfterPlacement` on order lines, served by the backend (PRD
  §3.10).
- Real-time updates (PRD §7) would replace the 15-second polling.
- The orders API adapter still has no response mapping for the list, board
  and detail (a known B1 gap); only the summary is mapped.

## Preview scenarios

In development with preview data, each source can be put into a state on
its own: `?previewOrders=`, `?previewMenu=`, `?previewHours=` with `empty`,
`error` or `slow`. They only reach the preview adapters, so production
ignores them. (`previewHours` affects the attention check only; the opening
status above is B3a's and unchanged.) None of the preview sources has a
`forbidden` scenario, so the permission state is covered by component tests.

## Provisional values (not approved)

| What | Where |
|---|---|
| New order "waiting" threshold, 5 minutes | `src/lib/orders/timing.ts` (B1) |
| Refresh every 15 seconds | `src/components/shared/use-visible-refresh.ts` |
| Five recent orders | `src/components/dashboard/recent-orders.tsx` |
| Up to three references or names per alert | `src/lib/dashboard/attention.ts` |

## Tests

- **Unit:**
  - placement-date counting across the UTC day boundary;
  - an order scheduled for today but placed earlier is left out;
  - rejected and cancelled orders are counted;
  - the summary mapping's refusals;
  - the API request and its date and zone check;
  - live counts, and their failure on an unknown or closed status;
  - every attention rule, with no duplicates and nothing raised for a
    source that couldn't be read;
  - the service:
    - production refusal and no fallback;
    - live counts match the preview board exactly;
    - preview totals match the history filtered to today;
    - the five recent orders are the newest;
    - pausing and turning an order type off leave orders, the summary,
      menu and weekly hours unchanged.
- **Component:**
  - not connected, permission and error states;
  - preview badges;
  - the refresh hook: interval, no polling while hidden, refresh on show,
    cleanup, disabled.
- **Browser, preview** (read-only, structure and links rather than counts
  that other specs change):
  - every section's labels and link targets;
  - every attention and recent-order link opens a page;
  - a recent order opens its detail;
  - keyboard navigation;
  - the empty scenario;
  - per-section failure isolation;
  - 820 px.

  The general page checks (axe, overflow, console errors) run at 1440 and
  390 px, and the B3a pause and resume test is unchanged.
- **Browser, production:**
  - every order section is not connected, and every attention check is
    listed as not checked;
  - no figures, preview labels or "Soon";
  - scenario parameters are ignored;
  - quick links go to real routes.
