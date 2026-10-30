"use client"

import { AlarmClock, CalendarClock, Clock, Hourglass } from "lucide-react"

import { describeTiming, orderTiming } from "@/lib/orders/timing"
import type { OrderSummary } from "@/lib/orders/types"
import { cn } from "@/lib/utils"

// The design system's status tones, matching the order status badges.
const tone = {
  calm: "border-info-line bg-info-soft text-info-foreground",
  attention: "border-warning-line bg-warning-soft text-warning-foreground",
  late: "border-danger-line bg-danger-soft text-danger-foreground",
  scheduled: "border-violet-line bg-violet-soft text-violet-foreground",
}

/** Live timer chip: waiting time, time left, lateness or time to slot. */
export function OrderTimingChip({
  order,
  now,
}: {
  order: Pick<OrderSummary, "status" | "placedAt" | "readyBy" | "scheduledFor">
  now: number | null
}) {
  // Rendered only on the client, once the clock is known.
  if (now === null) return <span className="h-6" aria-hidden />
  const timing = orderTiming(order, now)
  const text = describeTiming(timing)
  if (!text) return null

  const [Icon, style] =
    timing.kind === "late"
      ? [AlarmClock, tone.late]
      : timing.kind === "waiting"
        ? [Hourglass, timing.needsAttention ? tone.attention : tone.calm]
        : timing.kind === "starts_in"
          ? [CalendarClock, tone.scheduled]
          : [Clock, tone.calm]

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap tabular-nums",
        style
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {text}
    </span>
  )
}

export function isUrgent(
  order: Pick<OrderSummary, "status" | "placedAt" | "readyBy" | "scheduledFor">,
  now: number | null
) {
  if (now === null) return false
  const timing = orderTiming(order, now)
  return timing.kind === "late" || (timing.kind === "waiting" && timing.needsAttention)
}
