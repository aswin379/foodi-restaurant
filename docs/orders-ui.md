# Restaurant Orders UI (B1)

The Orders screens follow PRD v0.3 §4 (`docs/product/foodi-2-restaurant-panel-prd.md`
on the PRD branch) and use the shared foundations from B0 (`docs/foundations.md`).
No orders API exists yet, so production shows "Orders aren't connected yet".
Every action works only against labelled preview data.

## Routes

| Route | What it is |
|---|---|
| `/orders` | Live board: New → In kitchen → Ready, plus Scheduled |
| `/orders/history` | Searchable, filterable list of all orders (was `/orders` before B1) |
| `/orders/[orderId]` | Order detail with actions, preparation timing, timeline and payment |
| `/print/orders/[orderId]` | Kitchen ticket (KOT) and bill, laid out for printing, outside the dashboard shell |

## Lifecycle (PRD §4)

Statuses: `scheduled` → `pending` (shown as "New") → `accepted` → `ready` →
(`out_for_delivery`) → `completed`; closed as `rejected` or `cancelled`.

- **No `preparing` status.** Preparation is part of `accepted`. Accepting sets
  `preparationStartedAt` to the server's time (D3, Q10 Option A), and there is
  no "Start preparing" action in Release 1.
- **Payment failure is not an order status** (D4). Payment has its own status.
- Rules live in `src/lib/orders/lifecycle.ts`:
  - `availableActions()` decides which actions each order offers.
  - `cancellationCheck()` applies §4.3.
  - `applyOrderCommand()` applies a command or refuses it with `conflict`.

  The same rules drive the UI and the preview adapter. The real backend must
  enforce them itself (P2): hiding a button is never the control.

| Status | Order type | Actions |
|---|---|---|
| scheduled | any | none; moves to New before its slot |
| pending | any | Accept (prep time), Reject (reason) |
| accepted | any | Mark ready, Adjust prep time, Cancel (reason) |
| ready | Foodi delivery | Cancel; waiting for the Foodi rider |
| ready | own-rider delivery | Dispatch (choose rider), Cancel |
| ready | takeaway, dine-in | Complete, Cancel |
| out_for_delivery | own rider | Complete, Cancel (with rider confirmation) |
| out_for_delivery | Foodi rider | none; "Contact Foodi support to cancel it" |
| completed, rejected, cancelled | any | none |

### Cancellation and refunds (P2)

- A reason is mandatory.
- The confirmation states that reserved stock isn't returned, because
  preparation has already started (D3/Q10).
- A paid online order moves to **Refund pending**. Nothing in the UI shows
  **Refunded** until the payment provider confirms it.
- Cancelling an own-rider order that is out for delivery needs a
  confirmation that the rider will be told.
- Foodi-rider orders out for delivery can't be cancelled from the panel.

### Provisional values (not approved)

| What | Where | Status |
|---|---|---|
| Reject reasons | `src/lib/orders/reasons.ts` | PRD Q9, proposed list |
| Restaurant cancellation reasons | `src/lib/orders/reasons.ts` | PRD §4.3 proposal |
| Default prep time 20 min, presets 10–60 | `src/lib/orders/commands.ts` | Until restaurant settings exist (B4) |
| New order flagged after 5 min waiting | `src/lib/orders/timing.ts` | Product default, not in the PRD |
| Board polling every 15 s | `src/components/orders/orders-board.tsx` | PRD §7 fallback until real-time transport exists |

## Live board

- Three columns (New, In kitchen, Ready) plus a Scheduled lane. On phones the
  columns stack, with jump links and counts.
- Out-for-delivery orders appear in Ready with an "Out for delivery" badge.
- Each card shows a live timer:
  - waiting time for New orders (amber after 5 minutes)
  - time left in the kitchen, or "Late by …" in red
  - time to a scheduled slot
- Lines marked unavailable after placement are flagged (§3.10). The kitchen
  ticket shows the flag too.
- **New-order alarm:** a banner (only its border pulses, and not with reduced
  motion) until the orders are acknowledged.
  - Sound is opt-in through the "Alarm sound" toggle, because browsers block
    sound that plays by itself. The chime is generated in the browser.
  - Phones vibrate once the page has had a tap.
  - Acknowledging is per browser tab.
