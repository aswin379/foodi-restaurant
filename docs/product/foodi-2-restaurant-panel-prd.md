# Foodi 2.0: Restaurant Panel Product Requirements

**Status: WORKING DIRECTION.** Approved as the product direction, **not frozen**. Version 0.3, 2026-10-23.

This is Foodi's own design. StackFood (the legacy source) and MenuThere were studied as references only; nothing here is copied from either. Decisions are tracked in the decision record below. Anything not listed there as **Approved** is still a proposal.

---

## Decision record

### Approved (working direction)

| ID | Decision | Section |
|---|---|---|
| A1 | **Layered availability engine:** restaurant status → business hours → date exceptions → category → item → size/option → sold-out window → stock. Effective availability is the **intersection** of every applicable restriction. | 3.1 |
| A2 | **Restaurant-local scheduling:** several windows per day, overnight windows, holiday/date exceptions, reusable meal periods, IANA time zone per restaurant, **correct handling of daylight-saving transitions** | 3.2, 3.3 |
| A3 | **Menu model:** categories, items, sizes/variants, option groups with configurable selection rules, archive instead of permanent delete | 5 |
| A4 | **Secure order lifecycle:** server-authoritative transitions, prep-time input on acceptance, rejection reasons, distinct handling for delivery, takeaway and dine-in | 4 |
| A5 | **Atomic placement:** availability and stock are validated atomically when an order is placed, with availability, inventory, acceptance and stock reservation kept as separate concepts | 3.9 |

### Recommended, awaiting final confirmation

| ID | Question | Recommendation | Section |
|---|---|---|---|
| P1 | POS and QR dine-in | **Release 2.** Keep the architecture extensible now; don't delay the initial ordering launch. | 1 |
| P2 | Can restaurants cancel accepted orders? | **Yes, with restrictions.** Reason required, audit event recorded, explicit rules for refunds and for orders already preparing or dispatched. | 4.3 |
| P3 | Unavailable items: grey out or hide? | **Grey out by default**, with a restaurant-level setting to hide. Show the next availability time only when it can be calculated reliably. | 3.4, 3.6 |

### Resolved in v0.3 (PRD consistency decisions)

These resolve the seven internal inconsistencies found in the v0.2 reconciliation.

| ID | Issue in v0.2 | Resolution | Sections updated |
|---|---|---|---|
| D1 | §8 said cancellation after acceptance goes "via support"; §4.2/§4.3 said the restaurant cancels | One rule everywhere: restaurant cancellation after acceptance follows §4.3 **if P2 is confirmed**. Until then §4.3 remains the proposal and no other section contradicts it. | 4.1, 8 |
| D2 | §4.1 listed cancellation actors without the restaurant | `cancelled` can come from the customer, the restaurant (subject to P2), Foodi support or the system | 4.1 |
| D3 | §4.3's "not yet preparing" had no recorded state in R1 | Every order records **`preparationStartedAt`** (UTC instant). In R1 it is set automatically at acceptance (**Q10 confirmed, Option A**), so stock is not returned when the restaurant cancels an accepted order. Rules in §4.1. | 4.1, 4.3 |
| D4 | `failed` (payment) appeared as an order state | **Payment failure stays on the payment, not the order status.** An online order whose payment fails or times out is closed as `cancelled` with system reason `payment_failed`, and never reaches the restaurant's New column. | 4.1, 3.9 |
| D5 | §1 vs §3.2/§3.3 release tags for holidays and per-channel hours | **R1:** core restaurant hours (per order type, several windows, overnight), pause, and **restaurant-level date exceptions** (holidays and special hours). **Advanced scheduling** (seasonal date ranges, item/category date exceptions, size/option schedules, slot capacity) to be confirmed separately, tentatively R2. | 1, 3.2, 3.3 |
| D6 | Whether availability is re-checked at acceptance (§3.1 vs §3.8 vs §3.9) | **Scheduled orders:** revalidated at acceptance (as §3.9). **Ordinary orders:** availability and price are guaranteed at placement (atomic, §3.9). Later changes don't invalidate a placed order automatically; the operational exception policy is in §3.10. | 3.1, 3.8, 3.10 |
| D7 | Whether "category required" was approved | **Category is mandatory for every active menu item.** Archived items keep their last category for history. | 2, 5 |

### Still open
- **P2** and **P3** (confirmation).
- Section 9: Q1 (rest of the release split), Q4 (channel pricing), Q5 (withdrawals), Q6 (multi-outlet scope), Q7 (payment timeout), Q8 (cancellation-rate policy) and Q9 (reject reasons). Q10 is confirmed (§4.1).
- The backend contracts in §9.1.

---

## 0. Product principles

