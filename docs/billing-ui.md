# Plan & billing UI (B6d)

`/billing` follows PRD v0.3 §1 module 19, Release 1: **current plan, commission
or subscription**. It is read-only. Upgrade and downgrade, invoices and the
add-ons marketplace are Release 2 and 3 and none is built. No plan or billing
API exists yet, so production shows "Billing isn't connected yet", with no plan,
fee, date or status. Everything works only against labelled preview data.
Everything below about the API is a **PROPOSAL** that is **NOT IMPLEMENTED**
and not agreed with the backend team (PRD §9.1).

The PRD names no plan, subscription, fee or invoice entity: its data model
(§2) lists settlements and payouts but no plan, and no open question or
decision covers plans, trials, renewals, failed payments or tax. The UI
supports the proposed contract. That does **not** mean plan assignment, fee
terms, tax rules, renewal, trial or payment-failure handling exist anywhere.
They are backend work.

## A business input that still needs confirming

A platform fee of "₹10 + GST" was mentioned as a business input. **It is not in
the PRD or in this repository, and it is not treated as a rule here:** nothing
in the code or the fixtures hard-codes ₹10, a percentage, or any tax. The page
shows only the fee terms the server sends for the restaurant. Before backend
integration, the business must confirm:

- whether such a fee exists, and whether it is the same for every restaurant or
  specific to a plan;
- whether it is a fixed amount, a percentage, or set per plan;
- how the tax applies, and whether amounts are shown with or without it.

None of these answers changes the UI. Each is expressed through the server's
`feeTerms`.

## Decisions applied

| # | Decision | Where it shows |
|---|---|---|
| 1 | The models are `commission`, `subscription` and `hybrid` (PROPOSED). The server decides; the UI assumes none | `PLAN_MODELS` (`types.ts`); a missing model is "Not available"; unknown values are refused |
| 2 | No hard-coded platform fee | There is no fee constant anywhere. Fee terms come from the response only |
| 3 | ₹10 + GST is unconfirmed, not a universal rule or a fixture assumption | This section; the fixtures use made-up values (₹11.11, 12.34%, "Preview tax" at 11.11%), and a test asserts there is no GST, ₹10.00 or 18% |
| 4 | Show only the server's tax treatment, label and rate; calculate nothing; don't depend on B4b | `FeeTax`; "Amount excludes {label} (rate)" or "Amount includes {label}"; no taxed total exists |
| 5 | One read-only page: plan and status, optional period, renewal and trial dates, entitlements, fee terms, optional notice | `/billing` |
| 6 | Excluded: invoices, billing history, downloads, payment methods, upgrade/downgrade, cancellation, payment actions, plan comparison, dunning, entitlement enforcement | Not built; tests assert no such control or wording |
| 7 | `GET /seller/plan` is PROPOSED; every enum is a proposal | `api-source.ts`, this document |
| 8 | Everything is server-authoritative; nothing derived, calculated, reconciled with Wallet or inferred | See "What is and isn't shown" |
| 9 | Production shows "Billing isn't connected yet" and never falls back to preview | See "Production and preview" |
| 10 | Owner-oriented; no payment, bank, card, UPI or tax-ID fields | The mapper reads a fixed field list |

## What is and isn't shown

- Plan name, model and status; the current period, renewal date and trial end
  date; a list of entitlements; a list of fee terms; and an optional notice.
  Each appears as the source gives it, or as "—" with "Not available" for screen
  readers. A missing status is never "Active"; a missing date is never worked out
  from another one.
- **Status is displayed, never interpreted.** Nothing is derived from a date
  ("renewal passed, so expired"), and no wording says what a restaurant can or
  can't do under a status. Past-due, expired and cancelled show the label and
  the server's optional notice only. Payment-failure and expiry handling, and
  any consequence for ordering, are the backend's.
- **Dates** are restaurant-local calendar dates shown exactly as supplied, never
  shifted into another time zone.
- **Fees** are stated in their own basis: "₹11.11 per order", "12.34% of order
  value", or "₹1,111.00 per billing period". The rate arrives in basis points
  and is only formatted. **No fee is calculated**, and there is no estimate,
  example order or total.
- **Tax** is shown only as the server's wording: whether the amount excludes or
  includes it, its label, and its rate if one was given. No tax amount and no
  tax-inclusive total is ever computed. `excluded` means the amount shown does
  not include the tax; `included` means it does.
- **Entitlements** are listed as text. Nothing is enabled, disabled or gated by
  them, and the Wallet pages don't consult them (PRD §6 mentions withdrawals "if
  the plan allows"; B6c has none).
- The notice is wording from the server, rendered as plain text and never as
  markup.
- The page says once that it is shown as provided by Foodi's billing service,
  doesn't calculate fees or tax, doesn't check or change what the restaurant
  can do, and isn't an invoice. Billing is not reconciled with Wallet, and the
  two never reference each other.
- States: loading (skeleton), "No plan found", error with retry, forbidden, and
  not connected.

