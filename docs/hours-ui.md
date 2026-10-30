# Restaurant Hours, Special Dates and Pause UI (B3a)

**Preview-mode implementation** of PRD v0.3 §3.3 with the owner's decisions
H2–H9, P-1 and P-2.
- No hours API exists, so production shows "Hours aren't connected yet".
- Every change works only against labelled preview data in development: `FOODI_HOURS_DATA_SOURCE=preview`.
- **Every endpoint, header, payload, event and response shape below is PROPOSED** and awaits backend agreement. None of it exists.

B3b (meal periods, category schedules, the item "Meal period" option and
restaurant-hours warnings) is separate.

## Routes

| Route | What |
|---|---|
| `/hours` | Pause control (or the pause banner), the weekly hours editor (tabs per order type) and the "New orders right now" status card |
| `/hours/special-dates` | Upcoming special dates (add, edit, remove) and past ones (read-only) |
| `/dashboard` | Pause banner while paused, and the status card, above the existing overview |

The sidebar's "Availability & hours" item now links to `/hours`.

## Weekly hours (H2, H8)

- **One tab per order type:** Delivery, Takeaway and Dine-in. Each day is closed, **All day** (local midnight to midnight), or open in up to 6 windows.
- **All day vs windows:** All day is stored as `allDay: true`, never as `00:00–00:00` or `00:00–23:45`. All day plus a timed window for the same order type and day is refused as redundant.
- **Overnight windows:** an end before the start is overnight and belongs to its start day, including Sunday into Monday. The editor says so ("Runs past midnight into Saturday, ending at 02:00").
- **Saving:** overlapping or touching windows are merged when saved, and days with identical hours are grouped. A "Saves as" summary shows the result.
- **Helpers:**
  - **Copy {day} to…** replaces the chosen days' hours within the order type; "All other days" copies to the whole week.
  - **Same as delivery** (Takeaway and Dine-in tabs) replaces that order type's week with delivery's, after confirmation.
- **Validation:** the same rules run in the browser and on the server (`src/lib/hours/weekly-hours.ts`). The error summary links to each field and switches to the right tab.
- **Warning only:** an order type closed every day gets a warning that doesn't block saving.

## Special dates (H3, H4)

- **What one is:** one calendar date in the restaurant's zone, for one or several order types. It's either **Closed** or has **Special hours** (All day or windows, overnight allowed) and an optional note.
- **Scope:** it replaces the weekly hours on that date for the chosen order types only; other order types keep their weekly hours.
- **Individual dates only:** there are no yearly recurring holidays in this release.
- **Duplicates:** one special date per date and order type. A second one is refused, naming the order types (contract: `409 duplicate_special_date`).
- **Dates:** today (the restaurant-local date, decided by the server) or later. Past special dates are listed read-only, with no edit controls; edits and removals are refused by the server too.
- **Clock changes:** if the date has one in the restaurant's zone, the dialog says the day is 23 or 25 hours long. This is display only; the backend applies the clock-change rules.
- **H4 is unresolved.** When the previous day has an overnight window for an affected order type, the dialog states the overlap neutrally: "Delivery: the Friday window 18:00–02:00 (+1 day) crosses into this date. How an overnight window combines with a special date is being confirmed with Foodi."
  - No validation, estimate or guarantee depends on the proposed rule.
  - The preview estimate reports these moments as "Not confirmed".

## Pause (H5, P-1, P-2)

- **Scope:** restaurant-wide; it stops new immediate orders for delivery, takeaway and dine-in.
- **Durations:** 15 minutes, 30 minutes, 1 hour, **Rest of today (until midnight)**, or until resumed. Reason optional (≤ 200 characters).
- **Resume time (P-1):** the server works out when the pause ends.
  - "Rest of today" ends at the next local midnight in the restaurant's zone, DST-correct, and never runs into the next day.
  - The UI shows the server's local time and zone, e.g. "Restaurant paused until 00:00, Sun 25 Oct (Asia/Kolkata)", from `untilLocal`. The browser never calculates it.
