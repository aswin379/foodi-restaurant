import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Ban, ChefHat, Printer } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { LiveTiming } from "@/components/orders/live-timing"
import { OrderActions } from "@/components/orders/order-actions"
import { OrderItems } from "@/components/orders/order-items"
import { OrderTimeline } from "@/components/orders/order-timeline"
import { OrdersLoadFailure } from "@/components/orders/orders-states"
import { OrderStatusBadge, OrderTypeLabel, PaymentStatusText } from "@/components/orders/status-badges"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { DEFAULT_PREP_TIME_MINUTES } from "@/lib/orders/commands"
import { formatDateTime, formatTime, type ZoneAndLocale } from "@/lib/orders/format"
import { getOrder, getOrdersContext, listRiders, ordersMode } from "@/lib/orders/service"
import type { OrderActor, OrderDetail, Rider } from "@/lib/orders/types"

export const metadata: Metadata = {
  title: "Order details",
}

const closedBy: Record<OrderActor, string> = {
  customer: "the customer",
  restaurant: "your restaurant",
  foodi: "Foodi support",
  system: "Foodi automatically",
}

const surface = "shadow-[0_8px_30px_rgb(31_26_23/6%)]"

export default function OrderDetailPage({ params, searchParams }: PageProps<"/orders/[orderId]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/orders"
        className="group inline-flex w-fit items-center gap-2 rounded-full text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span aria-hidden className={`grid size-8 place-items-center rounded-full bg-card ${surface}`}>
          <ArrowLeft className="size-4" />
        </span>
        Orders board
      </Link>
      <Suspense fallback={<OrderDetailSkeleton />}>
        <OrderDetailView params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function OrderDetailView({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { orderId } = await params
  const { preview } = await searchParams

  let loaded
  try {
    const [context, order] = await Promise.all([
      getOrdersContext(),
      getOrder(decodeURIComponent(orderId), preview),
    ])
    loaded = { context, order }
  } catch (error) {
    return <OrdersLoadFailure error={error} retryHref={`/orders/${orderId}`} />
  }
  const order = loaded.order
  if (!order) notFound()
  const context: ZoneAndLocale = { timeZone: loaded.context.timeZone, locale: loaded.context.locale }

  let riders: Rider[] = []
  try {
    riders = await listRiders()
  } catch {
    riders = []
  }

  return (
    <div className="flex flex-col gap-6">
      {ordersMode() === "preview" ? <PreviewNotice detail="Sample orders use PRV- references." /> : null}

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] leading-9 font-bold tracking-[-0.02em] sm:text-[2rem] sm:leading-10 lg:text-[2.5rem] lg:leading-[3rem]">
            Order {order.reference}
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Placed <time dateTime={order.placedAt}>{formatDateTime(order.placedAt, context)}</time>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <OrderStatusBadge status={order.status} />
          <OrderTypeLabel order={order} />
        </div>
      </header>

      {order.closure ? (
        <div
          role="note"
          className="flex items-start gap-3 rounded-2xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger-foreground"
        >
          <Ban aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold">
              {order.status === "rejected" ? "Rejected" : "Cancelled"} by {closedBy[order.closure.actor]}:
            </span>{" "}
            {order.closure.reason}
            {order.closure.note ? ` (${order.closure.note})` : null}
          </p>
        </div>
      ) : null}

      <OrderProgress order={order} context={context} />

      {/*
        The actions come first in reading and tab order, so on a phone Accept or Mark ready
        is above the item list; on wide screens they sit in the right-hand column.
      */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-start-3 lg:row-start-1">
          <DetailCard title="Actions">
            <div className="flex flex-col gap-4">
              <OrderActions order={order} riders={riders} context={context} />
              <Link
                href={`/print/orders/${encodeURIComponent(order.id)}`}
                className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-semibold text-primary-text underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <Printer aria-hidden className="size-4" />
                Print kitchen ticket and bill
              </Link>
            </div>
          </DetailCard>

          <DetailCard title="Customer">
            <dl className="flex flex-col gap-3 text-sm">
              <InfoRow label="Customer" value={order.customerName ?? "Not shared"} />
              <InfoRow label="Order type" value={<OrderTypeLabel order={order} />} />
              {order.deliveryAddress ? <InfoRow label="Delivery address" value={order.deliveryAddress} /> : null}
              {order.tableLabel ? <InfoRow label="Table" value={order.tableLabel} /> : null}
              {order.rider ? <InfoRow label="Rider" value={order.rider.name} /> : null}
              {order.customerNote ? <InfoRow label="Customer note" value={order.customerNote} /> : null}
            </dl>
          </DetailCard>

          <DetailCard title="Payment">
            <dl className="flex flex-col gap-3 text-sm">
              <InfoRow label="Status" value={<PaymentStatusText status={order.paymentStatus} />} />
              <InfoRow
                label="Method"
                value={
                  order.paymentMethod === "cash"
                    ? "Cash"
                    : order.paymentMethod === "online"
                      ? "Paid online"
                      : "Not available"
                }
              />
            </dl>
            {order.paymentStatus === "refund_pending" ? (
              <p className="mt-3 text-xs text-muted-foreground">
                The refund shows as refunded only after the payment provider confirms it.
              </p>
            ) : null}
          </DetailCard>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-2 lg:row-start-1">
          <DetailCard title="Items">
            <OrderItems items={order.items} charges={order.charges} context={context} />
          </DetailCard>
          <DetailCard title="Order timeline">
            <OrderTimeline events={order.timeline} context={context} />
          </DetailCard>
        </div>
      </div>
    </div>
  )
}

/** Preparation or scheduling facts, with a live timer. */
function OrderProgress({ order, context }: { order: OrderDetail; context: ZoneAndLocale }) {
  if (order.status === "scheduled" && order.scheduledFor) {
    const movesAt = new Date(Date.parse(order.scheduledFor) - DEFAULT_PREP_TIME_MINUTES * 60_000).toISOString()
    return (
      <ProgressPanel timing={<LiveTiming order={order} />}>
        Scheduled for <time dateTime={order.scheduledFor}>{formatDateTime(order.scheduledFor, context)}</time>.
        It moves to New at about <time dateTime={movesAt}>{formatTime(movesAt, context)}</time>.
      </ProgressPanel>
    )
  }
  if (order.status === "accepted" && order.preparationStartedAt && order.readyBy) {
    return (
      <ProgressPanel timing={<LiveTiming order={order} />}>
        Preparation started{" "}
        <time dateTime={order.preparationStartedAt}>{formatTime(order.preparationStartedAt, context)}</time> ·
        prep time {order.prepTimeMinutes} min · ready by{" "}
        <time dateTime={order.readyBy}>{formatTime(order.readyBy, context)}</time>
      </ProgressPanel>
    )
  }
  if (order.status === "pending") {
    return (
      <ProgressPanel timing={<LiveTiming order={order} />}>
        Waiting for you to accept or reject. Preparation starts when you accept.
      </ProgressPanel>
    )
  }
  return null
}

function ProgressPanel({ children, timing }: { children: React.ReactNode; timing: React.ReactNode }) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl bg-card px-4 py-3.5 text-sm sm:flex-row sm:items-center sm:justify-between ${surface}`}
    >
      <p className="flex items-center gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">
          <ChefHat className="size-[18px]" strokeWidth={1.75} />
        </span>
        <span>{children}</span>
      </p>
      {timing}
    </div>
  )
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className={`gap-4 rounded-3xl border-transparent py-6 ${surface}`}>
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg font-semibold">{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  )
}

function OrderDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading order" className="flex flex-col gap-6">
      <Skeleton className="h-10 w-64 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-3xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    </div>
  )
}
