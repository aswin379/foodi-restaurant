import { ServiceError } from "@/lib/data-source/errors"
import { ACTIVE_ORDER_STATUSES, ORDER_STATUSES, type OrderStatus, type OrderSummary } from "@/lib/orders/types"

// Live orders by status for the dashboard (B5a), from the same board data the
// Orders board shows. These are orders active right now, not a count of
// orders placed today (that's the day summary).

export type ActiveOrderStatus = (typeof ACTIVE_ORDER_STATUSES)[number]

/**
 * Board order of the dashboard counts, with the board's own names and the
 * board section each links to (`/orders#…`, ids from orders-board.tsx).
 */
export const LIVE_STATUSES: readonly { status: ActiveOrderStatus; label: string; anchor: string }[] = [
  { status: "pending", label: "New", anchor: "board-new" },
  { status: "accepted", label: "In kitchen", anchor: "board-kitchen" },
  { status: "ready", label: "Ready", anchor: "board-ready" },
  { status: "out_for_delivery", label: "Out for delivery", anchor: "board-ready" },
  { status: "scheduled", label: "Scheduled", anchor: "board-scheduled" },
]

const isActive = (status: OrderStatus): status is ActiveOrderStatus =>
  (ACTIVE_ORDER_STATUSES as readonly string[]).includes(status)

/**
 * Counts board orders by status. A status that isn't canonical, or isn't an
 * active one, means the data can't be trusted: it's an error for this
 * section, never folded into another count.
 */
export function countLiveOrders(orders: readonly Pick<OrderSummary, "status">[]): Record<ActiveOrderStatus, number> {
  const counts = Object.fromEntries(ACTIVE_ORDER_STATUSES.map((status) => [status, 0])) as Record<ActiveOrderStatus, number>
  for (const { status } of orders) {
    if (!(ORDER_STATUSES as readonly string[]).includes(status) || !isActive(status)) {
      throw new ServiceError("unavailable", `Unexpected order status on the board: ${String(status)}`)
    }
    counts[status] += 1
  }
  return counts
}
