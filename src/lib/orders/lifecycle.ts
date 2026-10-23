import { ServiceError } from "@/lib/data-source/errors"
import { deliveryModeLabels, orderTypeLabels } from "@/lib/domain/order-types"

import type { OrderCommand } from "./commands"
import { CANCEL_REASONS, REJECT_REASONS, reasonLabel } from "./reasons"
import type {
  OrderDetail,
  OrderEventType,
  OrderStatus,
  OrderSummary,
  OrderTimelineEvent,
  PaymentStatus,
  Rider,
} from "./types"

// Order lifecycle from PRD v0.3 §4. These rules guide the UI and drive the
// preview adapter; the real backend must enforce the same rules itself (P2):
// hiding a button is never the control.

export const orderStatusLabels: Record<OrderStatus, string> = {
  scheduled: "Scheduled",
  pending: "New",
  accepted: "Accepted",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
}

export const orderEventLabels: Record<OrderEventType, string> = {
  ...orderStatusLabels,
  pending: "Placed",
  accepted: "Accepted · preparation started",
  prep_time_adjusted: "Prep time adjusted",
}

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  paid: "Paid",
  failed: "Payment failed",
  refund_pending: "Refund pending",
  refunded: "Refunded",
}

type LifecycleOrder = Pick<OrderSummary, "status" | "orderType" | "deliveryMode">

export function orderTypeLabel(order: Pick<OrderSummary, "orderType" | "deliveryMode">) {
  if (order.orderType !== "delivery" || !order.deliveryMode) return orderTypeLabels[order.orderType]
  // "Foodi delivery" already says it's a delivery; the own-rider label doesn't.
  return order.deliveryMode === "foodi"
    ? deliveryModeLabels.foodi
    : `${orderTypeLabels.delivery} · ${deliveryModeLabels.restaurant.toLowerCase()}`
}

const ownRiderDelivery = (order: LifecycleOrder) =>
  order.orderType === "delivery" && order.deliveryMode === "restaurant"
const foodiDelivery = (order: LifecycleOrder) =>
  order.orderType === "delivery" && order.deliveryMode === "foodi"

export type OrderActionId =
  | "accept"
  | "reject"
  | "adjust_prep_time"
  | "mark_ready"
  | "dispatch"
  | "complete"
  | "cancel"

export const orderActionLabels: Record<OrderActionId, string> = {
  accept: "Accept",
  reject: "Reject",
  adjust_prep_time: "Adjust prep time",
  mark_ready: "Mark ready",
  dispatch: "Dispatch",
  complete: "Complete",
  cancel: "Cancel order",
}

/** Restaurant actions for an order, primary action first (PRD §4.2, §4.3). */
export function availableActions(order: LifecycleOrder): OrderActionId[] {
  switch (order.status) {
    case "pending":
      return ["accept", "reject"]
    case "accepted":
      return ["mark_ready", "adjust_prep_time", "cancel"]
    case "ready":
      // A Foodi rider collects the order; Foodi moves it on from here.
      if (foodiDelivery(order)) return ["cancel"]
      if (ownRiderDelivery(order)) return ["dispatch", "cancel"]
      return ["complete", "cancel"]
    case "out_for_delivery":
      return ownRiderDelivery(order) ? ["complete", "cancel"] : []
    // Scheduled orders move to New automatically at slot time minus prep lead.
    case "scheduled":
    default:
      return []
  }
}

export type CancellationCheck =
  | { allowed: true; needsRiderConfirmation: boolean }
  | { allowed: false; reason: "use_reject" | "foodi_rider" | "not_started" | "closed" }

/** PRD §4.3: restaurant cancellation after acceptance. */
export function cancellationCheck(order: LifecycleOrder): CancellationCheck {
  switch (order.status) {
    case "accepted":
    case "ready":
      return { allowed: true, needsRiderConfirmation: false }
    case "out_for_delivery":
      return foodiDelivery(order)
        ? { allowed: false, reason: "foodi_rider" }
        : { allowed: true, needsRiderConfirmation: true }
    case "pending":
      return { allowed: false, reason: "use_reject" }
    case "scheduled":
      return { allowed: false, reason: "not_started" }
    default:
      return { allowed: false, reason: "closed" }
  }
}

export const cancellationBlockedMessages: Record<
  Extract<CancellationCheck, { allowed: false }>["reason"],
  string
> = {
  use_reject: "New orders are rejected, not cancelled.",
  foodi_rider: "A Foodi rider has this order. Contact Foodi support to cancel it.",
  not_started: "Scheduled orders can be handled once they move to New.",
  closed: "This order is closed. Use a refund or dispute instead.",
}

/** What happens next when it isn't up to the restaurant. */
export function orderHint(order: LifecycleOrder): string | null {
  if (order.status === "scheduled") {
    return "This order moves to New automatically before its slot."
  }
  if (order.status === "ready" && foodiDelivery(order)) {
    return "Waiting for the Foodi rider to collect it."
  }
  if (order.status === "out_for_delivery" && foodiDelivery(order)) {
    return "A Foodi rider is delivering this order. Foodi completes it on delivery. Contact Foodi support to cancel it."
  }
  return null
}