1. **Real-time first.** New orders, status changes, stock and availability update live, with no refresh needed.
2. **One restaurant, many surfaces.** The same rules apply in the panel, POS, kitchen display, customer app/web and QR dine-in.
3. **Configurable, not hard-coded.** Each restaurant can switch behaviours on or off (auto-accept, prep-time prompts, order types, cancellation rules) within platform limits.
4. **Fast on a phone.** Every daily task (accept an order, mark a dish sold out, change hours) takes three taps or fewer at 390 px.
5. **Safe by design.**
   - State changes only through authenticated POST/PATCH with CSRF protection and server-side rules. **No state changes through plain links**, which was a StackFood flaw.
   - Tenant isolation: every query is scoped to the restaurant in the session.
   - An audit log on every change.
6. **Honest UI.** Nothing claims to be saved until the server confirms it. Optimistic updates roll back visibly on failure.
7. **Accessible and multilingual.** WCAG 2.2 AA. Every customer-facing text field has translations.
8. **API-first.** Every panel action exists in the API, with webhooks for integrations.

---

## 1. Module map and release plan

| # | Module | R1 (launch) | R2 | R3 |
|---|---|---|---|---|
| 1 | Auth and account | Sign-in, sessions, password reset, owner activation | 2FA, device list | SSO for chains |
| 2 | Dashboard | Today's KPIs, live order counts, alerts | Trends, top items | Custom widgets |
| 3 | Live orders and order management | Live board, accept/reject, status flow, order detail, edit, search and history | Auto-accept, bulk actions | Smart prep-time suggestions |
| 4 | Menu | Categories, items, sizes, option groups, images, dietary tags, channel visibility | Reusable option groups, bulk edit, import from CSV | AI import from photo/PDF |
| 5 | **Availability and hours** (section 3) | Store hours per order type (several windows, overnight), pause, restaurant holidays and special dates, item/category schedules, meal periods, sold-out-until (D5) | Advanced scheduling, to be confirmed: seasonal ranges, item/category date exceptions, size/option schedules, slot capacity | Auto rules (stock or demand) |
| 6 | Stock | Manual sold-out | Daily stock counts, auto sold-out | Ingredient-level inventory |
| 7 | Scheduled orders | Order-ahead slots, prep reminders | Capacity per slot | Catering / large-order lead times |
| 8 | Kitchen display (KDS) and printing | Kitchen tickets (KOT) and bill print | KDS screen, station routing | Prep timers, bump bar |
| 9 | Delivery | Foodi delivery handover, tracking view | Own riders, rider assignment | Third-party couriers |
| 10 | POS (counter) | — | Counter orders, cash/card/UPI, receipts | Split bills, offline mode |
| 11 | Dine-in and QR | — | QR table ordering, tables, second rounds | Table booking, captain app |
| 12 | Promotions | Coupons | Item offers, BOGO, happy hour (time-based), auto-apply | Loyalty points |
| 13 | Reviews | View and reply | Review alerts, Google reviews | Sentiment insights |
| 14 | Customers | Order history per customer (masked contact details) | Segments, export | Campaigns (WhatsApp/SMS) |
| 15 | Notifications | New-order alarm, push, email | WhatsApp order updates | Custom templates |
| 16 | Reports and analytics | Sales, orders, items, tax | Payouts, promotions, hour-of-day heatmap | Forecasting |
| 17 | Wallet, settlements and payouts | Earnings, settlements list | Withdraw requests, statements | Instant payouts |
| 18 | Restaurant settings | Profile, address and map pin, logo/cover, order types, prep defaults, tax, packaging | Payment methods, QR code, receipts | Custom domain / storefront |
| 19 | Plans and billing | Current plan, commission or subscription | Upgrade/downgrade, invoices | Add-ons marketplace |
| 20 | Staff and roles | Owner plus staff, preset roles | Custom roles with per-module permissions | Shift / login audit |
| 21 | Multi-outlet | — | Several outlets per owner, outlet switcher | Head-office menu sync, chain reports |
| 22 | Support | Help centre links, contact support | In-panel chat | — |
| 23 | Integrations and API | Webhooks (order events) | Public API, POS sync | Marketplace aggregators |
| 24 | AI assistance | — | Dish description and translation helper | Menu import, demand insights |

