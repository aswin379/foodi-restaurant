// PROVISIONAL domain model for restaurant orders (RUI-02).
// These shapes are the frontend's working assumptions, not an approved backend
// contract. See docs/orders-ui.md for the open lifecycle and API decisions.

export const ORDER_STATUSES = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "rejected",
  "cancelled",
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

// Kept separate from OrderStatus (provisional decision 2).
export const PAYMENT_STATUSES = [
  "unpaid",
  "paid",
  "failed",
  "refund_pending",
  "refunded",
] as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export type PaymentMethod = "online" | "cash"

// Provisional decision 3. Scheduled orders are unsupported until confirmed.
export const FULFILMENT_METHODS = [
  "foodi_delivery",
  "restaurant_delivery",
  "pickup",
  "dine_in",
] as const

export type FulfilmentMethod = (typeof FULFILMENT_METHODS)[number]

/** Amounts are integers in the currency's minor unit (e.g. paise). */
export type Money = {
  amountMinor: number
  currency: string
}

export type OrderSummary = {
  id: string
  reference: string
  placedAt: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfilment: FulfilmentMethod
  /** Display name as shared by the platform; null when not available. */
  customerName: string | null
  itemCount: number
  itemsPreview: string
  total: Money
}

export type OrderItem = {
  id: string
  name: string
  quantity: number
  unitPrice: Money
  lineTotal: Money
  /** Selected options or add-ons, already formatted for display. */
  options: string[]
  note: string | null
}

export type OrderCharges = {
  subtotal: Money
  discount: Money | null
  tax: Money | null
  deliveryFee: Money | null
  packagingFee: Money | null
  total: Money
}

export type OrderTimelineEvent = {
  status: OrderStatus
  at: string
  actor: "customer" | "restaurant" | "foodi" | "system"
  reason: string | null
}

export type OrderDetail = OrderSummary & {
  items: OrderItem[]
  charges: OrderCharges
  paymentMethod: PaymentMethod | null
  /** Only for delivery fulfilment methods. */
  deliveryAddress: string | null
  /** Only for dine-in. */
  tableLabel: string | null
  customerNote: string | null
  timeline: OrderTimelineEvent[]
  /** Set when the order is rejected or cancelled. */
  closureReason: string | null
}

export type OrderListQuery = {
  status: OrderStatus | "all"
  search: string
  /** Inclusive local dates, YYYY-MM-DD. */
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
