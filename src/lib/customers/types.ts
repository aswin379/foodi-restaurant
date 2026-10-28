import type { DeliveryMode, OrderType } from "@/lib/domain/order-types"
import type { Money, OrderStatus, PaymentStatus } from "@/lib/orders/types"

// Customers model (B6b, PRD §1 module 14 Release 1: "order history per
// customer, masked contact details"). The PRD names no customer fields and no
// customer entity exists in this repo, so everything here is a PROPOSAL
// (docs/customers-ui.md): the smallest shape the approved decisions C1–C9
// need. Nothing is derived in the frontend: metrics are server-provided or
// unavailable (null).

/**
 * C8: "recent" is last order newest first, then name A–Z. "name" is A–Z.
 * Metric-based sorts aren't offered: the source can't be shown to support them.
 */
export const CUSTOMER_SORTS = ["recent", "name"] as const
export type CustomerSort = (typeof CUSTOMER_SORTS)[number]

export const DEFAULT_CUSTOMER_SORT: CustomerSort = "recent"

export const customerSortLabels: Record<CustomerSort, string> = {
  recent: "Last order",
  name: "Name A–Z",
}

export type Customer = {
  /**
   * C1: a backend-issued opaque ID for this restaurant's customer
   * relationship. Never a phone number, email address or name.
   */
  id: string
  /** Display name only. Null when the customer's name isn't shared. */
  displayName: string | null
  /** C6: already masked by the backend; shown as given, never revealed. */
  phoneMasked: string | null
  emailMasked: string | null
  /** C3: server-provided (completed orders). Null when the source doesn't supply it (C9). */
  orderCount: number | null
  /** C3–C5: server-provided, restaurant currency, completed orders less confirmed refunds. */
  lifetimeSpend: Money | null
  /** UTC instant of the most recent order. Null when not supplied (C9). */
  lastOrderAt: string | null
}

export type CustomerDetail = Customer & {
  /** UTC instant of the first order. Null when not supplied. */
  firstOrderAt: string | null
}

export type CustomerListQuery = {
  /** C8: case-insensitive name search, at most 60 characters. Empty means no search. */
  search: string
  sort: CustomerSort
  page: number
  pageSize: number
}

/** C9: totals are null when the source has no authoritative count; `hasNextPage` is then the only way on. */
export type PageInfo = {
  page: number
  pageSize: number
  totalItems: number | null
  totalPages: number | null
  hasNextPage: boolean
}

export type CustomerListResult = PageInfo & {
  items: Customer[]
  /** Sorts the source applied reliably. The UI disables any other (C8, C9). */
  supportedSorts: CustomerSort[]
}

/**
 * One row of a customer's order history. A dedicated shape (not the Orders
 * model) so Orders needs no customer association (approved scope).
 */
export type CustomerOrderSummary = {
  id: string
  reference: string
  placedAt: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  orderType: OrderType
  deliveryMode: DeliveryMode | null
  itemCount: number
  total: Money
}

export type CustomerOrdersQuery = {
  page: number
  pageSize: number
}

export type CustomerOrdersResult = PageInfo & {
  items: CustomerOrderSummary[]
}