type ApplyContext = {
  now: Date
  /** Riders the restaurant can dispatch to (own-rider delivery). */
  riders?: readonly Rider[]
}

const minutesAfter = (iso: string, minutes: number) =>
  new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()

function refundAfterClosure(order: OrderDetail): PaymentStatus {
  // A paid online order gets a refund, shown as pending until the payment
  // provider confirms it (P2). Cash orders have nothing to refund.
  return order.paymentMethod === "online" && order.paymentStatus === "paid"
    ? "refund_pending"
    : order.paymentStatus
}

function event(
  type: OrderEventType,
  at: string,
  extra: Partial<Omit<OrderTimelineEvent, "type" | "at">> = {}
): OrderTimelineEvent {
  return { type, at, actor: "restaurant", reason: null, note: null, detail: null, ...extra }
}

function assertAllowed(order: OrderDetail, action: OrderActionId) {
  if (!availableActions(order).includes(action)) {
    throw new ServiceError(
      "conflict",
      `${orderActionLabels[action]} isn't possible for an order that is ${orderStatusLabels[order.status].toLowerCase()}.`
    )
  }
}

/**
 * Applies one restaurant command and returns the updated order. Throws
 * ServiceError("conflict") when the command doesn't apply to the order's
 * current state, so a stale screen can't push an order backwards.
 */
export function applyOrderCommand(
  order: OrderDetail,
  command: OrderCommand,
  context: ApplyContext
): OrderDetail {
  const at = context.now.toISOString()

  switch (command.type) {
    case "accept": {
      assertAllowed(order, "accept")
      return {
        ...order,
        status: "accepted",
        // Q10 Option A: preparation starts at the server's acceptance time.
        preparationStartedAt: at,
        prepTimeMinutes: command.prepTimeMinutes,
        readyBy: minutesAfter(at, command.prepTimeMinutes),
        timeline: [
          ...order.timeline,
          event("accepted", at, { detail: `Prep time ${command.prepTimeMinutes} min` }),
        ],
      }
    }

    case "reject": {
      assertAllowed(order, "reject")
      const reason = reasonLabel(REJECT_REASONS, command.reason)
      const note = command.note || null
      return {
        ...order,
        status: "rejected",
        paymentStatus: refundAfterClosure(order),
        closure: { actor: "restaurant", reason, note, at },
        timeline: [...order.timeline, event("rejected", at, { reason, note })],
      }
    }

    case "cancel": {
      const check = cancellationCheck(order)
      if (!check.allowed) throw new ServiceError("conflict", cancellationBlockedMessages[check.reason])
      if (check.needsRiderConfirmation && !command.riderRecallConfirmed) {
        throw new ServiceError("validation", "Confirm that the rider will be told to stop.", {
          riderRecallConfirmed: "Confirm that the rider will be told to stop.",
        })
      }
      const reason = reasonLabel(CANCEL_REASONS, command.reason)
      const note = command.note || null
      return {
        ...order,
        status: "cancelled",
        paymentStatus: refundAfterClosure(order),
        closure: { actor: "restaurant", reason, note, at },
        timeline: [
          ...order.timeline,
          // D3/Q10: preparation has started, so reserved stock isn't returned.
          event("cancelled", at, { reason, note, detail: "Stock not returned" }),
        ],
      }
    }

    case "adjust_prep_time": {
      assertAllowed(order, "adjust_prep_time")
      const prepTimeMinutes = (order.prepTimeMinutes ?? 0) + command.addMinutes
      return {
        ...order,
        prepTimeMinutes,
        readyBy: order.preparationStartedAt
          ? minutesAfter(order.preparationStartedAt, prepTimeMinutes)
          : order.readyBy,
        timeline: [
          ...order.timeline,
          event("prep_time_adjusted", at, {
            detail: `+${command.addMinutes} min (now ${prepTimeMinutes} min)`,
          }),
        ],
      }
    }

    case "mark_ready": {
      assertAllowed(order, "mark_ready")
      return { ...order, status: "ready", timeline: [...order.timeline, event("ready", at)] }
    }

    case "dispatch": {
      assertAllowed(order, "dispatch")
      const rider = context.riders?.find((candidate) => candidate.id === command.riderId)
      if (!rider) {
        throw new ServiceError("validation", "Choose one of your riders.", {
          riderId: "Choose one of your riders.",
        })
      }
      return {
        ...order,
        status: "out_for_delivery",
        rider,
        timeline: [...order.timeline, event("out_for_delivery", at, { detail: `Rider: ${rider.name}` })],
      }
    }

    case "complete": {
      assertAllowed(order, "complete")
      return {
        ...order,
        status: "completed",
        // Cash is collected on completion.
        paymentStatus:
          order.paymentMethod === "cash" && order.paymentStatus === "unpaid"
            ? "paid"
            : order.paymentStatus,
        timeline: [...order.timeline, event("completed", at)],
      }
    }
  }
}
