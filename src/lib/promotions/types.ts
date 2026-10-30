import type { OrderType } from "@/lib/domain/order-types"
import type { Money } from "@/lib/orders/types"

// Promotions model (B6e, PRD §1 module 12, Release 1: "Coupons"; §6: "code,
// percent or flat amount, minimum order, max discount, per-user limit,
// validity"). The PRD defines no promotion entity, status, funding, usage or
// stacking field, so this model is a PROPOSAL (docs/promotions-ui.md) and NOT
// IMPLEMENTED by any backend. Every enum below is a PROPOSED value.
//
// The screens are read-only and show server-provided values exactly. The panel
// calculates no discount or saving, infers no eligibility, derives no status
// or validity from a date, never works out who pays, and never adjusts a
// redemption count for cancellations or refunds. A missing value is `null`
// (unavailable), never a default. Item offers, BOGO, happy hour, auto-apply and
// loyalty points are Release 2 and 3 and are not modelled.

export type { Money, OrderType }

/** PROPOSED. Release 1 is coupons only. */
export const PROMOTION_KINDS = ["coupon"] as const
export type PromotionKind = (typeof PROMOTION_KINDS)[number]

/**
 * PROPOSED. What the promotions service reports, shown as given. It is never
 * worked out from the start and end dates.
 */
export const PROMOTION_STATUSES = ["scheduled", "active", "paused", "expired", "cancelled"] as const
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number]

export const promotionStatusLabels: Record<PromotionStatus, string> = {
  scheduled: "Scheduled",
  active: "Active",
  paused: "Paused",
  expired: "Expired",
  cancelled: "Cancelled",
}

/** The list filter: one reported status, or all. */
export const PROMOTION_STATUS_FILTERS = ["all", ...PROMOTION_STATUSES] as const
export type PromotionStatusFilter = (typeof PROMOTION_STATUS_FILTERS)[number]

/** PROPOSED. The parts of an order a coupon applies to, only as the source lists them. */
export const PROMOTION_COMPONENTS = ["subtotal", "delivery_fee", "packaging_fee"] as const
export type PromotionComponent = (typeof PROMOTION_COMPONENTS)[number]

export const promotionComponentLabels: Record<PromotionComponent, string> = {
  subtotal: "Item subtotal",
  delivery_fee: "Delivery fee",
  packaging_fee: "Packaging fee",
}

/** PROPOSED. Who pays for the discount, only as the source states it. Never inferred. */
export const PROMOTION_FUNDING = ["restaurant", "foodi", "shared"] as const
export type PromotionFunding = (typeof PROMOTION_FUNDING)[number]

export const promotionFundingLabels: Record<PromotionFunding, string> = {
  restaurant: "Your restaurant",
  foodi: "Foodi",
  shared: "Shared between your restaurant and Foodi",
}

/** PROPOSED. Who manages the coupon, as a label only. The panel has no edit action either way. */
export const PROMOTION_MANAGERS = ["restaurant", "foodi"] as const
export type PromotionManager = (typeof PROMOTION_MANAGERS)[number]

export const promotionManagerLabels: Record<PromotionManager, string> = {
  restaurant: "Your restaurant",
  foodi: "Foodi",
}

/**
 * Exactly one form. A percentage carries a rate in whole basis points
 * (1 percent is 100) and an optional cap; a fixed amount carries an amount.
 */
export type PromotionDiscount =
  | { type: "percentage"; rateBasisPoints: number; maxDiscount: Money | null }
  | { type: "fixed_amount"; amount: Money }

export type Promotion = {
  /** Opaque. */
  id: string
  kind: PromotionKind
  /** The code a customer enters, shown as given. */
  code: string
  name: string | null
  status: PromotionStatus | null
  discount: PromotionDiscount
  minimumOrder: Money | null
  /** UTC instants, shown in the restaurant's time zone. */
  startsAt: string | null
  endsAt: string | null
  /** Null means the source doesn't say; the panel never assumes "all". */
  orderTypes: OrderType[] | null
  appliesTo: PromotionComponent[] | null
  fundedBy: PromotionFunding | null
  managedBy: PromotionManager | null
  /** Whether it can be combined with other promotions, only when the source says. */
  stackable: boolean | null
  usageLimit: number | null
  perCustomerLimit: number | null
  /** Authoritative, as counted by Foodi. Never adjusted here. */
  redemptionCount: number | null
}

export type PromotionListQuery = {
  status: PromotionStatusFilter
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

export type PromotionListResult = PageInfo & { items: Promotion[] }
