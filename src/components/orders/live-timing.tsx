"use client"

import type { OrderSummary } from "@/lib/orders/types"

import { OrderTimingChip } from "./order-timing"
import { useNow } from "./use-now"

/** A self-updating timing chip for server-rendered pages. */
export function LiveTiming({
  order,
}: {
  order: Pick<OrderSummary, "status" | "placedAt" | "readyBy" | "scheduledFor">
}) {
  const now = useNow(30_000, `${order.status}:${order.readyBy}`)
  return <OrderTimingChip order={order} now={now} />
}