**Already built (UI only):** Login (PR #1), dashboard shell (PR #2), orders list and detail (PR #3), and menu, items and categories (RUI-03, uncommitted). Section 8 covers how they change under this spec.

---

## 2. Core data model (proposed)

```
Owner (account) ─┬─ Restaurant ─┬─ Outlet (R3 multi-outlet; R1 = one outlet per restaurant)
                 │              ├─ StaffMember ── Role ── Permission[module × action]
                 │              ├─ BusinessHours, OrderTypeSettings, TaxSettings
                 │              ├─ Menu
                 │              │    ├─ Category ── (optional) Subcategory  [max 2 levels]
                 │              │    │     └─ AvailabilityRule[]
                 │              │    └─ Item
                 │              │          ├─ Size[]            (pick exactly one; replaces price)
                 │              │          ├─ OptionGroup[]     (choices / add-ons; reusable in R2)
                 │              │          │     └─ Option[]    (adds to price)
                 │              │          ├─ AvailabilityRule[] + SoldOut state
                 │              │          ├─ ChannelSettings   (delivery / takeaway / dine-in: visible, price)
                 │              │          └─ Stock (R2)
                 │              ├─ Order ── OrderLine[] ── selected Size/Options (snapshot)
                 │              │     ├─ StatusEvent[] (timeline + actor + reason)
                 │              │     ├─ Payment[] / Refund[]
                 │              │     └─ Delivery (handover, rider, tracking)
                 │              ├─ Promotion[], Review[], Settlement[], Payout[]
                 │              └─ AuditLog[]
```

Notes:
- **Money** is an integer in minor units plus a currency, with prices tax-inclusive or tax-exclusive per restaurant setting.
- **Order lines snapshot** names, sizes, options and prices at order time, so later menu edits never change past orders.
- **Every active item** belongs to exactly one category (mandatory, D7). Items are archived, not hard-deleted, once they appear on any order. Archived items keep their last category for history.

---

## 3. Time availability settings (every product)

**Goal:** a restaurant controls *when* each product can be ordered, at every level, with a model that is easy to set on a phone and safe to evaluate on the server.

### 3.1 Levels and precedence

An item is orderable at time *T*, for channel *C* (delivery, takeaway or dine-in), only if **every** level allows it:

| Level | What it controls | Example |
|---|---|---|
| 1. Restaurant open state | Manual "Pause new orders" switch, with an optional resume time | Paused for 30 min (kitchen overloaded) |
| 2. Business hours | When the restaurant accepts orders at all, per channel | Delivery 11:00–23:00; dine-in 12:00–15:00 and 19:00–23:00 |
| 3. Holiday / special-date exceptions | Overrides for specific dates | Closed 25 Dec; Diwali 17:00–01:00 |
| 4. Category schedule | When a whole section shows | "Breakfast" 07:00–11:00 |
| 5. **Item schedule** | When this product can be ordered | "Thali" weekdays 12:00–15:30 |
| 6. Size / option schedule (R2) | One size or option at certain times | "Family size" only after 18:00 |
| 7. Sold-out state | Temporary manual or automatic stop | Sold out until tomorrow's opening |
| 8. Stock (R2) | Count reaches 0 → sold out | 20 biryanis per day |

- **Evaluation:** the server checks every level atomically at checkout (§3.9). Scheduled orders are checked again at activation and acceptance. For ordinary orders, availability changes after placement are handled by the exception policy in §3.10, not by automatic re-validation (D6). The UI shows each result with a reason.
- **Narrowing only:** lower levels can only narrow availability, never widen it. An item scheduled 06:00–10:00 in a restaurant that opens at 07:00 is effectively available 07:00–10:00, and the editor warns about the gap.

### 3.2 Schedule model (shared by restaurant, category, item, size and option)

```ts
type AvailabilitySchedule = {
  mode: "always" | "custom"            // "always" = follows the parent level
  timeZone: string                     // restaurant's IANA zone, e.g. "Asia/Kolkata"
  weekly: Array<{
    days: Weekday[]                    // ["mon","tue",…]
    windows: Array<{ start: "HH:MM"; end: "HH:MM" }>   // several per day; end < start means overnight
  }>
  dateRange?: { from: "YYYY-MM-DD"; to?: "YYYY-MM-DD" }  // seasonal items (R2)
  exceptions?: Array<{                 // specific dates: R1 for the restaurant; items/categories to be confirmed (D5)
    date: "YYYY-MM-DD"
    closed?: boolean
    windows?: Array<{ start: "HH:MM"; end: "HH:MM" }>
  }>
  channels?: Array<"delivery" | "takeaway" | "dine_in">  // which channels this schedule applies to; default all
}

type SoldOutState =
  | { state: "available" }
  | { state: "sold_out"; until: "next_opening" | "end_of_day" | "manual" | { at: ISODateTime };
      reason?: string; by: StaffRef; since: ISODateTime }
```

**Rules:**
- **Overnight windows:** `22:00–02:00` on Friday belongs to Friday's service and runs into Saturday 02:00.
- **Overlapping windows** on the same day are merged when saved. The editor shows the merged result.
- **Minimum window:** 15 minutes. Times are in 15-minute steps in the picker, while the API accepts any minute.
- **Time zone:** every rule uses the restaurant's IANA time zone (e.g. `Asia/Kolkata`, `Europe/London`), never the device's or the server's. Stored local times are evaluated with the zone's rules for that date, never with a fixed UTC offset.
- **Daylight-saving transitions** (only relevant for zones that observe DST):
  - *Spring forward (gap):* a window boundary that falls in the skipped hour moves forward to the first valid instant. For example, an 02:30 start becomes 03:00 if 02:00–03:00 doesn't exist that day.
  - *Fall back (repeated hour):* a window boundary in the repeated hour uses its **first** occurrence for starts and its **second** occurrence for ends, so a window never shrinks.
  - Window durations are computed on real elapsed time. A 22:00–02:00 window on a fall-back night is 5 hours long.
  - Countdowns, prep timers, "sold out until" times and scheduled slots are stored as UTC instants plus the zone, and converted to local time only for display.
  - The evaluator has explicit tests for both transitions in at least one DST zone (e.g. `Europe/London`, `America/New_York`), even though launch markets may not observe DST.
- **Exceptions:** an exception date replaces that day's weekly rule.
- **Date range:** outside it the item is hidden or shown as "Not available" (a per-item choice; see 3.4).

### 3.3 Restaurant-level settings (Settings → Hours)

- **Weekly business hours** per channel, with several windows per day ("Copy to all days" and "Same as delivery" helpers).
- **Holidays and special dates (R1):** closed, or special hours, for the whole restaurant or one order type.
- **Pause new orders:** 15 min / 30 min / 1 h / rest of today / until I resume. It auto-resumes and is shown prominently on the dashboard.
- **Last order time:** stop new orders *N* minutes before closing (default 0).
- **Order-ahead (scheduled orders):** allowed or not; minimum lead time (e.g. 45 min); how far ahead (e.g. 7 days); slot length (15/30/60 min); capacity per slot (R2). Customers can pre-order while the restaurant is closed if enabled.

### 3.4 Product-level settings (Menu → item → **Availability** card)

| Setting | Options | Default |
|---|---|---|
| Available now | On / Off (sold-out shortcut with a "until" picker) | On |
| Schedule | **Always (follows restaurant/category hours)** · Meal periods (preset chips: Breakfast, Lunch, Snacks, Dinner, Late night; editable per restaurant) · Custom days and times | Always |
| Channels | Delivery / Takeaway / Dine-in toggles; optional channel price | All on |
| Season | Date range (from / to) (R2) | None |
| Outside schedule | **Show greyed out** (with "Available from …" when reliably known, see 3.6) · Hide from menu. Restaurant-level default, overridable per category/item (P3). | Show greyed out |
| Advance notice | Requires *N* hours' notice: orderable only as a scheduled order (cakes, catering) (R2) | None |
| Daily stock | Count per day, reset at opening; auto sold-out at 0 (R2) | Unlimited |

Category-level settings mirror the item card: on/off, schedule, channels, and outside-schedule behaviour. A category schedule applies to all its items unless an item narrows it further.

**Meal periods** are restaurant-defined named schedules ("Lunch = Mon–Sat 12:00–15:30"), so changing one period updates every item using it. This is the main time-saver for large menus.

### 3.5 Panel UI behaviour

- **Menu list:**
  - an availability column showing **Available**, **Scheduled (12:00–15:30)**, **Outside hours**, **Sold out until 18:00** or **Hidden (season)**
  - a filter for each state
  - a one-tap sold-out toggle on each row
- **Item editor:**
  - a schedule builder showing days as chips and windows as time ranges, with add/remove window
  - a live preview: "Next 7 days: Mon 12:00–15:30, …"
  - a warning when the item is never orderable because of restaurant hours
- **Bulk:** select several items, then "Set schedule" or "Mark sold out until…" (R2).
- **Dashboard banner:** "3 items sold out · Restaurant paused until 19:30".
- **Audit:** every availability change is logged with who and when, and the sold-out reason is optional.

### 3.6 Customer-facing behaviour (apps / web / QR)

- **Items outside their window:** greyed out by default (P3), or hidden per restaurant setting. They can't be added for immediate orders.
- **"Next available" text** is shown only when the server can calculate it reliably:
  - it lies within the next 7 days
  - it's determined by schedules only, not by a manual "sold out until I switch it back" or by stock
  - the restaurant isn't paused indefinitely

  Otherwise the item just says "Currently unavailable". Examples: "Available from 12:00 today", "Available tomorrow from 07:00".
- **Scheduled order slots:** when a customer picks a slot, the menu re-evaluates for that slot's time and channel.
- **Cart changes:** if the cart becomes invalid (time passed, sold out, channel switched), checkout lists the affected lines and offers to remove them. The server re-validates when the order is placed.
- **Restaurant closed or paused:** a "Closed now · opens 11:00" or "Not accepting orders right now" banner, plus pre-order if enabled.

### 3.7 API (proposed)

- **Menu responses** include each item's `availability` (schedule, sold-out state, channels) and a computed `availableNow` and `nextAvailableAt`, for the restaurant's time zone and the requested channel.
- **Panel endpoints:**
  - `PATCH /seller/menu/items/:id/availability` (schedule, channels, outside-schedule mode)
  - `POST /seller/menu/items/:id/sold-out` with `{ until, reason }`, and `DELETE /seller/menu/items/:id/sold-out`
  - the same for categories and sizes
  - `PUT /seller/hours`, `POST /seller/pause`, `DELETE /seller/pause`
- **Events and webhooks:** `menu.item.availability_changed`, `restaurant.paused` and `restaurant.resumed`.

### 3.8 Edge cases and tests

- Overnight windows across midnight and across week boundaries (Sunday 22:00 to Monday 02:00).
- Exception dates overriding weekly rules, and exceptions on overnight days.
- An item schedule narrower than, wider than, or disjoint from restaurant hours (warning shown).
- A sold-out "until next opening" when the next opening is days away (holiday).
- A scheduled order placed while open, for a slot when the item is unavailable (rejected at checkout).
- An ordinary order whose item became unavailable after placement: the order stays valid (placement-time guarantee) and is flagged under §3.10. A scheduled order is revalidated at activation and acceptance (§3.9).
- Clock skew: the server's time decides, and the client only displays.
- Unit tests for the schedule evaluator (pure function), and integration tests for checkout validation.
- DST spring-forward and fall-back nights (see 3.2).
- **Concurrency:** two checkouts racing for the last unit, and a schedule changed between viewing and checkout (see 3.9).

### 3.9 Availability, inventory, acceptance and stock reservation (A5)

These are four **separate** concepts, each with its own owner and failure message.

| Concept | Question it answers | Decided by | When checked |
|---|---|---|---|
| **Availability** | Can this item/size/option be ordered **for this fulfilment time and order type**? | Levels 1–7 of 3.1 (schedules, channel, sold-out) | Menu display (advisory), **checkout (authoritative)**, scheduled-order activation |
| **Inventory** | Is there **enough stock** for the requested quantity? | Stock counts (level 8), when the item tracks stock | **Checkout (authoritative, atomic)** |
| **Order acceptance** | Does the **restaurant accept** this order? | Restaurant (manual or auto-accept), section 4 | After placement |
| **Stock reservation** | When is stock **held, consumed or released**? | Rules below | Placement → acceptance → completion / cancellation |

**Atomic order placement.** The server validates and records the order in **one transaction**. Checking and then saving in separate steps isn't allowed.

1. Lock or conditionally update the affected stock rows, for example `UPDATE … SET reserved = reserved + :qty WHERE id = :id AND available - reserved >= :qty`. If any line affects zero rows, the whole order fails.
2. Evaluate availability (3.1) for every line, **at the requested fulfilment time** (now for immediate orders; the slot time for scheduled ones), against the current schedule version.
3. Re-price from the current menu, not from the client's numbers.
4. Insert the order with line snapshots and the reservation records, then commit.
5. Use an **idempotency key** per checkout attempt, so retries never create duplicate orders or double reservations.

On failure nothing is saved. The customer gets line-level reasons: "Biryani: only 1 left", "Breakfast items aren't available at 13:00", "Price changed".

**Reservation lifecycle** (for items that track stock):

| Event | Effect on stock |
|---|---|
| Order placed | Quantity **reserved** (not yet consumed) |
| Online payment fails or times out (timeout: Q7) | Reservation **released**; order closed as `cancelled` with reason `payment_failed` (D4) |
| Restaurant rejects | Reservation **released** |
| Restaurant accepts | Reservation **consumed** (deducted from stock) |
| Cancelled after acceptance, food **not yet prepared** | Stock **returned** |
| Cancelled after preparation started / dispatched | Stock **not returned** (it's waste), and the reason is logged |
| Daily stock reset (at opening) | Counts reset; existing reservations for future slots carry over |

**Scheduled orders.** Availability is evaluated **for the requested fulfilment time and order type**, never for the time of browsing. The server validates again:
1. at **checkout**: the full check, with stock reserved for that day's count
2. at **activation** (slot time minus prep lead): schedule, sold-out and closure exceptions added since checkout
3. at **acceptance**: final check

If an item becomes unavailable after checkout, the order isn't silently changed. It's flagged to the restaurant ("Item unavailable for this slot"), which can contact the customer, accept without the item (partial refund) or cancel with a refund. Every path is audited.

### 3.10 Availability changes after placement: ordinary orders (D6)

**Guarantee:** an ordinary (non-scheduled) order was valid when placed, because availability, stock and price were validated atomically (§3.9). A later availability change, such as a dish marked sold out or a schedule edit, **never changes or cancels the order automatically**.

**Operational exception policy:**

| When the restaurant finds it can't fulfil a line | What the panel offers | Rules |
|---|---|---|
| Order is `pending` | **Reject** with reason "Item unavailable", **or** accept and remove the line (if order editing is enabled) | Removing a line needs the customer notified, totals recalculated and a partial refund for online payment; audited |
| Order is `accepted` / preparing | Remove the line (if editing is enabled), **or** cancel per §4.3 (subject to P2) | Same notification, refund and audit rules; counts towards the cancellation rate only if the whole order is cancelled (Q8) |
| Order is `ready` or later | No line changes; support handles any dispute | — |

The order shows which lines were marked unavailable **after** placement, with who and when, so the restaurant sees why the flag appears. Marking an item sold out never touches orders already placed.

---

## 4. Order lifecycle (Foodi model)

### 4.1 Statuses

`scheduled` (future slot) → `pending` → `accepted` → `ready` → (`out_for_delivery`) → `completed`

Closed states:
- `rejected`: by the restaurant, before acceptance, with a reason (list: Q9).
- `cancelled`: by the customer, the restaurant (after acceptance, §4.3, subject to P2), Foodi support, or the system (e.g. reason `payment_failed`), always with a reason.

**Payment failure is not an order status (D4).** It lives on the payment record (`failed`). An online order whose payment fails or times out is closed as `cancelled` / `payment_failed` before it reaches the restaurant.

**Preparation start (D3).** `preparing` is a **sub-state of accepted**, not a separate status. Every order records `preparationStartedAt`:
- **On acceptance (R1, confirmed Q10 Option A):** the server sets `preparationStartedAt` automatically to the server-authoritative acceptance timestamp. The client never supplies it.
- **Restaurant workflow:** there is **no separate "Start preparing" action in R1**. Accepting starts preparation.
- **Stock handling:** if the restaurant later cancels the order (§4.3, subject to P2), reserved stock is **not returned**, because preparation has already started.
- **Audit:** the audit trail records the acceptance timestamp (and therefore `preparationStartedAt`), who accepted, and on cancellation the actor and cancellation reason.
- **Future (R2, to be reconsidered):** an explicit preparation-start step, which would leave `preparationStartedAt` unset until the restaurant taps **Start preparing**.
- **Intended trade-off:** this rule deliberately prioritises a simpler restaurant workflow over restoring stock when an accepted order is cancelled.
- Stock-return and cancellation rules (§3.9, §4.3) use `preparationStartedAt`, never the UI label.

### 4.2 Transitions

| From | Restaurant action | To | Notes |
|---|---|---|---|
| pending | **Accept** (asks for prep time; default from settings; skippable if auto-accept) | accepted | Starts the countdown and the customer ETA |
| pending | **Reject** (reason list plus free text; list: Q9) | rejected | Refund is automatic for online payment |
| accepted | **Mark ready** | ready | Notifies the rider or customer |
| accepted | **Adjust prep time** (+5 / +10 / custom) | accepted | Customer ETA updates |
| ready | *Foodi delivery:* none (the rider picks up) | out_for_delivery → completed | Shows the rider's status |
| ready | *Restaurant delivery:* **Dispatch** (choose rider) | out_for_delivery | Then **Complete** |
| ready | *Takeaway / dine-in:* **Complete** (optional pickup code check) | completed | |
| accepted, ready | **Cancel order** (reason required) | cancelled | Rules in 4.3 (P2) |
| scheduled | (automatic) enters `pending` at slot time minus prep lead | pending | "Prepare now" reminders |

**Settings:**
- auto-accept: off, instant, or after 30 s to 2 min
- default prep time per order type
- require pickup code
- new-order alarm sound and repeat
- auto-print kitchen ticket on accept

**Live board (R1):** three columns, New → In kitchen → Ready, with large action buttons, a ringing alarm until a new order is acknowledged, timers, and colours for delayed orders. It works on tablet and phone, and real-time updates use a socket with a polling fallback.

### 4.3 Restaurant cancellation after acceptance (P2, awaiting confirmation)

The restaurant may cancel an accepted order, with restrictions:

- **Required:** a reason from a list (item unavailable, kitchen issue, closing early, customer request, suspected fraud, other) plus an optional note. The audit event records who, when, the reason, and the order state at that moment.
- **Refunds:**
  - *Online payment:* full refund, issued automatically.
  - *Cash on delivery:* nothing is collected.
  - Whether any part is charged to the restaurant is a platform-policy setting, not a restaurant choice.
- **By state:**

  | State | Allowed? | Extra rule |
  |---|---|---|
  | `accepted`, `preparationStartedAt` unset (not possible in R1; only if an explicit step is added in R2) | Yes | Stock returned |
  | `accepted` (in R1 always has `preparationStartedAt` set), or `ready` | Yes | Stock not returned; counts towards the cancellation rate (Q8) |
  | `out_for_delivery` (Foodi rider) | **No.** Goes to support. | The rider and customer are already involved |
  | `out_for_delivery` (own rider) | Yes, with a confirmation | Rider is notified |
  | `completed` | No. Use refund/dispute instead. | — |

- **Notifications:** the customer and rider are told immediately with a plain-language reason.
- **Abuse control:** high cancellation rates surface to the platform admin. Thresholds are a platform setting.

**Order editing:** the restaurant can adjust items before *ready* if the restaurant setting allows it and the customer is notified; totals recalculate. Every change goes into the order's edit history.

---

## 5. Menu model (Foodi)

- **Item:**
  - name and description (translatable), one category (**mandatory for every active item**, D7), photo (1:1, up to 2 MB, JPG/PNG/WebP, auto-compressed)
  - base price, optional channel price for delivery
  - food type (veg / non-veg / egg / vegan), allergens, nutrition (optional), spice level, tags (bestseller, new, chef's special)
  - recommended pairings (R2)
- **Sizes:** zero or more. If present the customer **picks exactly one**, and the size price **replaces** the base price. Each has its own availability.
- **Option groups:** zero or more per item, and reusable across items (R2).
  - Each group is **Single** or **Multiple**, with **Required on/off** and **min / max selections**.
  - Each option has a name, an **added price** (0 = free), an availability switch and an optional photo. A maximum quantity per option (e.g. 2× dip) is R2.
- **Availability:** the full section 3 model at category, item, size and option level.
- **Ordering:** drag to reorder categories, and items within a category. A priority screen is the keyboard-accessible alternative.
- **Delete:**
  - items and categories that are on any order are **archived** (restorable)
  - never-used items can be deleted after a confirmation
  - deleting a category requires moving or archiving its items first
- **Bulk:** CSV import/export (R2) and AI import from a menu photo/PDF (R3), always with a review step before saving.

---

## 6. Other modules: key features (summary)

- **Dashboard:**
  - today's sales, order count, average prep time, acceptance rate, cancellations
  - live order counts by status
  - alerts: paused, sold-out items, delayed orders, low stock
  - top items
- **Promotions:**
  - coupons (code, percent or flat amount, minimum order, max discount, per-user limit, validity)
  - item offers and BOGO
  - **happy hour (time-window discounts, using the section 3 schedule model)**
  - auto-apply, and rules for stacking promotions
- **Reviews:** list, filters by rating and replied/unreplied, reply, report abuse.
- **Customers:** history and lifetime value, with contact details masked by default and revealed with permission and logged.
- **Reports:**
  - sales by day/hour/channel, items sold, tax, discounts, cancellations and refunds, payouts
  - CSV/PDF export
  - date presets and custom ranges in the restaurant's time zone
- **Wallet and settlements:**
  - balance, pending settlements, settlement history with the per-order breakdown (commission, fees, tax, adjustments)
  - withdrawal requests (if the plan allows), and statements
- **Settings:**
  - profile, address and map pin, logo/cover, contact, order types and minimum order, prep defaults
  - tax and packaging charges, receipts/KOT layout, notification preferences, QR code
- **Staff and roles:**
  - preset roles: Owner, Manager, Cashier, Kitchen
  - custom roles with module × action permissions (view/create/edit/delete), per-outlet scope
  - an audit log
- **Multi-outlet:** an outlet switcher in the header, a shared or per-outlet menu with per-outlet availability and prices, and consolidated reports.

---

## 7. Non-functional requirements

- **Security:**
  - session auth as proposed in AUTH-01
  - POST/PATCH with CSRF protection for every mutation
  - server-side transition and availability checks
  - tenant isolation, rate limits, audit log, PII masking
- **Real-time:** an order-events channel (WebSocket or SSE) with reconnect and a 15 s polling fallback. Alarm sounds must survive tab sleep, using a wake-lock / PWA notification.
- **Performance:** first contentful paint under 2 s on 4G for the live board; actions under 300 ms perceived (optimistic, with rollback).
- **Reliability:** the order board shows connection state, and no action is lost (idempotency keys on mutations).
- **Accessibility:** WCAG 2.2 AA, a keyboard-operable board, and alarm alternatives (visual flashing, vibration on mobile).
- **Internationalisation:** UI language and content translations; currency and time zone per restaurant.
- **Observability:** error tracking, plus metrics on acceptance time and prep accuracy.

---

## 8. Impact on work already done

| Area | Current state | Change under this spec |
|---|---|---|
| Orders UI (PR #3) | 8 provisional statuses; all actions disabled | Merge `preparing` into `accepted` (sub-state with countdown); add `scheduled`; actions become Accept (with prep time), Reject (reasons), Mark ready, Dispatch, Complete; add the live board view. Update `docs/orders-ui.md`. |
| Menu UI (RUI-03, uncommitted) | Flat variants and add-ons, item on/off only, category optional | Category **required**; **Sizes** (replace price) plus **Option groups** (single/multiple, required, min/max); an **Availability card** with schedule, channels, sold-out-until and outside-schedule mode; meal periods; availability states in the list; archive instead of delete. |
| Dashboard (PR #2) | Placeholder KPIs | Add paused/sold-out banners and the live order counts from this spec. |
| Settings | Not built | New: Hours (business hours, holidays, pause, order-ahead), meal periods. |
| Backend | Seller auth and menu/order APIs not built | Section 3.7 plus sections 4 and 5 become the proposed contract for the backend team. |

**How the earlier UI decision IDs map to this PRD:**
- **Orders:**
  - L2 → one-step accept with `preparationStartedAt` set at acceptance (D3, Q10 confirmed); no separate Start-preparing action in R1.
  - L3 → reject before acceptance (reasons: Q9); restaurant cancellation after acceptance per §4.3, subject to **P2** (D1).
  - L4 → §4.2.
  - L6 → scheduled orders supported; auto-accept optional.
- **Menu:**
  - M1 → category mandatory for active items (D7).
  - M2 → one category. M3 → sizes replace price. M4 → option groups.
  - M5 → section 3 (D5 release split). M6 → 2 MB, 1:1. M7 → category on/off. M8 → archive. M9 → drag plus priority screen.
  - M10 → dietary, allergens, tags; channel price is **Q4**.

**Reconciliation before any UI change.** PR #3 and the RUI-03 menu work stay as they are until a reconciliation pass maps each existing screen, type and provisional rule against this document. It lists every conflict and the change it needs, and each change is approved before it's implemented.

## 9. Open questions

1. ~~Release order, POS and QR dine-in~~ → **P1** (recommended: R2), awaiting confirmation. Is the rest of the R1 / R2 / R3 split right?
2. ~~Restaurant cancellation after acceptance~~ → **P2** (recommended: yes, with restrictions, 4.3), awaiting confirmation.
3. ~~Grey out or hide~~ → **P3** (recommended: grey out by default, restaurant setting to hide), awaiting confirmation.
4. Should channel-specific prices (higher delivery price) be allowed in R1?
5. Withdrawals: is that restaurant-initiated, or on an automatic settlement schedule only?
6. Multi-outlet in R2: does one owner manage several *brands*, or only several *branches* of one brand?
7. Payment timeout for unpaid online checkouts before the reservation is released and the order is closed as `payment_failed` (proposed 15 min).
8. Cancellation-rate policy: which cancellations and rejections count, over what period, and what thresholds trigger admin review?
9. **Reject reason list:** the fixed reasons a restaurant picks from when rejecting a pending order. Proposed starting list, not approved: item unavailable, too busy, closing soon / closed, delivery area or address issue, suspected fraud, other (free text required).
10. ~~Preparation-start default~~ **Confirmed: Option A.** R1 sets `preparationStartedAt` automatically to the server-authoritative acceptance timestamp; no separate Start-preparing action; stock is not returned if the restaurant cancels after acceptance; acceptance timestamp and cancellation reason are audited. An explicit step may be reconsidered in R2. See §4.1.

### 9.1 Backend contracts to be settled by the backend team

These are engineering decisions and change no product rule:
- **Placement:** the transaction and locking strategy for atomic placement (§3.9), including last-unit concurrency.
- **Idempotency:** key format, scope, storage and expiry for checkout and for every mutation.
- **Jobs:**
  - reservation expiry (uses Q7)
  - scheduled-order activation and revalidation
  - schedule versioning
- **Time:** the time-zone and daylight-saving implementation, and where the availability evaluator runs (server-computed states vs a shared library).
- **Real-time:** the transport (WebSocket or SSE), event payloads and the polling fallback.
- **API:** paths and prefix (`/api/v1/seller/...` vs `/seller/...`) and enum names (e.g. `takeaway` vs `pickup`).
- **Refunds:** refund and partial-refund integration.
- **Audit log:** the schema.

---

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-10-23 | First proposal: 24 modules, R1–R3 split, data model, availability engine, order lifecycle, menu model |
| 0.2 | 2026-10-23 | Marked as the working direction (not frozen). Added the decision record (A1–A5 approved; P1–P3 recommended). Added DST rules (3.2), reliable "next available" (3.6), availability / inventory / acceptance / reservation with atomic placement and scheduled-order revalidation (3.9), restaurant cancellation rules (4.3), and the reconciliation step before UI changes (8). |
| 0.3 | 2026-10-23 | Resolved the seven v0.2 inconsistencies (D1–D7): one cancellation rule subject to P2; restaurant added as a `cancelled` actor; recorded `preparationStartedAt` drives stock return; payment failure kept off the order status (`cancelled` / `payment_failed`); category mandatory for active items; R1 includes core hours and restaurant date exceptions, advanced scheduling to be confirmed; scheduled orders revalidated at acceptance plus new §3.10 policy for ordinary orders. Added Q9 (reject reasons), Q10 (preparation-start default) and §9.1 backend contracts. P2 and P3 remain awaiting confirmation. Q10 later confirmed as Option A (automatic preparation start at acceptance, no stock return on restaurant cancellation after acceptance, no Start-preparing action in R1). |
