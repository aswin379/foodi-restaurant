import type { Money } from "@/lib/orders/types"

// Wallet and settlements model (B6c, PRD §1 module 17, Release 1: "earnings,
// settlements list"). The PRD names no fields and no settlement, payout or
// commission entity exists in this repo, so everything here is a PROPOSAL
// (docs/wallet-ui.md) and NOT IMPLEMENTED by any backend.
//
// Every amount is server-provided. Nothing is computed in the frontend: no
// balance, total, commission, net or fee is derived from other amounts or from
// order data, and a missing amount is `null` (unavailable), never zero. The
// payout policy (automatic or restaurant-initiated, PRD Q5) is undecided, so
// nothing here says or implies either.

export type { Money }

/**
 * PROPOSED statuses. A status outside this list is an integration error that
 * fails visibly: it is never guessed and never mapped to "paid". A status says
 * what Foodi's settlement service reports. The panel doesn't verify a bank
 * transfer.
 */
export const SETTLEMENT_STATUSES = ["pending", "processing", "paid", "failed", "on_hold"] as const
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number]

export const settlementStatusLabels: Record<SettlementStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  paid: "Paid",
  failed: "Failed",
  on_hold: "On hold",
}

/** PROPOSED kinds of labelled line in a settlement. The amount and label come from the server. */
export const SETTLEMENT_LINE_KINDS = ["commission", "fee", "tax", "adjustment", "refund"] as const
export type SettlementLineKind = (typeof SETTLEMENT_LINE_KINDS)[number]

export const settlementLineKindLabels: Record<SettlementLineKind, string> = {
  commission: "Commission",
  fee: "Fee",
  tax: "Tax",
  adjustment: "Adjustment",
  refund: "Refund",
}

/** PRD P2: a refund is final only when the payment provider confirms it. */
export const REFUND_STATUSES = ["pending", "confirmed"] as const
export type RefundStatus = (typeof REFUND_STATUSES)[number]

export type Refund = {
  /** Signed like every settlement amount: negative reduces the restaurant's amount. */
  amount: Money
  status: RefundStatus
}

/** Named, nullable, server-provided amounts. No total is ever added up here. */
export type WalletSummary = {
  pendingSettlement: Money | null
  paidOut: Money | null
  onHold: Money | null
  /** UTC instant the figures are as of, when the source says. */
  asOf: string | null
  /** An already-masked label only (such as "Bank •••• 1234"). Never raw account details. */
  payoutDestinationLabel: string | null
}

export type SettlementSummary = {
  id: string
  /** Restaurant-local calendar dates (YYYY-MM-DD), inclusive, exactly as supplied. */
  periodStart: string
  periodEnd: string
  status: SettlementStatus | null
  /** Non-negative, server-provided. */
  grossAmount: Money | null
  /** Signed, server-provided (adjustments can take it below zero). */
  netAmount: Money | null
  orderCount: number | null
  /** UTC instant the service reports payment, if any. */
  paidAt: string | null
}

/**
 * A labelled amount from the server. Positive adds to the settlement, negative
 * deducts. The UI shows it and never recomputes or reconciles it.
 */
export type SettlementLine = {
  kind: SettlementLineKind
  label: string
  amount: Money
  /** Present exactly for refund lines. */
  refundStatus: RefundStatus | null
}

export type SettlementDetail = SettlementSummary & {
  lines: SettlementLine[]
  payoutDestinationLabel: string | null
}

/** One order in a settlement's breakdown. All amounts are server-provided and nullable. */
export type SettlementOrder = {
  /** Present only for an order that has a detail page; the link needs it. */
  id: string | null
  reference: string
  placedAt: string | null
  orderTotal: Money | null
  /** Signed. */
  commission: Money | null
  /** Signed. */
  net: Money | null
  refund: Refund | null
}

export type SettlementListQuery = {
  page: number
  pageSize: number
}

export type SettlementOrdersQuery = {
  page: number
  pageSize: number
}

/** Totals are null when the source has no authoritative count; `hasNextPage` is then the only way on. */
export type PageInfo = {
  page: number
  pageSize: number
  totalItems: number | null
  totalPages: number | null
  hasNextPage: boolean
}

export type SettlementListResult = PageInfo & { items: SettlementSummary[] }
export type SettlementOrdersResult = PageInfo & { items: SettlementOrder[] }
