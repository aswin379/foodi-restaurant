# Wallet and settlements UI (B6c)

The Wallet screens follow PRD v0.3 §1 module 17, Release 1: **earnings and a
settlements list** (§6: balance, pending settlements, and a settlement history
with the per-order breakdown of commission, fees, tax and adjustments).
Withdrawal requests and statements are Release 2 and instant payouts Release 3;
none is built. No wallet or settlements API exists yet, so production shows
"Wallet isn't connected yet", with no financial figures. Everything works only
against labelled preview data. Everything below about the API is a **PROPOSAL**
that is **NOT IMPLEMENTED** and not agreed with the backend team (PRD §9.1).

Nothing in this repo or the PRD defines a settlement, a payout or a commission
entity. The UI supports the proposed contract. That does **not** mean
settlement calculation, commission, refunds, payouts, restaurant scoping,
authorization or payout-destination masking exist anywhere. They are backend
work.

**Payout policy is undecided (PRD Q5).** The panel does not say or imply that
payouts are automatic or restaurant-initiated, and has no withdrawal, payout,
payout-destination editing, bank-detail reveal, export or statement control.
Plans & billing (module 19) is a separate, later batch and is not part of B6c.

## Decisions applied

| # | Decision | Where it shows |
|---|---|---|
| 1 | Wallet only; Plans & billing is separate | Routes below; "Plan & billing" stays a "Soon" entry |
| 2 | Payout policy undecided; no payout actions | No button, form or claim about how or when money moves. Tests assert it |
| 3 | Only the proposed statuses; unknown ones fail safely | `SETTLEMENT_STATUSES` (`types.ts`); the mapper refuses anything else (never "paid"); a missing status is shown as "Not available" |
| 4 | Named, nullable, server-provided amounts; nothing calculated | `WalletSummary` has three named amounts and no total; `null` shows "Not available", never zero |
| 5 | Commission, fees, tax and adjustments are labelled server amounts; refunds stay pending until confirmed; no derivation from orders | `SettlementLine`, `Refund`; lines are not summed or reconciled; "Refund pending, not final until the payment provider confirms it" vs "Refund confirmed by the payment provider" |
| 6 | Only an already-masked payout label | `payoutDestinationLabel`; refused unless it has a mask and shows at most four digits |
| 7 | Restaurant currency and time zone; reject mismatches and malformed money; keep server periods | The mapper refuses other currencies and non-integer, unsafe or (where not allowed) negative amounts; periods are shown as supplied |
| 8 | Owner-oriented UI; the backend enforces authorization | No role features; unknown or out-of-scope IDs are "Settlement not found" |
| 9 | Proposed contracts, marked PROPOSED | `api-source.ts`, this document |

## Routes

| Route | What it is |
|---|---|
| `/wallet` | Named balances, the masked payout destination, and the latest 5 settlements |
| `/wallet/settlements` | Paginated settlements: period, status, orders, gross, net |
| `/wallet/settlements/[settlementId]` | One settlement: status and amounts, labelled lines, and a paginated order breakdown |

State lives in the URL: `/wallet/settlements?page=<n>` and, on a settlement,
`/wallet/settlements/<id>?page=<n>&orders=<n>` (the list page for "back" and
the breakdown page). A page is exactly a positive whole number; anything else
("3.5", "03", "5abc", "0") is page 1. A page past the end shows the last page
when the source gives totals, or "There is nothing on this page" when it
doesn't. Unknown IDs and malformed percent-encodings are "Settlement not
found". The settlement ID is an opaque value for the API only: it never decides
which restaurant's data is shown.

The list and the breakdown are a table from `md` up and cards below. Dates use
the restaurant's time zone and locale; money uses its currency.

## What is and isn't shown

- Every figure is exactly what the source supplied, or "—" with "Not available"
  for screen readers. **Nothing is calculated**: no total of the balances, no
  net from gross, no sum of lines or of orders, no commission from an order
  total, no derivation from order data and no total from a partial list.