- The board re-fetches every 15 seconds while the tab is visible and shows
  "Updating every 15 s", or "Offline" when the browser is offline.
- Mark ready and Complete are one tap; every other action opens a dialog.

## Data sources

`src/lib/orders/service.ts` uses the shared `selectAdapter()` from B0:

- **Default: API** (`api-source.ts`). Every call goes through the shared
  transport, which reports `not_configured`.
- **Preview** (`preview-source.ts`) is an explicit development opt-in:
  `FOODI_ORDERS_DATA_SOURCE=preview npm run dev`. The older value `fixtures`
  also works.
  - Refused in production, even with the variable set.
  - Orders live in the B0 in-memory preview store. Commands really change
    them within the preview server, nothing reaches Foodi, and everything
    resets on restart.
  - Repeating a request with the same idempotency key returns the stored
    result instead of applying the command twice.
  - Every screen shows "Preview only, not saved to Foodi", and so does every
    success notification. Printed tickets are stamped "Preview · sample data
    · not a real order".
  - References start with `PRV-`. Customers are "Preview customer NN", riders
    "Preview rider A/B", addresses "Preview address · not a real location".
  - Preview tools on the board: **Simulate a new order** (to try the alarm)
    and **Reset sample orders**. Their Server Actions refuse to run outside
    preview mode.
  - `?preview=empty|error|slow` shows the empty, error and loading states.
- **No fallback.** If the API errors, the UI shows an error with "Try again".
  It never shows preview data instead.

Server Actions (`src/app/(dashboard)/orders/actions.ts`) treat all input as
untrusted:
- They check the order id and idempotency key.
- They parse the command (`parseOrderCommand`), including reason and
  prep-time validation.
- They let the data source apply the lifecycle rules.
- They then refresh the route.

## Proposed API contract (PROPOSED, for the backend team)

None of these endpoints exist. They're listed in `api-source.ts`. Paths, the
prefix and enum names are §9.1 decisions. Every call is scoped to the
restaurant in the session and never takes a restaurant id from the client.

| Method + path | Request | Response |
|---|---|---|
| GET `/seller/orders` | `status`, `q`, `from`, `to` (restaurant-local dates), `page`, `pageSize` | `{ items: OrderSummary[], page, pageSize, totalItems, totalPages }` |
| GET `/seller/orders/board` | none | active `OrderDetail[]` |
| GET `/seller/orders/:id` | none | `OrderDetail`, or 404 for unknown or other-restaurant orders |
| POST `/seller/orders/:id/commands` | an `OrderCommand` (`src/lib/orders/commands.ts`) plus an idempotency key | updated `OrderDetail`; 409 if the command doesn't fit the current state; 422 with field errors |
| GET `/seller/riders` | none | `Rider[]` (own riders, for Dispatch) |

Field shapes are in `src/lib/orders/types.ts`. The backend also needs to
provide:
- `preparationStartedAt` and `readyBy` set from server time
- refund status that changes to refunded only on provider confirmation
- the audit trail behind the timeline
- an ETag or version for concurrent updates
- real-time order events

## Deferred

- **Order editing** (§4.3): the contract is undefined.
- **Pickup-code check on Complete:** needs the restaurant setting (B4).
- **Auto-accept:** settings, B4.
- **Real-time transport and push notifications:** §9.1.

## Tests

- **Unit** (`npm test`):
  - lifecycle table and transitions, including refunds, stock and rider
    confirmation
  - command parsing
  - timers
  - history query
  - the preview adapter: board contents and order, idempotent replay, history
    filters, simulate/reset, scenarios, production refusal
  - the service: production refusal, no fallback, preview-only controls
- **Browser** (`npm run test:e2e`):
  - **Production build:** every Orders route and the print view show "not
    connected" with no sample data or preview tools.
  - **Preview, at desktop and mobile:**
    - accept with a prep time, by mouse and by keyboard alone
    - reject needing a reason and a note for Other
    - cancel with stock and refund wording, and refund shown as pending
    - Foodi-rider orders can't be cancelled
    - own-rider cancel needs confirmation
    - mark ready, then dispatch
    - adjust prep time
    - the simulated new-order alarm and acknowledgement
    - the sound toggle
    - a double click applies once
    - every page passes axe (serious and critical), has no horizontal
      overflow, and logs no console errors
