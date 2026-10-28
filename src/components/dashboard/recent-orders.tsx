import Link from "next/link"
import { Inbox } from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"
import { OrderStatusBadge, OrderTypeLabel } from "@/components/orders/status-badges"
import { ServiceError } from "@/lib/data-source/errors"
import { getOrdersContext, listOrders, ordersMode } from "@/lib/orders/service"
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders/types"
import { formatInstant } from "@/lib/time/format"

import { DashboardSection } from "./dashboard-section"
import { PreviewDataBadge, SectionFailure } from "./dashboard-states"

export const RECENT_ORDERS_COUNT = 5

const isStatus = (value: string): value is OrderStatus => (ORDER_STATUSES as readonly string[]).includes(value)

/**
 * The five most recently placed orders, any status (B5a, B5-D4), from the
 * same list the order history uses (newest placement first). An order with
 * an unknown status fails the section rather than being shown wrongly.
 */
export async function RecentOrders({ previewScenario, retryHref }: { previewScenario?: unknown; retryHref: string }) {
  let loaded
  try {
    const [result, context] = await Promise.all([
      listOrders(
        { status: "all", search: "", from: null, to: null, page: 1, pageSize: RECENT_ORDERS_COUNT },
        previewScenario
      ),
      getOrdersContext(),
    ])
    for (const order of result.items) {
      if (!isStatus(order.status)) throw new ServiceError("unavailable", `Unknown order status: ${String(order.status)}`)
    }
    loaded = { orders: result.items.slice(0, RECENT_ORDERS_COUNT), context }
  } catch (error) {
    return (
      <RecentFrame>
        <SectionFailure error={error} what="recent orders" retryHref={retryHref} />
      </RecentFrame>
    )
  }
  const { orders, context } = loaded
  return (
    <RecentFrame badge={ordersMode() === "preview" ? <PreviewDataBadge source="sample orders" /> : undefined}>
      {orders.length ? (
        <ul className="flex flex-col divide-y" aria-label="Most recent orders">
          {orders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
              <span className="flex min-w-0 flex-col gap-0.5">
                <Link
                  href={`/orders/${encodeURIComponent(order.id)}`}
                  className="w-fit rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {order.reference}
                </Link>
                <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>Placed {formatInstant(order.placedAt, context, "dateTime")}</span>
                  <OrderTypeLabel order={order} />
                </span>
              </span>
              <OrderStatusBadge status={order.status} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Inbox} title="No orders yet" description="New orders will appear here." className="py-8" />
      )}
      <Link
        href="/orders/history"
        className="mt-3 inline-block w-fit rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        See all orders
      </Link>
    </RecentFrame>
  )
}

function RecentFrame({ badge, children }: { badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <DashboardSection
      id="recent-orders"
      title="Recent orders"
      description="The latest orders placed with your restaurant."
      badge={badge}
      className="lg:col-span-2"
    >
      {children}
    </DashboardSection>
  )
}
