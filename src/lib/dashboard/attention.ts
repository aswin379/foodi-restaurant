import type { PauseState } from "@/lib/hours/types"
import { NEW_ORDER_ATTENTION_MINUTES, orderTiming } from "@/lib/orders/timing"
import type { OrderDetail } from "@/lib/orders/types"

// "Needs attention" on the dashboard (B5a, decision B5-D3). Built only from
// data the modules already serve, with the Orders module's own timing rules
// (orderTiming); nothing here re-decides when an order is late. The 5-minute
// waiting threshold is B1's provisional NEW_ORDER_ATTENTION_MINUTES.

export type AttentionItem = {
  id: "paused" | "waiting" | "late" | "unavailable_lines" | "sold_out"
  title: string
  description: string
  href: string
  linkLabel: string
}

/** What each source supplied; null = that source couldn't be read (shown separately, never guessed). */
export type AttentionInput = {
  pause: PauseState | null
  board: readonly Pick<OrderDetail, "id" | "reference" | "status" | "placedAt" | "readyBy" | "scheduledFor" | "items">[] | null
  soldOut: { count: number; names: readonly string[] } | null
  nowMs: number
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

function references(orders: readonly { reference: string }[]) {
  const shown = orders.slice(0, 3).map((order) => order.reference)
  return orders.length > 3 ? `${shown.join(", ")} and ${orders.length - 3} more` : shown.join(", ")
}

export function attentionItems({ pause, board, soldOut, nowMs }: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = []

  if (pause?.paused) {
    items.push({
      id: "paused",
      title: "New orders are paused",
      description: pause.reason ? `Reason: ${pause.reason}` : "Customers can't place new orders until you resume.",
      href: "/hours",
      linkLabel: "Manage pause",
    })
  }

  if (board) {
    const timed = board.map((order) => ({ order, timing: orderTiming(order, nowMs) }))
    const waiting = timed.filter(({ timing }) => timing.kind === "waiting" && timing.needsAttention).map(({ order }) => order)
    if (waiting.length) {
      items.push({
        id: "waiting",
        title: `${plural(waiting.length, "new order", "new orders")} waiting ${NEW_ORDER_ATTENTION_MINUTES} minutes or more`,
        description: references(waiting),
        href: "/orders#board-new",
        linkLabel: "Go to new orders",
      })
    }
    const late = timed.filter(({ timing }) => timing.kind === "late").map(({ order }) => order)
    if (late.length) {
      items.push({
        id: "late",
        title: `${plural(late.length, "order", "orders")} past the ready time`,
        description: references(late),
        href: "/orders#board-kitchen",
        linkLabel: "Go to the kitchen column",
      })
    }
    // Only the server's own per-line flag counts (PRD §3.10); never current sold-out or stock state.
    const flagged = board.filter((order) => order.items.some((item) => item.unavailableAfterPlacement !== null))
    if (flagged.length) {
      items.push({
        id: "unavailable_lines",
        title: `${plural(flagged.length, "active order has", "active orders have")} items marked unavailable after placing`,
        description: references(flagged),
        href: flagged.length === 1 ? `/orders/${encodeURIComponent(flagged[0].id)}` : "/orders",
        linkLabel: flagged.length === 1 ? `Open order ${flagged[0].reference}` : "Go to the board",
      })
    }
  }

  if (soldOut && soldOut.count > 0) {
    const shown = soldOut.names.slice(0, 3)
    const rest = soldOut.count - shown.length
    items.push({
      id: "sold_out",
      title: `${plural(soldOut.count, "menu item is", "menu items are")} sold out`,
      description: rest > 0 ? `${shown.join(", ")} and ${rest} more` : shown.join(", "),
      href: "/menu?filter=sold_out",
      linkLabel: "See sold-out items",
    })
  }

  return items
}
