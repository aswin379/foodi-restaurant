import type { Money } from "@/lib/orders/types"

// Plans & billing model (B6d, PRD §1 module 19, Release 1: "current plan,
// commission or subscription"). The PRD names no plan, subscription, fee or
// invoice entity, so everything here is a PROPOSAL (docs/billing-ui.md) and
// NOT IMPLEMENTED by any backend. Every enum below is a PROPOSED value.
//
// Everything is server-authoritative: plan, status, dates, entitlements, fee
// terms and tax treatment. The panel derives none of it. It calculates no fee,
// no tax, no tax-inclusive total and no invoice amount, doesn't work out a
// status from a date, doesn't reconcile billing with the wallet, and doesn't
// infer or enforce any access restriction from a plan, status or entitlement.
// A missing value is `null` (unavailable), never a default.

export type { Money }

/** PROPOSED. The server decides which model a restaurant is on; the UI assumes none. */
export const PLAN_MODELS = ["commission", "subscription", "hybrid"] as const
export type PlanModel = (typeof PLAN_MODELS)[number]

export const planModelLabels: Record<PlanModel, string> = {
  commission: "Commission",
  subscription: "Subscription",
  hybrid: "Commission and subscription",
}

/**
 * PROPOSED. What the billing service reports, shown as given. A status says
 * nothing here about what the restaurant can or can't do: access rules are the
 * backend's, and the panel neither infers nor enforces them.
 */
export const PLAN_STATUSES = ["active", "trialing", "past_due", "expired", "cancelled"] as const
export type PlanStatus = (typeof PLAN_STATUSES)[number]

export const planStatusLabels: Record<PlanStatus, string> = {
  active: "Active",
  trialing: "In trial",
  past_due: "Past due",
  expired: "Expired",
  cancelled: "Cancelled",
}

/** PROPOSED. Which value a fee term carries: a fixed amount, or a rate in basis points. */
export const FEE_BASES = ["per_order", "percentage_of_order", "per_period"] as const
export type FeeBasis = (typeof FEE_BASES)[number]

/**
 * PROPOSED. Whether the amount in a fee term already contains the tax. The
 * panel shows this wording and never adds, removes or computes tax.
 */
export const TAX_TREATMENTS = ["excluded", "included"] as const
export type TaxTreatment = (typeof TAX_TREATMENTS)[number]

export type FeeTax = {
  /** Server wording for the tax, such as its name. Not assumed to be any particular tax. */
  label: string
  treatment: TaxTreatment
  /** Whole basis points (1 percent is 100), shown as given. Null when the source doesn't say. */
  rateBasisPoints: number | null
}

/** A fee term exactly as the server describes it. `amount` for a fixed basis, `rateBasisPoints` for a percentage. */
export type FeeTerm = {
  label: string
  basis: FeeBasis
  amount: Money | null
  rateBasisPoints: number | null
  tax: FeeTax | null
}

/** A server-supplied entitlement. The panel only lists it and never gates anything on it. */
export type Entitlement = {
  label: string
  detail: string | null
}

export type Plan = {
  /** Opaque. */
  id: string
  name: string
  model: PlanModel | null
  status: PlanStatus | null
  /** Restaurant-local calendar dates (YYYY-MM-DD), exactly as supplied. */
  renewsOn: string | null
  trialEndsOn: string | null
  periodStart: string | null
  periodEnd: string | null
  /** Wording from the server, shown as plain text. */
  notice: string | null
  entitlements: Entitlement[]
  feeTerms: FeeTerm[]
}
