"use client"

import { AlarmClock, CalendarClock, Clock, Hourglass } from "lucide-react"

import { describeTiming, orderTiming } from "@/lib/orders/timing"
import type { OrderSummary } from "@/lib/orders/types"
import { cn } from "@/lib/utils"

const tone = {
  calm: "border-sky-200 bg-sky-50 text-sky-900",
  attention: "border-amber-300 bg-amber-50 text-amber-900",
  late: "border-red-300 bg-red-50 text-red-800",
  scheduled: "border-indigo-200 bg-indigo-50 text-indigo-900",
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
        "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-semibold whitespace-nowrap tabular-nums",
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
