import { Bike, CalendarClock, Store, Truck, UtensilsCrossed } from "lucide-react"

import { orderStatusLabels, orderTypeLabel, paymentStatusLabels } from "@/lib/orders/lifecycle"
import type { OrderStatus, OrderSummary, PaymentStatus } from "@/lib/orders/types"
import { cn } from "@/lib/utils"

const orderStatusTone: Record<OrderStatus, string> = {
  // The design system's status tones: one colour per meaning, everywhere an order status is shown.
  scheduled: "border-violet-line bg-violet-soft text-violet-foreground",
  pending: "border-warning-line bg-warning-soft text-warning-foreground",
  accepted: "border-info-line bg-info-soft text-info-foreground",
  ready: "border-success-line bg-success-soft text-success-foreground",
  out_for_delivery: "border-cyan-line bg-cyan-soft text-cyan-foreground",
  completed: "border-neutral-line bg-neutral-soft text-neutral-foreground",
  rejected: "border-danger-line bg-danger-soft text-danger-foreground",
  cancelled: "border-danger-line bg-danger-soft text-danger-foreground",
}

const paymentStatusTone: Record<PaymentStatus, string> = {
  unpaid: "text-warning-foreground",
  paid: "text-success-foreground",
  failed: "text-danger-foreground",
  refund_pending: "text-warning-foreground",
  refunded: "text-neutral-foreground",
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
