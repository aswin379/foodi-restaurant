import { Bike, CalendarClock, Store, Truck, UtensilsCrossed } from "lucide-react"

import { orderStatusLabels, orderTypeLabel, paymentStatusLabels } from "@/lib/orders/lifecycle"
import type { OrderStatus, OrderSummary, PaymentStatus } from "@/lib/orders/types"
import { cn } from "@/lib/utils"

const orderStatusTone: Record<OrderStatus, string> = {
  scheduled: "border-indigo-200 bg-indigo-50 text-indigo-800",
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  accepted: "border-sky-200 bg-sky-50 text-sky-800",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
  out_for_delivery: "border-teal-200 bg-teal-50 text-teal-800",
  completed: "border-stone-200 bg-stone-100 text-stone-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
}

const paymentStatusTone: Record<PaymentStatus, string> = {
  unpaid: "text-amber-800",
  paid: "text-emerald-800",
  failed: "text-red-700",
  refund_pending: "text-amber-800",
  refunded: "text-stone-600",
}

const pill =
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn(pill, orderStatusTone[status])}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {orderStatusLabels[status]}
    </span>
  )
}

export function PaymentStatusText({ status }: { status: PaymentStatus }) {
  return (
    <span className={cn("text-sm font-medium whitespace-nowrap", paymentStatusTone[status])}>
      {paymentStatusLabels[status]}
    </span>
  )
}

export function OrderTypeLabel({
  order,
  className,
}: {
  order: Pick<OrderSummary, "orderType" | "deliveryMode" | "scheduledFor">
  className?: string
}) {
  const Icon =
    order.orderType === "delivery"
      ? order.deliveryMode === "restaurant"
        ? Truck
        : Bike
      : order.orderType === "takeaway"
        ? Store
        : UtensilsCrossed
  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground",
        className
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {orderTypeLabel(order)}
      {order.scheduledFor ? (
        <>
          <CalendarClock aria-hidden className="ml-1 size-3.5" />
          <span>Scheduled</span>
        </>
      ) : null}
    </span>
  )
}
