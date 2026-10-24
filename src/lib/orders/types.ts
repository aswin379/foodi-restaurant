import type { DeliveryMode, OrderType } from "@/lib/domain/order-types"

// Restaurant order model for the Foodi panel, following PRD v0.3 §4. It's the
// frontend's working model, not a confirmed backend contract: field names and
// enum values are mapped to the API in src/lib/api/mapping.ts once that exists.

/**
 * PRD §4.1. `preparing` is not a status: it's the accepted state from the
 * moment `preparationStartedAt` is set (D3, Q10 Option A: at acceptance).
 */
export const ORDER_STATUSES = [
  "scheduled",
  "pending",
  "accepted",
  "ready",
  "out_for_delivery",
  "completed",
  "rejected",
  "cancelled",
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** Statuses shown on the live board. */
export const ACTIVE_ORDER_STATUSES = [
  "scheduled",
  "pending",
  "accepted",
  "ready",
  "out_for_delivery",
] as const satisfies readonly OrderStatus[]

/** Payment state lives on the payment, never on the order status (D4). */
export const PAYMENT_STATUSES = [
  "unpaid",
  "paid",
  "failed",
  "refund_pending",
  "refunded",
] as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export type PaymentMethod = "online" | "cash"

/** Amounts are integers in the currency's minor unit (e.g. paise). */
export type Money = {
  amountMinor: number
  currency: string
}

export type OrderActor = "customer" | "restaurant" | "foodi" | "system"

export type OrderSummary = {
  id: string
  reference: string
  placedAt: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod | null
  orderType: OrderType
  /** Only for delivery orders: Foodi rider or the restaurant's own rider. */
  deliveryMode: DeliveryMode | null
  /** Display name as shared by the platform; null when not available. */
  customerName: string | null
  itemCount: number
  itemsPreview: string
  total: Money
  /** Requested slot for scheduled (order-ahead) orders. */
  scheduledFor: string | null
  /** Server-authoritative; set at acceptance in Release 1 (Q10). */
  preparationStartedAt: string | null
  prepTimeMinutes: number | null
  /** preparationStartedAt + prepTimeMinutes, computed by the server. */
  readyBy: string | null
  /** Lines marked unavailable after the order was placed (PRD §3.10). */
  unavailableLineCount: number
}

export type OrderItem = {
  id: string
  name: string
  quantity: number
  unitPrice: Money
  lineTotal: Money
  /** Selected size and options, already formatted for display. */
  options: string[]
  note: string | null
  /** Set when the dish was marked unavailable after this order was placed. */
  unavailableAfterPlacement: { at: string; by: string } | null
}

export type OrderCharges = {
  subtotal: Money
  discount: Money | null
  tax: Money | null
  deliveryFee: Money | null
  packagingFee: Money | null
  total: Money
}

export type OrderEventType = OrderStatus | "prep_time_adjusted"

export type OrderTimelineEvent = {
  type: OrderEventType
  at: string
  actor: OrderActor
  /** Reason label, for rejection and cancellation. */
  reason: string | null
  /** Free-text note from whoever made the change. */
  note: string | null
  /** Extra facts, e.g. "Prep time 20 min" or the rider's name. */
  detail: string | null
}

export type OrderClosure = {
  actor: OrderActor
  reason: string
  note: string | null
  at: string
}

export type Rider = {
  id: string
  name: string
}

export type OrderDetail = OrderSummary & {
  items: OrderItem[]
  charges: OrderCharges
  /** Only for delivery orders. */
  deliveryAddress: string | null
  /** Only for dine-in. */
  tableLabel: string | null
  customerNote: string | null
  /** Set once an own-rider delivery is dispatched. */
  rider: Rider | null
  timeline: OrderTimelineEvent[]
  /** Set when the order is rejected or cancelled. */
  closure: OrderClosure | null
}

export type OrderListQuery = {
  status: OrderStatus | "all"
  search: string
  /** Inclusive restaurant-local dates, YYYY-MM-DD. */
  from: string | null
  to: string | null
  page: number
  pageSize: number
}

export type OrderListResult = {
  items: OrderSummary[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}
