# Restaurant Orders UI (RUI-02)

Status: **UI built on a provisional model. All order actions are disabled.** No orders API exists yet, and the canonical Foodi order lifecycle has not been approved.

## Routes

| Route | Purpose |
|---|---|
| `/orders` | Orders list: status tabs, reference search, date range, pagination (10 per page). Table on `md` and up, cards below. |
| `/orders/[orderId]` | Order detail: items and charges, timeline, customer and fulfilment, payment, proposed actions (disabled). |

Filters live in the URL (`status`, `q`, `from`, `to`, `page`), so every view can be shared and works before hydration. Invalid values fall back to defaults (`src/lib/orders/query.ts`).

## Provisional decisions (not an approved backend contract)

1. **Order statuses:** `pending` (shown as "New"), `accepted`, `preparing`, `ready`, `out_for_delivery`, `completed`, `rejected`, `cancelled`.
2. **Payment status is separate from order status:** `unpaid`, `paid`, `failed`, `refund_pending`, `refunded`. Payment method is `online` or `cash`, and can be missing.
3. **Fulfilment method is a separate field:** `foodi_delivery`, `restaurant_delivery`, `pickup`, `dine_in`.
4. **Scheduled orders aren't supported.**
5. **No state-changing actions are enabled.** The detail page shows the actions the proposed model would offer (`src/lib/orders/lifecycle.ts`). They are rendered with `aria-disabled`, linked to an explanation, and do nothing:

   | Status | Proposed actions |
   |---|---|
   | `pending` | Accept order; Reject order (reason required) |
   | `accepted` | Start preparing; Cancel order (reason required) |
   | `preparing` | Mark ready; Cancel order (reason required) |
   | `ready` | Mark out for delivery (restaurant delivery); Mark completed (pickup, dine-in). None for Foodi delivery. |
   | `out_for_delivery` | Mark delivered (restaurant delivery only) |
   | `completed`, `rejected`, `cancelled` | None |

6. **Money** is in integer minor units with an ISO currency code.
7. **Dates and date filters** use `Asia/Kolkata` (`src/lib/orders/format.ts`). They should come from the restaurant profile once that API exists.
8. **Search** matches the order reference only. Other identifiers need backend support.

## Open lifecycle decisions

- **L2:** Are "accept" and "start preparing" separate steps?
- **L3:** Can a restaurant cancel after accepting? Until which step? Free-text reasons or a fixed list?
- **L4:** Who advances orders past "ready" for each fulfilment method?
- **L6:** Is there a time limit for accepting new orders? Are scheduled orders supported?
- **Rejection and cancellation reason entry:** dialogs with confirmation are built only once L3 is settled.

## Architecture

```
src/lib/orders/
  types.ts         domain types (provisional)
  lifecycle.ts     labels + proposed actions (presentation only)
  query.ts         URL params -> validated OrderListQuery; link builder
  format.ts        money/date formatting, restaurant time zone
  errors.ts        OrdersServiceError (not_configured | unavailable)
  service.ts       server-only entry point used by pages; picks the data source
  api-source.ts    INTEGRATION POINT: always "not_configured" today
  fixtures/        development fixtures only (see below)
src/components/orders/   list, toolbar, pagination, states, badges, items, timeline, actions
src/app/(dashboard)/orders/   list page, [orderId] detail page, not-found
```

## Data sources and fixtures

- **Default: API.** `api-source.ts` throws `not_configured`, and the pages show "Orders aren't connected yet". Nothing else is rendered.
- **Fixtures** are an explicit development opt-in: `FOODI_ORDERS_DATA_SOURCE=fixtures npm run dev`.
  - They're **refused when `NODE_ENV=production`**, even with the variable set.
  - Every fixture page shows an "Illustrative preview data" notice.
  - References start with `PRV-`, customers are "Preview customer NN", and addresses read "Preview address · not a real location".
  - There are no real names, phone numbers or addresses.
- **No fallback.** If the API errors, the UI shows an error state with "Try again". It never shows fixtures instead.
- **Preview scenarios** (fixture mode only): `?preview=empty`, `?preview=error` and `?preview=slow` show the empty, error and loading states.

## Proposed API contract (PROPOSED, for the backend team)

None of these endpoints exist. Paths assume the seller API proposed in the AUTH-01 audit. Every call is scoped to the restaurant in the session and never takes a restaurant id from the client.

| Method + path | Request | Response |
|---|---|---|
| GET `/api/v1/seller/orders` | `status`, `q` (reference), `from`, `to` (restaurant-local dates), `page`, `pageSize` | `{ items: OrderSummary[], page, pageSize, totalItems, totalPages }` |
| GET `/api/v1/seller/orders/:id` | none | `OrderDetail`, or 404 for unknown or other-restaurant orders |
| POST `/api/v1/seller/orders/:id/transitions` | `{ action, reason? }` | updated `OrderDetail`; 409 if the transition isn't allowed from the current status |

Field shapes are in `src/lib/orders/types.ts`. Also needed:
- an ETag or version for concurrent updates
- real-time updates (polling or push) for new orders

## Not covered by automated tests

The repository has no test runner (adding one needs approval). These were checked manually with Playwright scripts:
- filters, search, pagination and invalid parameters
- empty, error, no-results, loading and not-found states
- disabled actions and keyboard reach
- 1440, 820 and 390 px widths
- production refusing fixtures

There are no unit tests for `parseOrderListQuery`, `proposedActionsFor` or the fixture filtering yet.