- **Existing orders:** a pause never changes or cancels accepted or scheduled orders. The UI performs no order changes.
- **Scheduled orders (P-2):** the UI makes no claim about them unless the server reports `scheduled` for an order type. The preview never does (`scheduled: null`).
- **Audit:**
  - Resuming records who did it.
  - Automatic expiry is recorded as `{ kind: "system" }` and shown as "Foodi (automatically)".
  - The banner re-asks the server when the end time passes; it never assumes the pause ended.

## Status ("New orders right now")

- **What it shows:** per order type, the immediate-order state (Open, Closed, Paused) and reason (weekly hours, special date, restaurant paused, no hours set, open all day), plus `until` and `nextOpening` when the server sends them.
- **Production:** only the server's status (`GET /seller/availability/status`, proposed). Nothing is calculated in the browser.
- **Preview:** `src/lib/hours/status-estimate.ts` runs on the preview server only. It's labelled "Preview estimate: not Foodi's live availability". It:
  - reports H4 overlaps as "Not confirmed"
  - never reports scheduled orders
  - doesn't calculate `until` or `nextOpening`

## Data sources

Same pattern as Orders and Menu (`docs/foundations.md`):

- **API (default, the only mode in production):** `src/lib/hours/api-source.ts` uses the proposed paths below.
  - Today the transport reports `not_configured`, so the pages show "Hours aren't connected yet".
  - A `403` is shown as a permission message; other errors as a retryable error state.
  - Never falls back to sample data.
- **Preview** (`FOODI_HOURS_DATA_SOURCE=preview`, development only): `src/lib/hours/preview-source.ts` keeps labelled sample hours, special dates and pause in the in-memory preview store.
  - Commands go through the same rules as the server would apply (`src/lib/hours/rules.ts`): version checks, past dates, duplicates, pause state and idempotent replay.
  - Simulated saves are labelled "Preview only, not saved to Foodi".
  - "Reset sample hours" restores the sample data.
  - `?preview=empty|error|slow` shows those states.
  - Refused in production even when the variable is set.

## Proposed API contract (PROPOSED, for the backend team)

PRD §3.7 names `PUT /seller/hours`, `POST /seller/pause`, `DELETE /seller/pause` and the `restaurant.paused` / `restaurant.resumed` events. Everything else is proposed here. Prefix and enum names are PRD §9.1 decisions.

| # | Method + path | Origin | Success | Errors |
|---|---|---|---|---|
| A1 | `GET /seller/hours` | Proposed | `WeeklyHours` | 403 |
| A2 | `PUT /seller/hours` + `If-Match`, `Idempotency-Key` | PRD §3.7 (payload proposed) | stored, merged `WeeklyHours` with a new version | 422 field errors, 409 `version_conflict` (+ `current`), 409 `idempotency_conflict` |
| A3 | `GET /seller/hours/special-dates` | Proposed | `SpecialDate[]` (recent past with `editable: false`, then upcoming) | 422 range |
| A4 | `POST /seller/hours/special-dates` + `Idempotency-Key` | Proposed | 201 `SpecialDate` | 422, 409 `duplicate_special_date`, 409 `past_date` |
| A5 | `PATCH /seller/hours/special-dates/:id` + `If-Match` | Proposed | `SpecialDate` | 404, 409 `past_date` / `duplicate_special_date` / `version_conflict` |
| A6 | `DELETE /seller/hours/special-dates/:id` + `If-Match` | Proposed | 204 | 404, 409 `past_date` / `version_conflict` |
| A7 | `GET /seller/pause` | Proposed | `PauseState` | 403 |
| A8 | `POST /seller/pause` `{ duration, reason }` + `Idempotency-Key` | PRD §3.7 (payload proposed) | `PauseState` with server-calculated `until` and `untilLocal` | 422 duration, 409 `already_paused` (+ `current`) |
| A9 | `DELETE /seller/pause` + `Idempotency-Key` | PRD §3.7 | `{ paused: false, lastResumedAt, lastResumedBy }` (idempotent) | 403 |
| A10 | `GET /seller/availability/status` | Proposed | `AvailabilityStatus` (`source: "server"`) | 403 |

Shapes are the TypeScript types in `src/lib/hours/types.ts`; the full request and response examples are in the B3a specification (v2).

**Common rules (proposed):**

