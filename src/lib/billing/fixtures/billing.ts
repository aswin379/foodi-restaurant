import "server-only"

import type { Plan } from "../types"

// DEVELOPMENT PREVIEW DATA ONLY. Obviously fictional plans for previewing the
// UI while the billing API is built. Nothing here is a real plan, price, fee
// or tax rule, and no figure is a business assumption: the amounts are
// repeating digits (11.11, 1,111.00), the rates are 12.34 percent and 11.11
// percent, and the tax is called "Preview tax". The fee values are NOT the
// platform's pricing, and a platform fee of any particular amount or tax is a
// business decision that isn't established by the PRD or this repository.
// Only src/lib/billing/preview-source.ts may import this file.

const CURRENCY = "INR"
const DAY = 86_400_000

const money = (amountMinor: number) => ({ amountMinor, currency: CURRENCY })
const dateOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** Variants for `?preview=` scenarios. */
export type PreviewPlanVariant = "default" | "past_due" | "trial" | "minimal"

export function buildFixturePlan(now: number, variant: PreviewPlanVariant = "default"): Plan {
  const base: Plan = {
    id: "prv-plan-01",
    name: "Preview plan",
    model: "hybrid",
    status: "active",
    renewsOn: dateOf(now + 21 * DAY),
    trialEndsOn: null,
    periodStart: dateOf(now - 9 * DAY),
    periodEnd: dateOf(now + 20 * DAY),
    notice: null,
    entitlements: [
      { label: "Preview entitlement A", detail: "Shown as the source describes it" },
      { label: "Preview entitlement B", detail: null },
      { label: "Preview entitlement C", detail: "A made-up detail" },
    ],
    feeTerms: [
      {
        label: "Preview fee per order",
        basis: "per_order",
        amount: money(1111),
        rateBasisPoints: null,
        tax: { label: "Preview tax", treatment: "excluded", rateBasisPoints: 1111 },
      },
      {
        label: "Preview percentage fee",
        basis: "percentage_of_order",
        amount: null,
        rateBasisPoints: 1234,
        tax: { label: "Preview tax", treatment: "included", rateBasisPoints: null },
      },
      {
        label: "Preview period fee",
        basis: "per_period",
        amount: money(111100),
        rateBasisPoints: null,
        tax: null,
      },
    ],
  }

  switch (variant) {
    case "past_due":
      return { ...base, status: "past_due", notice: "Preview notice: this is made-up wording from the billing service." }
    case "trial":
      return {
        ...base,
        model: "subscription",
        status: "trialing",
        trialEndsOn: dateOf(now + 12 * DAY),
        renewsOn: null,
        feeTerms: base.feeTerms.slice(2),
      }
    case "minimal":
      // Everything optional is missing: the page must say so, never fill it in.
      return {
        id: "prv-plan-02",
        name: "Preview plan (minimal)",
        model: null,
        status: null,
        renewsOn: null,
        trialEndsOn: null,
        periodStart: null,
        periodEnd: null,
        notice: null,
        entitlements: [],
        feeTerms: [],
      }
    default:
      return base
  }
}
