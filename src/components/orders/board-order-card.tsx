"use client"

import Link from "next/link"
import { Bike, MessageSquareText, TriangleAlert } from "lucide-react"

import { formatMoney, formatTime, type ZoneAndLocale } from "@/lib/orders/format"
import type { OrderDetail, Rider } from "@/lib/orders/types"
import { cn } from "@/lib/utils"

import { OrderActions } from "./order-actions"
import { isUrgent, OrderTimingChip } from "./order-timing"
import { OrderStatusBadge, OrderTypeLabel, PaymentStatusText } from "./status-badges"

export function BoardOrderCard({
  order,
  riders,
  context,
  now,
}: {
  order: OrderDetail
  riders: Rider[]
  context: ZoneAndLocale
  now: number | null
}) {
  const urgent = isUrgent(order, now)
  const titleId = `order-card-${order.id}`

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        // Urgency is the ring plus the timing chip's words ("Late by…"), never colour alone.
        "flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-[0_8px_30px_rgb(31_26_23/6%)]",
        urgent
          ? "ring-2 ring-danger-line"
          : order.status === "pending"
            ? "ring-2 ring-warning-line"
            : "ring-1 ring-border-soft"
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h3 id={titleId} className="text-base font-bold tracking-tight">
            <Link
              href={`/orders/${encodeURIComponent(order.id)}`}
              className="rounded-sm underline-offset-4 outline-none hover:text-primary-text hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {order.reference}
            </Link>
          </h3>
          <OrderTypeLabel order={order} className="text-xs" />
        </div>
        {order.status === "out_for_delivery" ? (
          <OrderStatusBadge status={order.status} />
        ) : (
          <OrderTimingChip order={order} now={now} />
        )}
      </header>

      {order.scheduledFor ? (
        <p className="text-sm">
          For <time dateTime={order.scheduledFor}>{formatTime(order.scheduledFor, context)}</time>
          {", "}
          {new Intl.DateTimeFormat(context.locale, {
            timeZone: context.timeZone,
            weekday: "short",
            day: "numeric",
            month: "short",
          }).format(new Date(order.scheduledFor))}
        </p>
      ) : null}

      <ul className="flex flex-col gap-1.5 rounded-xl bg-background/70 px-3 py-2.5 text-sm">
        {order.items.map((item) => (
          <li key={item.id}>
            <span className="font-semibold tabular-nums">{item.quantity}×</span> {item.name}
            {item.options.length > 0 ? (
              <span className="text-muted-foreground"> · {item.options.join(", ")}</span>
            ) : null}
            {item.note ? <span className="block text-xs text-warning-foreground">Note: {item.note}</span> : null}
            {item.unavailableAfterPlacement ? (
              <span className="flex items-center gap-1 text-xs font-medium text-danger-foreground">
                <TriangleAlert aria-hidden className="size-3.5" />
                Marked unavailable after this order was placed
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {order.customerNote || order.tableLabel || order.rider ? (
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          {order.tableLabel ? <span className="font-medium text-foreground">{order.tableLabel}</span> : null}
          {order.customerNote ? (
            <span className="flex items-start gap-1">
              <MessageSquareText aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {order.customerNote}
            </span>
          ) : null}
          {order.rider ? (
            <span className="flex items-center gap-1">
              <Bike aria-hidden className="size-3.5" />
              {order.rider.name}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-border-soft pt-3 text-sm">
        <span className="text-muted-foreground">
          {order.paymentMethod === "cash" ? "Cash" : "Online"} · <PaymentStatusText status={order.paymentStatus} />
        </span>
        <span className="text-base font-bold tabular-nums">{formatMoney(order.total, context.locale)}</span>
      </div>

      <OrderActions order={order} riders={riders} context={context} layout="compact" />
    </article>
  )
}
