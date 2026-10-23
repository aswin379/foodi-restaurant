import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Ban } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { OrderActions } from "@/components/orders/order-actions"
import { OrderItems } from "@/components/orders/order-items"
import { OrderTimeline } from "@/components/orders/order-timeline"
import { OrdersError, OrdersNotConnected } from "@/components/orders/orders-states"
import { PreviewDataNotice } from "@/components/orders/preview-data-notice"
import {
  FulfilmentLabel,
  OrderStatusBadge,
  PaymentStatusText,
} from "@/components/orders/status-badges"
import { OrdersServiceError } from "@/lib/orders/errors"
import { formatDateTime } from "@/lib/orders/format"
import { deliveryFulfilment } from "@/lib/orders/lifecycle"
import { getOrder, ordersDataSource } from "@/lib/orders/service"
import type { OrderDetail } from "@/lib/orders/types"

export const metadata: Metadata = {
  title: "Order details",
}

export default function OrderDetailPage({
  params,
  searchParams,
}: PageProps<"/orders/[orderId]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/orders"
        className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All orders
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

  let order: OrderDetail | null
  try {
    order = await getOrder(decodeURIComponent(orderId), preview)
  } catch (error) {
    if (error instanceof OrdersServiceError && error.kind === "not_configured") {
      return <OrdersNotConnected />
    }
    return <OrdersError retryHref={`/orders/${orderId}`} />
  }
  if (!order) notFound()

  const isDelivery = deliveryFulfilment.has(order.fulfilment)

  return (
    <div className="flex flex-col gap-6">
      {ordersDataSource() === "fixtures" ? <PreviewDataNotice /> : null}

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Order {order.reference}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Placed <time dateTime={order.placedAt}>{formatDateTime(order.placedAt)}</time>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <OrderStatusBadge status={order.status} />
          <FulfilmentLabel method={order.fulfilment} />
        </div>
      </header>

      {order.closureReason ? (
        <div
          role="note"
          className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <Ban aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold">
              {order.status === "rejected" ? "Rejected" : "Cancelled"}:
            </span>{" "}
            {order.closureReason}
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <DetailCard title="Items">
            <OrderItems items={order.items} charges={order.charges} />
          </DetailCard>
          <DetailCard title="Order timeline">
            <OrderTimeline events={order.timeline} />
          </DetailCard>
        </div>

        <div className="flex flex-col gap-6">
          <DetailCard title="Actions">
            <OrderActions status={order.status} fulfilment={order.fulfilment} />
          </DetailCard>

          <DetailCard title={isDelivery ? "Customer & delivery" : "Customer & pickup"}>
            <dl className="flex flex-col gap-3 text-sm">
              <InfoRow label="Customer" value={order.customerName ?? "Not shared"} />
              <InfoRow label="Fulfilment" value={<FulfilmentLabel method={order.fulfilment} />} />
              {order.deliveryAddress ? (
                <InfoRow label="Delivery address" value={order.deliveryAddress} />
              ) : null}
              {order.tableLabel ? <InfoRow label="Table" value={order.tableLabel} /> : null}
              {order.customerNote ? (
                <InfoRow label="Customer note" value={order.customerNote} />
              ) : null}
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
          </DetailCard>
        </div>
      </div>
    </div>
  )
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="gap-4 shadow-none">
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">{title}</h2>
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
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function OrderDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading order" className="flex flex-col gap-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  )
}