- A settlement's period is the pair of calendar dates the source sends
  (restaurant-local, inclusive), shown as given and never shifted into another
  time zone or invented.
- A negative amount (a deduction, or a net below zero) shows its minus sign.
- The pages say the figures are "shown as provided by Foodi's settlement
  service" and that the page "doesn't verify them or any bank transfer". A
  "Paid" status is what the service reports, not proof of a transfer.
- An order in the breakdown links to `/orders/[orderId]` **only** when the source
  supplied a well-formed order ID. Without one, the reference is plain text.
  Orders needed no change.
- The order breakdown loads and fails separately, so its failure never hides the
  settlement.
- States: loading (skeleton), empty ("No settlements yet"), error with retry,
  forbidden, not found, not connected, and a page past the end.

## Privacy and production

- **Masking is presentation, not security.** The backend must authorize every
  request, return only this restaurant's data, and return a masked payout
  label.
- The API mapper (`api-mapping.ts`) reads a fixed list of fields. Raw account
  numbers, IBANs, bank names, customer names or restaurant IDs sent alongside
  are never read, so they can't reach a screen. A payout label that isn't
  masked is **refused** (the screen shows a load failure, not the value).
- Mapper errors name the problem and never repeat a value, so no financial
  payload is logged by it.
- Production never falls back to preview data. With no API, every wallet URL
  shows "Wallet isn't connected yet", whatever `?preview=` says, with no
  amounts, statuses or payout labels.
- Preview data is an explicit development opt-in
  (`FOODI_WALLET_DATA_SOURCE=preview`), labelled "Preview only, not saved to
  Foodi", and refused in production builds. It is read-only, so there are no
  preview tools. Scenarios: `?preview=empty|error|slow|forbidden`.

```bash
FOODI_WALLET_DATA_SOURCE=preview npm run dev
```

Sample data: 14 settlements with obviously fictional amounts (gross is a
multiple of 1,111.00), a made-up masked label (`Preview bank •••• ••00`) and
orders taken from the Orders preview fixtures, so each links to a sample order
that exists. `prv-set-01` has a two-page breakdown (15 orders), `prv-set-02` a
pending refund, `prv-set-03` a confirmed one, `prv-set-05` an order with no
order ID, `prv-set-06` no status and no destination, `prv-set-09` no amounts,
and `prv-set-14` no orders. The preview plays the server for pagination only
and is no evidence of how the backend will compute anything.

## PROPOSED API contract

None of this is implemented, approved or agreed. All requests use the seller
session. The restaurant is never a parameter. Every amount is
`{ "amountMinor": <integer>, "currency": "<restaurant currency>" }`.

`GET /seller/wallet`

```json
{
  "pendingSettlement": { "amountMinor": 333300, "currency": "INR" },
  "paidOut": { "amountMinor": 9999900, "currency": "INR" },
  "onHold": null,
  "asOf": "2026-10-28T09:00:00Z",
  "payoutDestinationLabel": "Bank •••• 1234"
}
```

All fields may be `null` or absent. Balances are non-negative.
`payoutDestinationLabel` must already be masked by the server.

`GET /seller/settlements?page=&pageSize=`

```json
{
  "items": [
    {
      "id": "set_8f3a",
      "periodStart": "2026-10-01",
      "periodEnd": "2026-10-07",
      "status": "paid",
      "grossAmount": { "amountMinor": 111100, "currency": "INR" },
      "netAmount": { "amountMinor": 99000, "currency": "INR" },
      "orderCount": 12,
      "paidAt": "2026-10-09T10:00:00Z"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "totalItems": 14,
  "totalPages": 2,
  "hasNextPage": true
}
```

- Newest period first; `pageSize` is 10 (5 for the overview).
- `periodStart` and `periodEnd` are restaurant-local `YYYY-MM-DD` dates,
  inclusive, with start not after end.
- `status` is one of **PROPOSED** `pending`, `processing`, `paid`, `failed`,
  `on_hold`. Anything else is refused.
