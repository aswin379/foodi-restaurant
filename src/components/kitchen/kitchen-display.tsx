"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { Bike, ChefHat, Inbox, MessageSquareText, PackageCheck, Store, TriangleAlert, UtensilsCrossed } from "lucide-react"

import { OrderActions } from "@/components/orders/order-actions"
import { isUrgent, OrderTimingChip } from "@/components/orders/order-timing"
import { useNow } from "@/components/orders/use-now"
import { ConnectionStatus } from "@/components/shared/connection-status"
import { REFRESH_INTERVAL_MS, useVisibleRefresh } from "@/components/shared/use-visible-refresh"
import { ORDER_TYPES, orderTypeLabels, type OrderType } from "@/lib/domain/order-types"
import { formatTime, type ZoneAndLocale } from "@/lib/orders/format"
import type { OrderDetail, OrderStatus, Rider } from "@/lib/orders/types"
import { cn } from "@/lib/utils"

type Column = { id: string; title: string; icon: LucideIcon; tone: string; statuses: OrderStatus[]; empty: string }

const COLUMNS: Column[] = [
  { id: "new", title: "New", icon: Inbox, tone: "bg-warning-soft text-warning-foreground", statuses: ["pending"], empty: "No new orders." },
  { id: "preparing", title: "Preparing", icon: ChefHat, tone: "bg-info-soft text-info-foreground", statuses: ["accepted"], empty: "Nothing being prepared." },
  { id: "ready", title: "Ready", icon: PackageCheck, tone: "bg-success-soft text-success-foreground", statuses: ["ready"], empty: "Nothing waiting to be collected." },
]

const TYPE_ICON: Record<OrderType, LucideIcon> = { delivery: Bike, takeaway: Store, dine_in: UtensilsCrossed }

function useOnline() {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    const first = setTimeout(update, 0)
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      clearTimeout(first)
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [])
  return online
}

/**
 * Kitchen display on the existing order lifecycle: the same orders and the same actions as the Orders board,
 * laid out large for a kitchen screen. It refreshes by polling, like the board, and says so. There is no
 * station routing in the order model, so there is no station filter.
 */
