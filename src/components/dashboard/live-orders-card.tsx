import Link from "next/link"
import { Bike, BellRing, CalendarClock, ChefHat, PackageCheck, type LucideIcon } from "lucide-react"

import { CountUp } from "@/components/motion/count-up"
import { countLiveOrders, LIVE_STATUSES, type ActiveOrderStatus } from "@/lib/dashboard/live-orders"
import { getOrderBoard, ordersMode } from "@/lib/orders/service"

import { DashboardSection } from "./dashboard-section"
import { PreviewDataBadge, SectionFailure } from "./dashboard-states"

const LIVE_ICONS: Record<ActiveOrderStatus, LucideIcon> = {
  pending: BellRing,
  accepted: ChefHat,
  ready: PackageCheck,
  out_for_delivery: Bike,
  scheduled: CalendarClock,
}

/**
 * Orders active right now, by status, from the same data as the Orders board
 * (B5a), shown as the dashboard's key figures. Not a count of today's orders:
 * see TodayOrdersCard for that. Each tile still links to its board column.
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
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5" aria-label="Active orders by status">
        {LIVE_STATUSES.map(({ status, label, anchor }) => {
          const Icon = LIVE_ICONS[status]
          return (
            <li key={status} className="last:col-span-2 sm:last:col-span-1">
              <Link
                href={`/orders#${anchor}`}
                className="surface-card lift group flex h-full items-center gap-3 rounded-3xl bg-card p-4 outline-none sm:gap-4 sm:p-5"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-peach-soft to-primary-soft text-primary ring-1 ring-primary-line transition-transform duration-200 group-hover:scale-110 sm:size-12">
                  <Icon aria-hidden strokeWidth={1.75} className="size-[22px] sm:size-6" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
                  {/* The name comes from the visible text, kept apart for screen readers: "New 3 orders, open the board". */}
                  <span className="sr-only"> </span>
                  <span className="text-[1.75rem] leading-9 font-bold tracking-tight tabular-nums sm:text-[2rem] sm:leading-10">
                    <CountUp value={counts[status]} />
                  </span>
                  <span className="sr-only"> {counts[status] === 1 ? "order" : "orders"}, open the board</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </LiveOrdersFrame>
  )
}

function LiveOrdersFrame({ badge, children }: { badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <DashboardSection
      id="live-orders"
      variant="plain"
      title="Live orders"
      description="Orders in progress right now, as on the Orders board."
      badge={badge}
    >
      {children}
    </DashboardSection>
  )
}
