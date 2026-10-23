import type { OrderSummary } from "./types"

// Board timing (PRD §4.2: timers and colours for delayed orders). Pure
// functions of an explicit "now", so the UI can tick without refetching.

/** A new order waiting this long without a response is flagged. */
export const NEW_ORDER_ATTENTION_MINUTES = 5

const MINUTE = 60_000

export type OrderTiming =
  | { kind: "waiting"; minutes: number; needsAttention: boolean }
  | { kind: "preparing"; minutesLeft: number }
  | { kind: "late"; minutesLate: number }
  | { kind: "starts_in"; minutes: number }
  | { kind: "none" }

type TimedOrder = Pick<OrderSummary, "status" | "placedAt" | "readyBy" | "scheduledFor">

export function orderTiming(order: TimedOrder, nowMs: number): OrderTiming {
  switch (order.status) {
    case "pending": {
      const minutes = Math.max(0, Math.floor((nowMs - Date.parse(order.placedAt)) / MINUTE))
      return { kind: "waiting", minutes, needsAttention: minutes >= NEW_ORDER_ATTENTION_MINUTES }
    }
    case "accepted": {
      if (!order.readyBy) return { kind: "none" }
      const diff = Date.parse(order.readyBy) - nowMs
      return diff >= 0
        ? { kind: "preparing", minutesLeft: Math.ceil(diff / MINUTE) }
        : { kind: "late", minutesLate: Math.ceil(-diff / MINUTE) }
    }
    case "scheduled": {
      if (!order.scheduledFor) return { kind: "none" }
      return {
        kind: "starts_in",
        minutes: Math.max(0, Math.ceil((Date.parse(order.scheduledFor) - nowMs) / MINUTE)),
      }
    }
    default:
      return { kind: "none" }
  }
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

export function describeTiming(timing: OrderTiming): string | null {
  switch (timing.kind) {
    case "waiting":
      return timing.minutes === 0 ? "Just now" : `Waiting ${formatDuration(timing.minutes)}`
    case "preparing":
      return `${formatDuration(timing.minutesLeft)} left`
    case "late":
      return `Late by ${formatDuration(timing.minutesLate)}`
    case "starts_in":
      return `Slot in ${formatDuration(timing.minutes)}`
    case "none":
      return null
  }
}
