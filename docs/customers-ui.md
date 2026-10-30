# Customers UI (B6b)

The Customers screens follow PRD v0.3 §1 module 14, Release 1: **order history
per customer, with masked contact details** (segments, export and campaigns
are later releases). No customers API exists yet, so production shows
"Customers aren't connected yet". Everything works only against labelled
preview data. Everything below about the API is a **PROPOSAL** awaiting the
backend team (PRD §9.1): none of it is implemented, approved or agreed.

Nothing in this repo or the PRD defines a customer entity, a customer ID or a
customer endpoint. The UI supports the proposed contract; that does **not**
mean customer identity, restaurant scoping, masking or the refund-aware
totals exist anywhere. They are backend work.

The PRD's §6 line "revealed with permission and logged" (contact reveal) is
**not** part of B6b: there is no reveal, copy, call, email or export control.

## Decisions applied

| # | Decision | Where it shows |
|---|---|---|
| C1 | A backend-issued opaque `customerId`, scoped to the restaurant's customer relationship. Never a phone, email or name | `Customer.id` (`types.ts`); the mapper accepts only `[\w-]{1,100}`; the profile URL is `/customers/<id>` |
| C2 | Guest orders with no stable customer ID aren't in the directory; customers are never merged by name, phone or email | The UI only lists what the API returns. No matching by name anywhere; preview order 1030 is a guest order and belongs to nobody |
| C3 | Order count and lifetime spend are server-provided (completed orders; spend is completed-order totals less confirmed refunds). Never derived from rows on screen | `Customer.orderCount`, `Customer.lifetimeSpend` are `null` unless supplied |
| C4 | A pending refund doesn't reduce spend; a confirmed full or partial refund reduces it by the confirmed amount | Server rule only. The UI shows the figure it is given and has no refund logic |
| C5 | The restaurant's configured currency; lifetime totals for this restaurant only | The mapper refuses any other currency than the restaurant context's, and nothing is converted |
| C6 | Optional masked phone and email, already masked by the backend. No reveal, copy, call, email or export | `phoneMasked`, `emailMasked`; plain text, no `tel:`/`mailto:` links. See "Privacy" |
| C7 | Only the active restaurant's customers; the backend enforces ownership. A restaurant ID in the URL is never authorization | No restaurant ID is read from or sent from the URL; unknown or out-of-scope IDs are "Customer not found" |
| C8 | Case-insensitive name search, 60 characters at most, 10 per page, strict URL pagination. Default sort: last order newest first, then name A–Z. Metric sorts only if reliably supported | `query.ts`; only "Last order" and "Name A–Z" are offered; `supportedSorts` can disable either |
| C9 | A missing metric stays unavailable; no invented total count; a missing last-order date shows a neutral marker and disables that sort | `—` with "Not available" for screen readers; `totalItems`/`totalPages` may be `null`; `hasNextPage` drives Next |

## Routes

| Route | What it is |
|---|---|
| `/customers` | The directory: name search, sort, pagination |
| `/customers/[customerId]` | One customer: masked contact, metrics, and a paginated order history |

The state lives in the URL, so it survives a reload and the back and forward
buttons, and can be shared:

`/customers?q=<name>&sort=<name>&page=<n>` and, on a profile,
`/customers/<id>?q=…&sort=…&page=…&orders=<n>`

- `q` is trimmed and cut to 60 characters. `sort` is exactly `name`
  (`recent` is the default and is left out of URLs). `page` and `orders` are
  exactly a positive whole number. Anything else ("3.5", "03", "5abc", "0",
  "spend") falls back to the default, like Orders and Reviews.
- Changing the search or sort returns to page 1. A page past the end shows
  the last page when the source gives totals, or a "nothing on this page"
  message when it doesn't.
- The profile carries the list's `q`, `sort` and `page`, so "All customers"
  returns to the same view. `orders` is the order-history page.
- Dates use the restaurant's time zone and locale (shared restaurant
  context); money uses its currency.
- Unknown IDs and malformed percent-encodings are "Customer not found", never
  another customer.

