import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { DeliveryBoard } from "@/components/delivery/delivery-board"
import { DeliveryNav } from "@/components/delivery/delivery-nav"
import { OrderStatusBadge } from "@/components/orders/status-badges"
import { OrdersBoardSkeleton, OrdersEmpty, OrdersListSkeleton, OrdersLoadFailure } from "@/components/orders/orders-states"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { orderStatusLabels } from "@/lib/orders/lifecycle"
import { formatDateTime, formatMoney } from "@/lib/orders/format"
import { parseOrderListQuery, type RawSearchParams } from "@/lib/orders/query"
import { getOrderBoard, getOrdersContext, listOrders, listRiders, ordersMode } from "@/lib/orders/service"
import type { Rider } from "@/lib/orders/types"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Delivery",
}

const HISTORY_STATUSES = ["all", "completed", "cancelled", "rejected"] as const
const SURFACE = "shadow-[0_8px_30px_rgb(31_26_23/6%)]"

export default function DeliveryPage({ searchParams }: PageProps<"/delivery">) {
  return (
    <Suspense fallback={<OrdersBoardSkeleton />}>
      <DeliveryView searchParams={searchParams} />
    </Suspense>
  )
}

async function DeliveryView({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = await searchParams
  const history = params.view === "history"
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="hero"
        title="Delivery"
        description={
          history
            ? "Past delivery orders: delivered, cancelled and rejected."
            : "Orders going out for delivery, from preparation to the door."
        }
        actions={<DeliveryNav current={history ? "history" : "active"} />}
      />
      {ordersMode() === "preview" ? <PreviewNotice detail="Sample orders use PRV- references." /> : null}
      <Suspense fallback={history ? <OrdersListSkeleton /> : <OrdersBoardSkeleton />} key={history ? "history" : "active"}>
        {history ? <HistoryResults params={params} /> : <ActiveResults preview={params.preview} />}
      </Suspense>
    </div>
  )
}

async function ActiveResults({ preview }: { preview: unknown }) {
  let loaded
  try {
    const [context, orders] = await Promise.all([getOrdersContext(), getOrderBoard(preview)])
    loaded = { context, orders }
  } catch (error) {
    return <OrdersLoadFailure error={error} retryHref="/delivery" />
  }
  let riders: Rider[] = []
  try {
    riders = await listRiders()
  } catch {
    riders = []
  }
  return (
    <DeliveryBoard
      orders={loaded.orders}
      riders={riders}
      context={{ timeZone: loaded.context.timeZone, locale: loaded.context.locale }}
    />
  )
}

async function HistoryResults({ params }: { params: RawSearchParams }) {
  const base = parseOrderListQuery(params)
  const status = (HISTORY_STATUSES as readonly string[]).includes(base.status) ? base.status : "all"
  // History is the closed delivery orders: with "all" this asks for each closed status and merges them.
  const closed = status === "all" ? (["completed", "cancelled", "rejected"] as const) : ([status] as const)
  let loaded
  try {
    const [context, results] = await Promise.all([
      getOrdersContext(),
      Promise.all(closed.map((closedStatus) => listOrders({ ...base, status: closedStatus, page: 1, pageSize: 50 }, params.preview))),
    ])
    loaded = { context, items: results.flatMap((result) => result.items) }
  } catch (error) {
    return <OrdersLoadFailure error={error} retryHref="/delivery?view=history" />
  }
  const { context } = loaded
  const items = loaded.items
    .filter((order) => order.orderType === "delivery")
    .sort((a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt))
  const zone = { timeZone: context.timeZone, locale: context.locale }

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Filter deliveries by outcome">
        <ul className="flex w-fit max-w-full flex-wrap gap-1 rounded-3xl bg-card p-1 shadow-[0_4px_14px_rgb(31_26_23/8%)]">
          {HISTORY_STATUSES.map((value) => (
            <li key={value}>
              <Link
                href={`/delivery?view=history${value === "all" ? "" : `&status=${value}`}`}
                aria-current={status === value ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  status === value
                    ? "bg-primary text-primary-foreground shadow-[0_6px_14px_rgb(214_63_8/25%)]"
                    : "text-muted-foreground hover:bg-primary-faint hover:text-foreground"
                )}
              >
                {value === "all" ? "All" : value === "completed" ? "Delivered" : orderStatusLabels[value]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <form
        action="/delivery"
        method="get"
        role="search"
        aria-label="Search and filter deliveries"
        className={cn("grid gap-4 rounded-3xl bg-card p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))_auto] lg:items-end", SURFACE)}
      >
        <input type="hidden" name="view" value="history" />
        {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="delivery-search">Order reference</Label>
          <Input id="delivery-search" name="q" type="search" defaultValue={base.search} placeholder="Search by order reference" autoComplete="off" maxLength={60} className="h-10 bg-background" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delivery-from">From</Label>
          <Input id="delivery-from" name="from" type="date" defaultValue={base.from ?? ""} className="h-10 bg-background" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delivery-to">To</Label>
          <Input id="delivery-to" name="to" type="date" defaultValue={base.to ?? ""} className="h-10 bg-background" />
        </div>
        <Button type="submit" className="h-10 sm:col-span-2 lg:col-span-1">
          Apply
        </Button>
      </form>

      {items.length === 0 ? (
        <OrdersEmpty />
      ) : (
        <>
          <div className={cn("hidden overflow-hidden rounded-3xl bg-card lg:block", SURFACE)}>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Order</TableHead>
                  <TableHead>Placed</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead className="pr-6 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((order) => (
                  <TableRow key={order.id} className="h-[4.25rem]">
                    <TableCell className="pl-6 font-bold text-primary-text">{order.reference}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <time dateTime={order.placedAt}>{formatDateTime(order.placedAt, zone)}</time>
                    </TableCell>
                    <TableCell>{order.customerName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{order.deliveryMode === "restaurant" ? "Own rider" : "Foodi rider"}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatMoney(order.total, zone.locale)}</TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Link
                        href={`/orders/${encodeURIComponent(order.id)}`}
                        className="inline-grid size-8 place-items-center rounded-full bg-primary-soft text-primary-text outline-none transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        <ArrowRight aria-hidden className="size-4" />
                        <span className="sr-only">View order {order.reference}</span>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
            {items.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${encodeURIComponent(order.id)}`}
                  className={cn("block h-full rounded-2xl bg-card p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", SURFACE)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-primary-text">{order.reference}</p>
                      <p className="text-xs text-muted-foreground">
                        <time dateTime={order.placedAt}>{formatDateTime(order.placedAt, zone)}</time>
                        {order.customerName ? ` · ${order.customerName}` : null}
                      </p>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border-soft pt-3 text-sm">
                    <span className="text-muted-foreground">{order.deliveryMode === "restaurant" ? "Own rider" : "Foodi rider"}</span>
                    <span className="font-bold tabular-nums">{formatMoney(order.total, zone.locale)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Shows up to the latest 50 closed orders for each outcome. Open an order for the full details.</p>
        </>
      )}
    </div>
  )
}