- **Order types:** names appear as record keys (`byOrderType`) and values (`orderTypes`). Both go through `src/lib/api/mapping.ts` (`src/lib/hours/api-mapping.ts`).
- **Strict reading:** an unknown or missing order type, unknown weekday, malformed time, unknown actor or the preview-only `unresolved` state in a response is an integration error (`unavailable`), never guessed.
- **Idempotency:** a repeated key with the same body replays the result; with a different body it's a conflict.
- **Versions:** `If-Match` carries the version (`ApiRequest.ifMatch`). A stale version is refused, and nothing is overwritten silently.
- **Audit:** `Actor` is `{ kind: "staff", staff }` or `{ kind: "system" }` for automatic changes.
- **Clock:** the server decides today, past dates and pause expiry; status carries `asOf`.

## Backend dependencies (blockers for production)

| # | Dependency | Blocks |
|---|---|---|
| B-2 | **H4:** confirm how an overnight window from the previous day combines with a special date, per order type, for closed and special-hours dates, with DST. The questions are in the B3a specification §6. | Anything beyond the neutral note: validation, estimates, explanations |
| B-3 | **P-2:** confirm checkout reliably distinguishes immediate and scheduled orders, and validates scheduled orders during a pause. If it can't, a contract decision is needed. | Any statement about scheduled orders during a pause |
| B-4 | Agreement on endpoints A1–A10, payloads, `If-Match`, idempotency, error bodies, `Actor`, `untilLocal`, `editable` | Production |
| — | The availability evaluator (weekly hours, All day, overnight ownership, special dates, DST, pause) | Live status |
| — | Pause expiry job; audit records; owner authorization (H9) | Production |
| — | Events `restaurant.hours_updated`, `restaurant.special_date_changed` (proposed) and real-time transport; the UI re-asks the server on page load and at pause expiry meanwhile | Live refresh |

A PRD update recording P-1, P-2 and (once confirmed) H4 needs separate approval.

## Not in B3a

- Meal periods, category schedules, the item "Meal period" option and restaurant-hours warnings (B3b).
- Last-order time and order-ahead settings (Scheduled orders batch, H7).
- Yearly recurring holidays, seasonal ranges, size/option schedules, slot capacity.
- QR tables, POS and other R2 features; staff roles.

## Tests

- **Unit** (`npm test`):
  - **Shared helpers** (`src/lib/time/weekly.test.ts`): overnight windows, including Sunday into Monday; overlap merging; the 24-hour cap; per-order-type merging; All-day overlap.
  - **Calendar** (`src/lib/time/calendar.test.ts`): restaurant-zone clock, local midnight and 23/25-hour DST days in Europe/London.
  - **Weekly hours:** validation, All-day conflicts, merging and grouping, copy and Same-as helpers, untrusted input, round trips.
  - **Special dates:** past and duplicate refusals, special hours needing times, merging; H4 overlap detection only.
  - **Rules:**
    - version conflicts, past-date refusals, add/edit/remove
    - pause durations; "rest of today" at local midnight in Kolkata and on a London DST day, never past the next local midnight
    - already-paused refusal and idempotent resume
    - expiry recorded as `system`
  - **Status estimate:** reasons; overnight tails; H4 "unresolved"; pause; no scheduled-order claims; restaurant zone.
  - **Command parsing** of untrusted input.
  - **API mapping:** with a stand-in `takeaway` → `pickup` name, record keys and values both ways, unknown/missing order types refused, scheduled `null` kept, status always `server`, proposed paths, `If-Match` and idempotency keys.
  - **Service:** production refusal, no fallback, preview persistence and reset, idempotent replay and key conflicts.
- **Browser** (`npm run test:e2e`):
  - **Production** (desktop, tablet, mobile):
    - `/hours`, `/hours/special-dates` and the dashboard show "Hours aren't connected yet"
    - no preview tools, editor, pause control, estimate or sample data
    - the nav includes `/hours`
  - **Preview** (desktop, mobile):
    - overnight note, merging, the All-day conflict and save
    - an error on another tab, reached from the summary
    - Same as delivery and Copy to all days
    - special dates: duplicate refused, past read-only, the neutral H4 note, edit and remove
    - pause until midnight shows the server's time and zone; banner on the dashboard; resume; no scheduled-order claim
    - the pause dialog by keyboard, with Escape changing nothing
    - axe, overflow and console checks on `/hours`, `/hours/special-dates` and the dashboard
