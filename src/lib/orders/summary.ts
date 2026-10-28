import { localDateOf } from "@/lib/time/format"

import { ORDER_STATUSES, type OrderStatus, type OrderSummary } from "./types"

// Today's orders by status (B5a, decision B5-D2). The working model for the
// PROPOSED `GET /seller/orders/summary?date=YYYY-MM-DD` (docs/dashboard-ui.md).
// "Today" is the restaurant-local calendar date of placement, never the
// browser's date and never the scheduled service date.

export type OrdersDaySummary = {
  /** Restaurant-local calendar date the counts are for, YYYY-MM-DD. */
  date: string
  /** The restaurant's IANA zone the date is in. */
  timeZone: string
  /** Every canonical status, including zeros; never guessed or filled in. */
  countsByStatus: Record<OrderStatus, number>
  /** When the counts were worked out (UTC). */
  asOf: string
  /** "preview_estimate" only in preview mode; never live figures. */
  source: "server" | "preview_estimate"
}

/**
 * Counts orders placed on `date` in `timeZone`, by status. Used by the
 * preview data source to simulate the server. An order scheduled for today
 * but placed on another day isn't counted; rejected and cancelled orders
 * (including those the system cancelled for a failed payment, D4) are,
 * because an order record exists for them.
 */
export function countOrdersPlacedOn(
  orders: readonly Pick<OrderSummary, "placedAt" | "status">[],
  date: string,
  timeZone: string
): Record<OrderStatus, number> {
  const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<OrderStatus, number>
  for (const order of orders) {
    if (localDateOf(order.placedAt, timeZone) === date) counts[order.status] += 1
  }
  return counts
}

export const totalOrders = (counts: Record<OrderStatus, number>) =>
  ORDER_STATUSES.reduce((sum, status) => sum + counts[status], 0)
