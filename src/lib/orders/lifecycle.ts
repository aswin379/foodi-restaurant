import type { FulfilmentMethod, OrderStatus, PaymentStatus } from "./types"

// PROVISIONAL lifecycle (RUI-02). The canonical Foodi order state machine and
// its API are not approved yet, so every action below is presentation only:
// the UI renders them disabled and never performs a transition.

export const LIFECYCLE_PENDING_MESSAGE =
  "Order actions are disabled until the Foodi order lifecycle is approved and the orders API is connected."

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: "New",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
}

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  paid: "Paid",
  failed: "Payment failed",
  refund_pending: "Refund pending",
  refunded: "Refunded",
}

export const fulfilmentLabels: Record<FulfilmentMethod, string> = {
  foodi_delivery: "Foodi delivery",
  restaurant_delivery: "Restaurant delivery",
  pickup: "Pickup",
  dine_in: "Dine-in",
}

export const deliveryFulfilment: ReadonlySet<FulfilmentMethod> = new Set([
  "foodi_delivery",
  "restaurant_delivery",
])

export type ProposedOrderAction = {
  id:
    | "accept"
    | "reject"
    | "start_preparing"
    | "mark_ready"
    | "mark_out_for_delivery"
    | "mark_delivered"
    | "mark_completed"
    | "cancel"
  label: string
  /** Would require a reason from the restaurant (reject, cancel). */
  requiresReason: boolean
  destructive: boolean
}

const accept: ProposedOrderAction = { id: "accept", label: "Accept order", requiresReason: false, destructive: false }
const reject: ProposedOrderAction = { id: "reject", label: "Reject order", requiresReason: true, destructive: true }
const startPreparing: ProposedOrderAction = { id: "start_preparing", label: "Start preparing", requiresReason: false, destructive: false }
const markReady: ProposedOrderAction = { id: "mark_ready", label: "Mark ready", requiresReason: false, destructive: false }
const markOutForDelivery: ProposedOrderAction = { id: "mark_out_for_delivery", label: "Mark out for delivery", requiresReason: false, destructive: false }
const markDelivered: ProposedOrderAction = { id: "mark_delivered", label: "Mark delivered", requiresReason: false, destructive: false }
const markCompleted: ProposedOrderAction = { id: "mark_completed", label: "Mark completed", requiresReason: false, destructive: false }
const cancel: ProposedOrderAction = { id: "cancel", label: "Cancel order", requiresReason: true, destructive: true }

/**
 * Restaurant actions the proposed model would offer for an order. Open
 * questions (whether restaurants may cancel after accepting, who advances
 * Foodi deliveries) are listed in docs/orders-ui.md.
 */
export function proposedActionsFor(
  status: OrderStatus,
  fulfilment: FulfilmentMethod
): ProposedOrderAction[] {
  switch (status) {
    case "pending":
      return [accept, reject]
    case "accepted":
      return [startPreparing, cancel]
    case "preparing":
      return [markReady, cancel]
    case "ready":
      if (fulfilment === "restaurant_delivery") return [markOutForDelivery]
      // Foodi delivery is advanced by the delivery partner, not the restaurant.
      if (fulfilment === "foodi_delivery") return []
      return [markCompleted]
    case "out_for_delivery":
      return fulfilment === "restaurant_delivery" ? [markDelivered] : []
    default:
      return []
  }
}