export function KitchenDisplay({
  orders,
  riders,
  context,
  recentlyCompleted,
}: {
  orders: OrderDetail[]
  riders: Rider[]
  context: ZoneAndLocale
  recentlyCompleted: { id: string; reference: string; orderType: OrderType; placedAt: string }[]
}) {
  const now = useNow(30_000, orders)
  const online = useOnline()
  useVisibleRefresh(online, REFRESH_INTERVAL_MS)
  const [type, setType] = useState<OrderType | "all">("all")
  const inKitchen = orders.filter((order) => COLUMNS.some((column) => column.statuses.includes(order.status)))
  const shown = inKitchen.filter((order) => type === "all" || order.orderType === type)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter by order type" className="flex w-fit max-w-full flex-wrap gap-1 rounded-3xl bg-card p-1 shadow-[0_4px_14px_rgb(31_26_23/8%)]">
          {(["all", ...ORDER_TYPES] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={type === value}
              onClick={() => setType(value)}
              className={cn(
                "inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                type === value
                  ? "bg-primary text-primary-foreground shadow-[0_6px_14px_rgb(214_63_8/25%)]"
                  : "text-muted-foreground hover:bg-primary-faint hover:text-foreground"
              )}
            >
              {value === "all" ? "All orders" : orderTypeLabels[value]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="rounded-full bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-xs">
            Station filters aren&apos;t available: orders aren&apos;t routed to stations yet.
          </p>
          <ConnectionStatus state={online ? "polling" : "offline"} className="bg-card shadow-xs" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        {COLUMNS.map((column) => {
          const list = shown.filter((order) => column.statuses.includes(order.status))
          const Icon = column.icon
          return (
            <section
              key={column.id}
              aria-labelledby={`kds-${column.id}-title`}
              className="flex flex-col gap-3 rounded-3xl bg-card/55 p-3 ring-1 ring-border-soft sm:p-4"
            >
              <h2 id={`kds-${column.id}-title`} className="flex items-center gap-3 text-lg font-bold">
                <span className={cn("grid size-10 place-items-center rounded-full", column.tone)}>
                  <Icon aria-hidden className="size-5" strokeWidth={1.75} />
                </span>
                {column.title}
                <span className="ml-auto grid min-w-9 place-items-center rounded-full bg-card px-3 py-1 text-sm font-bold tabular-nums shadow-[0_2px_8px_rgb(31_26_23/8%)]">
                  {list.length}
                  <span className="sr-only"> {list.length === 1 ? "order" : "orders"}</span>
                </span>
              </h2>
              {list.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border bg-card/70 px-4 py-8 text-center text-sm text-muted-foreground">{column.empty}</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {list.map((order) => (
                    <li key={order.id}>
                      <Ticket order={order} riders={riders} context={context} now={now} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      <section aria-labelledby="kds-done-title" className="flex flex-col gap-3 rounded-3xl bg-card p-5 shadow-[0_8px_30px_rgb(31_26_23/6%)]">
        <h2 id="kds-done-title" className="text-lg font-semibold">
          Recently completed
        </h2>
        {recentlyCompleted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed orders to show.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {recentlyCompleted.map((order) => {
              const Icon = TYPE_ICON[order.orderType]
              return (
                <li key={order.id}>
                  <Link
                    href={`/orders/${encodeURIComponent(order.id)}`}
                    className="inline-flex items-center gap-2 rounded-full bg-neutral-soft px-3 py-1.5 text-sm font-medium text-neutral-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <Icon aria-hidden className="size-3.5" />
                    <span className="font-mono">{order.reference}</span>
                    <span className="text-xs">{formatTime(order.placedAt, context)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function Ticket({ order, riders, context, now }: { order: OrderDetail; riders: Rider[]; context: ZoneAndLocale; now: number | null }) {
  const urgent = isUrgent(order, now)
  const Icon = TYPE_ICON[order.orderType]
  const titleId = `kds-ticket-${order.id}`
  const where = order.orderType === "dine_in" ? order.tableLabel : order.orderType === "takeaway" ? "Pickup" : null
  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-[0_8px_30px_rgb(31_26_23/6%)]",
        urgent ? "ring-2 ring-danger-line" : order.status === "pending" ? "ring-2 ring-warning-line" : "ring-1 ring-border-soft"
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={titleId} className="font-mono text-xl font-bold tracking-tight">
            <Link href={`/orders/${encodeURIComponent(order.id)}`} className="rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
              {order.reference}
            </Link>
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Icon aria-hidden className="size-4" />
            {orderTypeLabels[order.orderType]}
            {where ? <span> · {where}</span> : null}
          </p>
        </div>
        <OrderTimingChip order={order} now={now} />
      </header>

      <ul className="flex flex-col gap-2 rounded-xl bg-background/70 px-3 py-3">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <span className="grid h-9 min-w-9 place-items-center rounded-lg bg-primary-soft px-1.5 text-base font-bold text-primary-text tabular-nums">{item.quantity}×</span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold">{item.name}</p>
              {item.options.length > 0 ? <p className="text-sm text-muted-foreground">{item.options.join(", ")}</p> : null}
              {item.note ? <p className="text-sm font-medium text-warning-foreground">Note: {item.note}</p> : null}
              {item.unavailableAfterPlacement ? (
                <p className="flex items-center gap-1 text-sm font-medium text-danger-foreground">
                  <TriangleAlert aria-hidden className="size-4" />
                  Marked unavailable after this order was placed
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {order.customerNote ? (
        <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning-foreground">
          <MessageSquareText aria-hidden className="mt-0.5 size-4 shrink-0" />
          {order.customerNote}
        </p>
      ) : null}

      <OrderActions order={order} riders={riders} context={context} layout="compact" />
    </article>
  )
}
