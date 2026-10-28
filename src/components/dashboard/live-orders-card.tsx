import Link from "next/link"

import { countLiveOrders, LIVE_STATUSES } from "@/lib/dashboard/live-orders"
import { getOrderBoard, ordersMode } from "@/lib/orders/service"

import { DashboardSection } from "./dashboard-section"
import { PreviewDataBadge, SectionFailure } from "./dashboard-states"

/**
 * Orders active right now, by status, from the same data as the Orders board
 * (B5a). Not a count of today's orders: see TodayOrdersCard for that.
 */
export async function LiveOrdersCard({ previewScenario, retryHref }: { previewScenario?: unknown; retryHref: string }) {
  let counts
  try {
    counts = countLiveOrders(await getOrderBoard(previewScenario))
  } catch (error) {
    return (
      <LiveOrdersFrame>
        <SectionFailure error={error} what="live orders" retryHref={retryHref} />
      </LiveOrdersFrame>
    )
  }
  return (
    <LiveOrdersFrame badge={ordersMode() === "preview" ? <PreviewDataBadge source="sample orders" /> : undefined}>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label="Active orders by status">
        {LIVE_STATUSES.map(({ status, label, anchor }) => (
          <li key={status}>
            <Link
              href={`/orders#${anchor}`}
              className="flex h-full flex-col gap-1 rounded-lg border px-3 py-2.5 outline-none hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
              {/* The name comes from the visible text, kept apart for screen readers: "New 3 orders, open the board". */}
              <span className="sr-only"> </span>
              <span className="text-2xl font-semibold tabular-nums">{counts[status]}</span>
              <span className="sr-only"> {counts[status] === 1 ? "order" : "orders"}, open the board</span>
            </Link>
          </li>
        ))}
      </ul>
    </LiveOrdersFrame>
  )
}

function LiveOrdersFrame({ badge, children }: { badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <DashboardSection
      id="live-orders"
      title="Live orders"
      description="Orders in progress right now, as on the Orders board."
      badge={badge}
      className="lg:col-span-2"
    >
      {children}
    </DashboardSection>
  )
}
