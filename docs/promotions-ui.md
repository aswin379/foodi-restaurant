# Promotions UI (B6e)

`/promotions` and `/promotions/[promotionId]` follow PRD v0.3 §1 module 12,
Release 1: **coupons** (§6: "code, percent or flat amount, minimum order, max
discount, per-user limit, validity"). Item offers, BOGO, happy hour and
auto-apply are Release 2 and loyalty points Release 3; none is built or
modelled. The screens are read-only: no coupon can be created, edited, deleted,
activated or paused. No promotions API exists yet, so production shows
"Promotions aren't connected yet", with no coupon, value, date or count.
Everything works only against labelled preview data. Everything below about the
API is a **PROPOSAL** that is **NOT IMPLEMENTED** and not agreed with the
backend team (PRD §9.1).

The PRD defines no promotion entity beyond `Promotion[]` (§2), and no status,
funding, usage, eligibility or stacking field. The order model's single
`charges.discount` amount does **not** imply a promotion system: an order
carries no promotion ID, code or funding source, and B6e doesn't change Orders.
The UI supports the proposed contract. That does **not** mean coupon storage,
redemption, funding, stacking, usage limits or authorization exist anywhere.
They are backend work.

## Decisions applied

| # | Decision | Where it shows |
|---|---|---|
| 1 | Coupons only for Release 1 | `PROMOTION_KINDS = ["coupon"]`; the mapper refuses any other kind; the API request asks for `kind=coupon` |
| 2 | Fixed-amount and percentage coupons, values shown as supplied, no savings calculated | `PromotionDiscount`; "12.34% off", "₹22.22 off"; no example order, saving or discounted price anywhere |
| 3 | Funding shown only when the source says; never inferred | `fundedBy` is `null` unless supplied and then reads "Not available" |
| 4 | The `appliesTo` list only when supplied; no assumed component | A missing list is "Not available", never "everything" or "subtotal" |
| 5 | Minimum order and maximum discount when available | Detail page; "Not applicable to a fixed amount" for the cap on a fixed coupon |
| 6 | Order types and stacking only as supplied; no segmentation, priority or checkout eligibility | `orderTypes`, `stackable`; no priority field exists |
| 7 | Validity as UTC instants, shown in the restaurant's time zone; no status or validity derived from dates | `startsAt`/`endsAt`; the status is exactly what the source reports; a past end date doesn't make a coupon "Expired" |
| 8 | Authoritative redemption counts and limits only; never adjusted after cancellations or refunds | `redemptionCount`, `usageLimit`, `perCustomerLimit`; "as counted by Foodi. This page doesn't adjust it." |
| 9 | A `managedBy` label if supplied; no create, edit, delete, activate or pause | `managedBy`; no such control exists |
| 10 | No customer lists, individual redemption history or personal information | The mapper reads a fixed field list; tests assert none appears |
| 11 | Proposed list and detail contracts, marked PROPOSED | `api-source.ts`, this document |
| 12 | Production "Promotions aren't connected yet", never preview | See "Production and preview" |

## Routes

| Route | What it is |
|---|---|
| `/promotions` | The coupon directory: status filter and pagination |
| `/promotions/[promotionId]` | One coupon: the status, discount, validity, eligibility and usage the source supplied |

State lives in the URL: `/promotions?status=<status>&page=<n>`, and a coupon's
URL carries the same two parameters so "All coupons" returns to the same view.

- `status` is exactly `scheduled`, `active`, `paused`, `expired` or
  `cancelled`; anything else is "all". `page` is exactly a positive whole
  number; anything else ("3.5", "03", "5abc", "0") is page 1. Changing the
  filter returns to page 1. A page past the end shows the last page when the
  source gives totals, or "There is nothing on this page" when it doesn't.
- A restaurant ID, kind, code or search parameter in the URL is ignored. The
  coupon ID is an opaque value for the API only and never decides which
  restaurant's data is shown. Unknown IDs and malformed percent-encodings are
  "Coupon not found".
- The directory is a table from `md` up and cards below. The order is the
  server's.

## What is and isn't shown

- Directory: code (and name), the discount as stated, validity, the reported
  status, and the redemption count when supplied.
- Detail: status, name, type, who manages and funds it (when supplied); the
  value, maximum discount, minimum order and what it applies to; start and end
  times; order types, whether it can be combined with other promotions, the
  per-customer limit, the total limit and the redemption count.
- Every value appears as the source gives it, or as "—" with "Not available"
  for screen readers. A real zero (a 0 count, a ₹0.00 minimum) stays zero.
- **Status is displayed, never interpreted.** A coupon whose end date is in the
  past still shows the status the source reports, and one that reports none
  shows "Not available". A missing end date is not "never expires" and a missing
  start date is not "now".
- **Nothing is calculated.** No saving, discounted price, eligibility result,
  "valid now" answer, funding split or adjusted count exists, and the page says
  so: "It doesn't calculate savings, check who is eligible, or work out whether
  a coupon is valid right now."
- Times always show their year, in the restaurant's time zone, so a coupon from
  another year can't look current.
- A coupon code is shown as plain text exactly as given. There is no copy or
  share control.
- States: loading (skeleton), empty ("No coupons yet"), no results for a status,
  error with retry, forbidden, not found, not connected, and a page past the end.

## Privacy and production

- **Hiding is presentation, not security.** The backend must authorize every
  request and return only this restaurant's coupons (and any platform coupon it
  decides to expose). The restaurant is never a parameter.