The directory is a table from `md` up and cards below. The order history on a
profile is the same.

## What is and isn't shown

- Directory columns: customer, masked contact, orders, lifetime spend, last
  order. Cards show the same.
- Profile: contact (masked), orders, lifetime spend, last and first order, and
  the order history. Each history row links to the existing
  `/orders/[orderId]` using the order ID the API supplies.
- Orders needed no change: the order history is its own shape
  (`CustomerOrderSummary`), and the Orders model has no customer association.
  Nothing is filtered or matched by display name.
- No totals beyond "Showing 11–20 of 25 customers" when the source supplies
  them. No averages, segments or "top customers" (those are Release 2).
- States: loading (skeleton), empty ("No customers yet"), no results (search),
  error with retry, forbidden, not found, not connected, and a page past the
  end. The order history loads and fails separately, so its failure never
  hides the profile.

## Privacy

- **Masking is presentation, not security.** The backend must authorize every
  request, return only this restaurant's customers, and return masked contact
  values. The frontend cannot make an unmasked value safe.
- The API mapper (`api-mapping.ts`) reads only the fields in the contract
  below. A raw `phone`, `email`, address or restaurant ID sent alongside a
  customer is never read, so it can't reach a screen.
- As a second line of defence, a masked field that doesn't look masked is
  **refused** (the screen shows a load failure, not the value): a phone must
  contain `•` or `*` and have at most four digits; an email must contain `•`
  or `*`; a display name containing `@` or seven or more digits is refused. No
  error message ever repeats a value.
- Contact values are plain text: no `tel:` or `mailto:` link, no copy button,
  no reveal control, no export.
- Preview fixtures contain no real or realistic contact details: names are
  "Preview customer NN", phones look like `•••••• ••10` and emails like
  `p•••@e•••••.example`.

## Production and preview

- Preview data is an explicit development opt-in
  (`FOODI_CUSTOMERS_DATA_SOURCE=preview`), refused in production builds, and
  never used as a fallback when the API fails.
- With no API, every customers URL shows "Customers aren't connected yet":
  never "empty", "forbidden" or "not found" (a preview scenario in the URL is
  ignored in production). No search box is shown then.
- Preview scenarios: `?preview=empty|error|slow|forbidden`, on both screens.
- The preview is read-only (there are no writes in B6b), so there are no
  preview tools and no "Preview only, not saved" toasts. A notice labels the
  data as sample data.

```bash
FOODI_CUSTOMERS_DATA_SOURCE=preview npm run dev
```

Sample data: 25 customers. `prv-cus-01` has a two-page order history
(14 orders), `prv-cus-03` has no order count or spend, `prv-cus-05` has no
name, `prv-cus-07` has no order dates and `prv-cus-25` has no orders. History
rows are taken from the Orders preview fixtures, so each links to a sample
order that exists. The preview plays the server for search, sort and
pagination (and counts only completed orders, with no refunds in the sample
data); that is not evidence of how the backend will behave.

## PROPOSED API contract

None of this is implemented, approved or agreed. All requests are made with
the seller session; the restaurant is never a parameter.

`GET /seller/customers?q=&sort=&page=&pageSize=`

```json
{
  "items": [
    {
      "id": "cus_8f3a",
      "displayName": "Asha K.",
      "phoneMasked": "•••••• ••10",
      "emailMasked": "a•••@e•••••.com",
      "orderCount": 3,
      "lifetimeSpend": { "amountMinor": 120000, "currency": "INR" },
      "lastOrderAt": "2026-10-27T09:30:00Z"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "totalItems": 25,
  "totalPages": 3,
  "hasNextPage": true,
  "supportedSorts": ["recent", "name"]
}
```

- `q`: case-insensitive "name contains", at most 60 characters; omitted when
  empty. `sort`: `recent` (last order newest first, then name A–Z) or
  `name` (A–Z); `pageSize` is 10.
- Only customers with a stable customer ID and at least one order at this
  restaurant (C2, C7). `id` is opaque.