- `grossAmount` is non-negative. `netAmount` may be negative. `orderCount` is a
  non-negative integer. `status`, `grossAmount`, `netAmount`, `orderCount` and
  `paidAt` may be `null`.
- `hasNextPage` is required. `totalItems` and `totalPages` may be `null`. When
  both are given they must agree with each other and with `hasNextPage`.

`GET /seller/settlements/{settlementId}`: the same fields plus

```json
{
  "payoutDestinationLabel": "Bank •••• 1234",
  "lines": [
    { "kind": "commission", "label": "Platform commission", "amount": { "amountMinor": -11110, "currency": "INR" } },
    { "kind": "refund", "label": "Refund, order A-1001", "amount": { "amountMinor": -5000, "currency": "INR" }, "refundStatus": "pending" }
  ]
}
```

- `kind` is one of **PROPOSED** `commission`, `fee`, `tax`, `adjustment`,
  `refund`. `label` and `amount` come from the server. A positive amount adds
  to the settlement and a negative one deducts. `lines` is required and may be
  empty.
- `refundStatus` (`pending` or `confirmed`, **PROPOSED**) is required on refund
  lines and forbidden on all others. PRD P2: `confirmed` only once the payment
  provider confirms the refund.
- The UI does not check that lines add up to `netAmount`, and says so.
- `404` means no such settlement **for this restaurant**. `403` means the
  session may not view the wallet.

`GET /seller/settlements/{settlementId}/orders?page=&pageSize=`

```json
{
  "items": [
    {
      "id": "ord_1",
      "reference": "A-1001",
      "placedAt": "2026-10-02T10:00:00Z",
      "orderTotal": { "amountMinor": 52000, "currency": "INR" },
      "commission": { "amountMinor": -5200, "currency": "INR" },
      "net": { "amountMinor": 46800, "currency": "INR" },
      "refund": { "amount": { "amountMinor": -2500, "currency": "INR" }, "status": "pending" }
    }
  ],
  "page": 1,
  "pageSize": 10,
  "totalItems": 12,
  "totalPages": 2,
  "hasNextPage": true
}
```

`id` is the order ID the existing `/orders/[orderId]` page uses and may be
absent (then no link). `reference` is required. Every other field may be
`null`. `orderTotal` is non-negative. `commission`, `net` and `refund.amount`
may be negative. The same `404`, `403` and pagination rules apply.

## Backend dependencies and limitations

- A settlement, commission and fee model, and who calculates and verifies it.
  The UI shows it and does not.
- The settlement schedule and payout policy (PRD Q5): left undecided and not
  stated by the UI.
- Refund reporting, including confirmation by the payment provider (PRD P2).
- Seller authentication and session (AUTH-01) and server-side restaurant
  scoping and authorization. Not implemented anywhere.
- Server-side masking of the payout destination.
- Out of scope, as approved: withdrawals, payout initiation, payout-destination
  editing or reveal, statements, exports, instant payouts, Plans & billing,
  tax and packaging settings, analytics and reports (B5b).
- Linking an order to its settlement needs a settlement ID on orders. That would
  change the Orders model, so B6c doesn't do it.

## Files

- `src/lib/wallet/`: `types.ts`, `query.ts`, `api-mapping.ts`, `adapter.ts`,
  `api-source.ts` (PROPOSED paths), `preview-source.ts`, `fixtures/wallet.ts`,
  `service.ts`.
- `src/components/wallet/`: summary, list, detail, pagination, values, states.
- `src/app/(dashboard)/wallet/`: `page.tsx`, `settlements/page.tsx`,
  `settlements/[settlementId]/page.tsx` and `not-found.tsx`.
- Tests: `src/lib/wallet/*.test.ts`, `src/components/wallet/*.test.tsx`,
  `tests/e2e/preview/wallet.spec.ts`, and the wallet routes in
  `tests/e2e/production/production.spec.ts`.