- The API mapper (`api-mapping.ts`) reads a fixed list of fields, so customer,
  order or redemption-history data sent alongside a coupon can't reach a
  screen. It refuses unknown kinds, statuses, discount types, funding values,
  managers, order types and components; a discount that mixes the percentage
  and fixed forms; malformed, fractional, negative, unsafe or wrong-currency
  amounts; rates over 100%; a code with whitespace or control characters;
  instants that aren't ISO 8601 with a time and an offset; an end before the
  start; empty or duplicated lists; and a limit below 1. Its errors never
  repeat a value.
- Production never falls back to preview data. With no API, every promotions URL
  shows "Promotions aren't connected yet", whatever `?preview=` says, with no
  filter, link, coupon or figure.
- Preview data is an explicit development opt-in
  (`FOODI_PROMOTIONS_DATA_SOURCE=preview`), labelled "Preview only, not saved to
  Foodi", and refused in production builds. It is read-only, so there are no
  preview tools. Scenarios: `?preview=empty|error|slow|forbidden`.

```bash
FOODI_PROMOTIONS_DATA_SOURCE=preview npm run dev
```

Sample data: 14 coupons, every code starting `PREVIEW-` and every amount and
rate obviously fictional (11.11, 22.22, 55.55, 12.34%). It covers both discount
types, every status and funding value, a coupon reporting no status and one
with nothing optional, and real zeros. The funding, applies-to and manager
values exist only in the fixtures. The preview plays the server for the status
filter and pagination only and is no evidence of how the backend will behave.

## PROPOSED API contract

None of this is implemented, approved or agreed. The requests use the seller
session. Every enum value below is **PROPOSED**. Amounts are
`{ "amountMinor": <non-negative integer>, "currency": "<restaurant currency>" }`.

`GET /seller/promotions?kind=coupon&status=&page=&pageSize=`

```json
{
  "items": [
    {
      "id": "promo_8f3a",
      "kind": "coupon",
      "code": "EXAMPLE10",
      "name": "Optional name",
      "status": "active",
      "discount": { "type": "percentage", "rateBasisPoints": 1234, "maxDiscount": { "amountMinor": 5555, "currency": "INR" } },
      "minimumOrder": { "amountMinor": 11100, "currency": "INR" },
      "startsAt": "2026-10-01T00:00:00Z",
      "endsAt": "2026-11-01T00:00:00Z",
      "orderTypes": ["delivery", "takeaway"],
      "appliesTo": ["subtotal"],
      "fundedBy": "shared",
      "managedBy": "foodi",
      "stackable": false,
      "usageLimit": 1000,
      "perCustomerLimit": 1,
      "redemptionCount": 42
    }
  ],
  "page": 1,
  "pageSize": 10,
  "totalItems": 14,
  "totalPages": 2,
  "hasNextPage": true
}
```

- `id` (opaque), `kind`, `code` and `discount` are required. Everything else may
  be `null` or absent.
- `kind`: `coupon` only in Release 1.
  `status`: `scheduled`, `active`, `paused`, `expired` or `cancelled`, **as the
  service reports it**, not derived from the dates.
- `discount` is exactly one of `{ "type": "percentage", "rateBasisPoints",
  "maxDiscount"? }` (a rate of 0 to 10000; 1234 is 12.34%) or
  `{ "type": "fixed_amount", "amount" }`. Mixing the two is refused.
- `startsAt` and `endsAt`: ISO 8601 UTC instants (a `Z` or an offset), with the
  start not after the end.
- `orderTypes`: a non-empty list of `delivery`, `takeaway`, `dine_in`.
  `appliesTo`: a non-empty list of `subtotal`, `delivery_fee`, `packaging_fee`.
  `fundedBy`: `restaurant`, `foodi` or `shared`. `managedBy`: `restaurant` or
  `foodi`. A missing value means the source doesn't say, never "all" or "none".
- `usageLimit` and `perCustomerLimit` are whole numbers of at least 1.
  `redemptionCount` is a non-negative whole number that Foodi counts. How
  cancellations, refunds and partial refunds affect it is the backend's.
- `hasNextPage` is required. `totalItems` and `totalPages` may be `null`; when
  both are given they must agree with each other and with `hasNextPage`.
- Release 2 and 3 kinds are not returned in Release 1.

`GET /seller/promotions/{promotionId}`: one promotion with the same fields.
`404` means no such coupon **for this restaurant**. `403` means the session may
not view promotions.

## Backend dependencies and limitations

- A promotion model: who creates coupons (restaurant, Foodi or both), statuses,
  funding, applicable components, stacking rules, usage limits and validity
  semantics. The PRD defines none of this.
- Redemption counting, including cancellations, refunds and partial refunds.
- Seller authentication and session (AUTH-01) and server-side restaurant
  scoping and authorization. Not implemented anywhere.
- Out of scope, as approved: creating, editing, deleting, activating or pausing
  coupons; redemption and checkout calculations; item offers, BOGO, happy hour,
  auto-apply and loyalty points; customer segmentation and campaign
  broadcasting; stacking priority; customer lists and per-coupon redemption
  history; and any link between an order and a coupon (which would change the
  Orders model).

## Files

- `src/lib/promotions/`: `types.ts`, `query.ts`, `api-mapping.ts`, `adapter.ts`,
  `api-source.ts` (PROPOSED paths), `preview-source.ts`,
  `fixtures/promotions.ts`, `service.ts`.
- `src/components/promotions/`: list, detail, toolbar, pagination, values, states.
- `src/app/(dashboard)/promotions/`: `page.tsx`, `[promotionId]/page.tsx` and
  `not-found.tsx`.
- Tests: `src/lib/promotions/*.test.ts`, `src/components/promotions/*.test.tsx`,
  `tests/e2e/preview/promotions.spec.ts`, and the promotions routes in
  `tests/e2e/production/production.spec.ts`.