- Every field except `id`, `page`, `pageSize`, `hasNextPage` may be `null` or
  absent: `displayName`, `phoneMasked`, `emailMasked`, `orderCount`,
  `lifetimeSpend`, `lastOrderAt`, `totalItems`, `totalPages`. The UI never
  turns an absent value into zero or a guess.
- `orderCount` and `lifetimeSpend` follow C3–C5: completed orders only;
  spend = completed-order totals less confirmed refunds; pending refunds don't
  count; the restaurant's currency; lifetime, for this restaurant only.
  **Open for the backend:** how a partly refunded order, a cancelled-after-
  completion order, and a tip or delivery fee are treated.
- `lastOrderAt`: proposed as the most recent order placed, any status. **Open
  for the backend.**
- `supportedSorts`: the sorts the server applied reliably. If absent, none is
  assumed and the UI disables both sorts' links except the active one.
  `hasNextPage` is required; if both totals are given they must agree with
  each other and with it (the mapper refuses a response that doesn't).
- Masked fields must be masked by the server (see Privacy).

`GET /seller/customers/{customerId}`: the same fields plus
`"firstOrderAt": "…" | null`. `404` means no such customer **for this
restaurant** (a customer who exists elsewhere is also `404`); `403` means
the session may not view customers.

`GET /seller/customers/{customerId}/orders?page=&pageSize=`

```json
{
  "items": [
    {
      "id": "ord_1",
      "reference": "A-1001",
      "placedAt": "2026-10-27T09:30:00Z",
      "status": "completed",
      "paymentStatus": "paid",
      "orderType": "takeaway",
      "deliveryMode": null,
      "itemCount": 2,
      "total": { "amountMinor": 52000, "currency": "INR" }
    }
  ],
  "page": 1,
  "pageSize": 10,
  "totalItems": 14,
  "totalPages": 2,
  "hasNextPage": true
}
```

- Newest first. `status`, `paymentStatus`, `orderType` and `deliveryMode` use
  the Orders names (`src/lib/orders/types.ts`, PRD §4); `deliveryMode` is set
  for delivery orders only. `id` is the order ID the existing
  `/orders/[orderId]` page uses.
- A dedicated endpoint is proposed so the frontend never matches orders to a
  customer by name. A `customerId` filter on the orders list would also do;
  that is the backend's choice.
- The same `404`, `403`, nullable-totals and `hasNextPage` rules apply.

## Backend dependencies and limitations

- A customer entity and ID for the restaurant's customer relationship (C1),
  and a decision on guest checkout (C2).
- Seller authentication and session (AUTH-01) and server-side restaurant
  scoping and authorization (C7). Not implemented anywhere.
- Server-side masking of phone and email (C6).
- Server-computed order count, lifetime spend and last order, including the
  refund rules (C3, C4); the refund status itself follows PRD P2 (a refund is
  final only when the provider confirms).
- Search, sort and pagination semantics (C8), and whether totals are
  authoritative (C9).
- Out of scope, as approved: segments, campaigns, loyalty, export, contact
  reveal (which needs the audit log and permissions of module 20), customer
  editing, notes and tags, blocking or deleting customers, and staff roles.
- Linking from an order to its customer needs a `customerId` on orders. That
  would change the Orders model, so B6b doesn't do it.

## Files

- `src/lib/customers/`: `types.ts`, `query.ts`, `api-mapping.ts`,
  `adapter.ts`, `api-source.ts` (PROPOSED paths), `preview-source.ts`,
  `fixtures/customers.ts`, `service.ts`.
- `src/components/customers/`: list, toolbar, pagination, profile, order
  history, states.
- `src/app/(dashboard)/customers/`: `page.tsx`, `[customerId]/page.tsx`,
  `[customerId]/not-found.tsx`.
- Tests: `src/lib/customers/*.test.ts`, `src/components/customers/*.test.tsx`,
  `tests/e2e/preview/customers.spec.ts`, and the customers routes in
  `tests/e2e/production/production.spec.ts`.