**"No plan" and "not found".** The proposed API answers `404` when the
restaurant has no plan. The page treats that as the "No plan found" state,
which is also its not-found state: a single-record page has nothing else to be
"not found". It is neither an error nor "not connected".

## Privacy and production

- **Hiding is presentation, not security.** The backend must authorize every
  request and return only this restaurant's plan. The restaurant is never a
  parameter: a restaurant ID or any `plan`/`status` parameter in the URL is
  ignored.
- The API mapper (`api-mapping.ts`) reads a fixed list of fields, so card,
  bank, UPI or tax-ID details sent alongside can't reach a screen. It refuses
  unknown models, statuses, fee bases and tax treatments, malformed dates,
  fractional, negative, unsafe or wrong-currency amounts, rates outside 0 to
  100%, and a fee that carries both or neither of an amount and a rate. Its
  errors never repeat a value.
- Production never falls back to preview data. With no API, `/billing` shows
  "Billing isn't connected yet" whatever `?preview=` says, with no plan, fee,
  date, status or notice.
- Preview data is an explicit development opt-in
  (`FOODI_BILLING_DATA_SOURCE=preview`), labelled "Preview only, not saved to
  Foodi", and refused in production builds. It is read-only, so there are no
  preview tools. Scenarios: `?preview=empty|error|slow|forbidden` for states and
  `?preview=past_due|trial|minimal` for plan variants.

```bash
FOODI_BILLING_DATA_SOURCE=preview npm run dev
```

## PROPOSED API contract

None of this is implemented, approved or agreed. The request uses the seller
session. Every enum value below is **PROPOSED**.

`GET /seller/plan`

```json
{
  "id": "plan_8f3a",
  "name": "Example plan",
  "model": "hybrid",
  "status": "active",
  "renewsOn": "2026-11-20",
  "trialEndsOn": null,
  "periodStart": "2026-10-20",
  "periodEnd": "2026-11-19",
  "notice": null,
  "entitlements": [
    { "label": "Example entitlement", "detail": "Optional explanation" }
  ],
  "feeTerms": [
    {
      "label": "Per-order fee",
      "basis": "per_order",
      "amount": { "amountMinor": 1111, "currency": "INR" },
      "tax": { "label": "Tax", "treatment": "excluded", "rateBasisPoints": 1111 }
    },
    {
      "label": "Percentage fee",
      "basis": "percentage_of_order",
      "rateBasisPoints": 1234,
      "tax": { "label": "Tax", "treatment": "included" }
    }
  ]
}
```

- `id` (opaque), `name`, `entitlements` and `feeTerms` are required; the lists
  may be empty (at most 50 and 20). Everything else may be `null` or absent.
- `model`: `commission`, `subscription` or `hybrid`.
  `status`: `active`, `trialing`, `past_due`, `expired` or `cancelled`. Anything
  else is refused.
- `renewsOn`, `trialEndsOn`, `periodStart` and `periodEnd` are restaurant-local
  `YYYY-MM-DD` dates. When both period dates are given, start is not after end.
- `notice`: server wording, at most 300 characters, shown as plain text.
- `feeTerms[].basis`: `per_order` or `per_period` carry `amount` (a non-negative
  integer `amountMinor` in the restaurant's currency) and no rate;
  `percentage_of_order` carries `rateBasisPoints` (0 to 10000; 1234 is 12.34%)
  and no amount.
- `feeTerms[].tax`: `label`, `treatment` (`excluded` or `included`) and an
  optional `rateBasisPoints`. The server decides what the tax is called; the UI
  doesn't assume any particular tax.
- `404`: this restaurant has no plan. `403`: the session may not view billing.

## Backend dependencies and limitations

- A plan, subscription and fee model; which models exist (P1), and whether fees
  are universal or per plan.
- The business confirmation described above.
- Billing cycles, renewals, trial periods, and what happens on expiry or a
  failed payment, including any effect on the restaurant. The UI claims none.
- Seller authentication and session (AUTH-01) and server-side restaurant
  scoping and authorization. Not implemented anywhere.
- Out of scope, as approved: invoices, billing history, downloads, payment-method
  management, upgrade and downgrade, cancellation, payment actions, plan
  comparison, dunning, entitlement enforcement, and any tax calculation. Tax and
  packaging settings (B4b) remain a separate, unbuilt module.

## Files

- `src/lib/billing/`: `types.ts`, `api-mapping.ts`, `adapter.ts`, `api-source.ts`
  (PROPOSED path), `preview-source.ts`, `fixtures/billing.ts`, `service.ts`.
- `src/components/billing/`: plan details, values, states.
- `src/app/(dashboard)/billing/page.tsx`.
- Tests: `src/lib/billing/*.test.ts`, `src/components/billing/*.test.tsx`,
  `tests/e2e/preview/billing.spec.ts`, and the billing routes in
  `tests/e2e/production/production.spec.ts`.
