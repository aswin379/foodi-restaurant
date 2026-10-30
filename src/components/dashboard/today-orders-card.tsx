import Link from "next/link"

import { orderStatusLabels } from "@/lib/orders/lifecycle"
import { ORDER_HISTORY_PATH } from "@/lib/orders/query"
import { getOrdersContext, getTodayOrdersSummary } from "@/lib/orders/service"
import { totalOrders } from "@/lib/orders/summary"
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders/types"
import { formatInstant } from "@/lib/time/format"
import { cn } from "@/lib/utils"

import { DashboardSection } from "./dashboard-section"
import { PreviewDataBadge, SectionFailure } from "./dashboard-states"

const historyHref = (date: string, status?: string) => {
  const params = new URLSearchParams({ from: date, to: date })
  if (status) params.set("status", status)
  return `${ORDER_HISTORY_PATH}?${params}`
}

// The same tone each status wears everywhere else (see the design system): one colour per meaning.
const STATUS_SWATCH: Record<OrderStatus, string> = {
  scheduled: "bg-violet",
  pending: "bg-warning",
  accepted: "bg-info",
  ready: "bg-success",
  out_for_delivery: "bg-cyan",
  completed: "bg-neutral",
  rejected: "bg-danger/50",
  cancelled: "bg-danger",
}

// Each status is a chip in its tone, with its count in a darker disc (white on the tone's dark text colour).
const STATUS_CHIP: Record<OrderStatus, { chip: string; count: string }> = {
  scheduled: { chip: "border-violet-line bg-violet-soft text-violet-foreground", count: "bg-violet-foreground" },
  pending: { chip: "border-warning-line bg-warning-soft text-warning-foreground", count: "bg-warning-foreground" },
  accepted: { chip: "border-info-line bg-info-soft text-info-foreground", count: "bg-info-foreground" },
  ready: { chip: "border-success-line bg-success-soft text-success-foreground", count: "bg-success-foreground" },
  out_for_delivery: { chip: "border-cyan-line bg-cyan-soft text-cyan-foreground", count: "bg-cyan-foreground" },
  completed: { chip: "border-neutral-line bg-neutral-soft text-neutral-foreground", count: "bg-neutral-foreground" },
  rejected: { chip: "border-danger-line bg-danger-soft text-danger-foreground", count: "bg-danger-foreground" },
  cancelled: { chip: "border-danger-line bg-danger-soft text-danger-foreground", count: "bg-danger-foreground" },
}

/**
 * Orders placed today, by status (B5a, B5-D2). "Today" is the restaurant-local
 * placement date; orders scheduled for today but placed earlier aren't
 * included. Counted by the server (an estimate in preview).
 *
 * The bar is a picture of the same counts listed below it: each segment grows
 * in proportion to its count (flex-grow), so no percentage is calculated here
 * and nothing is shown that the list doesn't also state.
 */
export async function TodayOrdersCard({ previewScenario, retryHref }: { previewScenario?: unknown; retryHref: string }) {
  let loaded
  try {
    const [summary, context] = await Promise.all([getTodayOrdersSummary(previewScenario), getOrdersContext()])
    loaded = { summary, context }
  } catch (error) {
    return (
      <TodayFrame>
        <SectionFailure error={error} what="today's orders" retryHref={retryHref} />
      </TodayFrame>
    )
  }
  const { summary, context } = loaded
  const total = totalOrders(summary.countsByStatus)
  const day = formatInstant(`${summary.date}T12:00:00Z`, { timeZone: "UTC", locale: context.locale }, "date")
  return (
    <TodayFrame badge={summary.source === "preview_estimate" ? <PreviewDataBadge source="sample orders" estimate /> : undefined}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <Link
            href={historyHref(summary.date)}
            className="w-fit rounded-md text-[2.5rem] leading-[3rem] font-bold tracking-tight tabular-nums outline-none hover:text-primary-text"
          >
            {total}
            <span className="sr-only"> {total === 1 ? "order" : "orders"} placed today, open the order history</span>
          </Link>
          <p className="text-sm text-muted-foreground">
            placed on {day} ({summary.timeZone})
          </p>
        </div>

        <div aria-hidden className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
          {ORDER_STATUSES.filter((status) => summary.countsByStatus[status] > 0).map((status) => (
            <span
              key={status}
              className={cn("h-full min-w-1", STATUS_SWATCH[status])}
              style={{ flexGrow: summary.countsByStatus[status], flexBasis: 0 }}
            />
          ))}
        </div>

        <ul className="flex flex-wrap gap-2" aria-label="Today's orders by status">
          {ORDER_STATUSES.map((status) => (
            <li key={status}>
              <Link
                href={historyHref(summary.date, status)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border py-1 pr-1 pl-3 text-sm font-semibold outline-none transition-opacity hover:opacity-80",
                  STATUS_CHIP[status].chip
                )}
              >
                {orderStatusLabels[status]}
                <span
                  className={cn(
                    "grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold text-card tabular-nums",
                    STATUS_CHIP[status].count
                  )}
                >
                  {summary.countsByStatus[status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Counted by placement time in the restaurant&apos;s time zone, as of{" "}
          {formatInstant(summary.asOf, context, "time")}. Cancelled includes orders the system cancelled for a failed
          payment.
        </p>
      </div>
    </TodayFrame>
  )
}

function TodayFrame({ badge, children }: { badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <DashboardSection id="today-orders" title="Today's orders" description="Orders placed today, by status." badge={badge}>
      {children}
    </DashboardSection>
  )
}
