import Link from "next/link"

import { orderStatusLabels } from "@/lib/orders/lifecycle"
import { ORDER_HISTORY_PATH } from "@/lib/orders/query"
import { getOrdersContext, getTodayOrdersSummary } from "@/lib/orders/service"
import { totalOrders } from "@/lib/orders/summary"
import { ORDER_STATUSES } from "@/lib/orders/types"
import { formatInstant } from "@/lib/time/format"

import { DashboardSection } from "./dashboard-section"
import { PreviewDataBadge, SectionFailure } from "./dashboard-states"

const historyHref = (date: string, status?: string) => {
  const params = new URLSearchParams({ from: date, to: date })
  if (status) params.set("status", status)
  return `${ORDER_HISTORY_PATH}?${params}`
}

/**
 * Orders placed today, by status (B5a, B5-D2). "Today" is the restaurant-local
 * placement date; orders scheduled for today but placed earlier aren't
 * included. Counted by the server (an estimate in preview).
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
      <div className="flex flex-col gap-3">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <Link
            href={historyHref(summary.date)}
            className="rounded-sm text-2xl font-semibold tabular-nums underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {total}
            <span className="sr-only"> {total === 1 ? "order" : "orders"} placed today, open the order history</span>
          </Link>
          <span className="text-sm text-muted-foreground">
            placed on {day} ({summary.timeZone})
          </span>
        </p>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm" aria-label="Today's orders by status">
          {ORDER_STATUSES.map((status) => (
            <li key={status} className="flex items-center justify-between gap-2">
              <Link
                href={historyHref(summary.date, status)}
                className="rounded-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {orderStatusLabels[status]}
              </Link>
              <span className="font-medium tabular-nums">{summary.countsByStatus[status]}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
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
