import Link from "next/link"
import { ArrowRight, Inbox } from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"
import { OrderStatusBadge, OrderTypeLabel } from "@/components/orders/status-badges"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ServiceError } from "@/lib/data-source/errors"
import { formatMoney } from "@/lib/orders/format"
import { getOrdersContext, listOrders, ordersMode } from "@/lib/orders/service"
import { ORDER_STATUSES, type OrderStatus, type OrderSummary } from "@/lib/orders/types"
import { formatInstant } from "@/lib/time/format"

import { DashboardSection } from "./dashboard-section"
import { PreviewDataBadge, SectionFailure } from "./dashboard-states"

export const RECENT_ORDERS_COUNT = 5

const isStatus = (value: string): value is OrderStatus => (ORDER_STATUSES as readonly string[]).includes(value)

const orderHref = (order: Pick<OrderSummary, "id">) => `/orders/${encodeURIComponent(order.id)}`
const itemsText = (count: number) => `${count} ${count === 1 ? "item" : "items"}`

/**
 * The five most recently placed orders, any status (B5a, B5-D4), from the
 * same list the order history uses (newest placement first). An order with
 * an unknown status fails the section rather than being shown wrongly. Every
 * column is a field of the order summary the list already returns.
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
  const badge = ordersMode() === "preview" ? <PreviewDataBadge source="sample orders" /> : undefined
  if (!orders.length) {
    return (
      <RecentFrame badge={badge}>
        <EmptyState icon={Inbox} title="No orders yet" description="New orders will appear here." className="py-10" />
      </RecentFrame>
    )
  }
  return (
    <RecentFrame badge={badge} flush action={<SeeAll />}>
      {/* A table from lg up, cards below, both from the same orders. */}
      <div className="hidden lg:block">
        <Table aria-label="Most recent orders">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Placed</TableHead>
              <TableHead className="pr-6">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="pl-6">
                  <Link
                    href={orderHref(order)}
                    className="rounded-sm font-semibold text-primary-text underline-offset-4 outline-none hover:underline"
                  >
                    {order.reference}
                  </Link>
                  <div className="mt-0.5">
                    <OrderTypeLabel order={order} />
                  </div>
                </TableCell>
                <TableCell>{order.customerName ?? <span className="text-muted-foreground">Not shared</span>}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="block font-semibold">{formatMoney(order.total, context.locale)}</span>
                  <span className="block text-xs text-muted-foreground">{itemsText(order.itemCount)}</span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <time dateTime={order.placedAt}>{formatInstant(order.placedAt, context, "dateTime")}</time>
                </TableCell>
                <TableCell className="pr-6">
                  <OrderStatusBadge status={order.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-3 px-6 lg:hidden" aria-label="Most recent orders">
        {orders.map((order) => (
          <li key={order.id} className="rounded-2xl border border-border-soft bg-background/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 flex-col gap-0.5">
                <Link
                  href={orderHref(order)}
                  className="w-fit rounded-sm font-semibold text-primary-text underline-offset-4 outline-none hover:underline"
                >
                  {order.reference}
                </Link>
                <OrderTypeLabel order={order} />
              </span>
              <OrderStatusBadge status={order.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border-soft pt-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Customer</dt>
                <dd className="font-medium break-words">{order.customerName ?? "Not shared"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Amount</dt>
                <dd className="font-semibold tabular-nums">
                  {formatMoney(order.total, context.locale)} · {itemsText(order.itemCount)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="sr-only">Placed</dt>
                <dd className="text-xs text-muted-foreground">
                  Placed <time dateTime={order.placedAt}>{formatInstant(order.placedAt, context, "dateTime")}</time>
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </RecentFrame>
  )
}

function SeeAll() {
  return (
    <Link
      href="/orders/history"
      className="inline-flex items-center gap-2 rounded-full border border-primary-line bg-primary-faint py-1 pr-1 pl-4 text-sm font-semibold text-primary-text outline-none transition-colors hover:bg-primary-soft"
    >
      See all orders
      <span aria-hidden className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
        <ArrowRight className="size-3.5" />
      </span>
    </Link>
  )
}

function RecentFrame({
  badge,
  action,
  flush,
  children,
}: {
  badge?: React.ReactNode
  action?: React.ReactNode
  flush?: boolean
  children: React.ReactNode
}) {
  return (
    <DashboardSection
      id="recent-orders"
      title="Recent orders"
      description="The latest orders placed with your restaurant."
      badge={badge}
      action={action}
      flush={flush}
    >
      {children}
    </DashboardSection>
  )
}
