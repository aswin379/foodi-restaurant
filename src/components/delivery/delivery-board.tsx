"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { Bike, CalendarClock, ChefHat, Inbox, MapPin, MessageSquareText, PackageCheck, Route, UserRound } from "lucide-react"

import { OrderActions } from "@/components/orders/order-actions"
import { OrderTimingChip } from "@/components/orders/order-timing"
import { useNow } from "@/components/orders/use-now"
import { ConnectionStatus } from "@/components/shared/connection-status"
import { REFRESH_INTERVAL_MS, useVisibleRefresh } from "@/components/shared/use-visible-refresh"
import { formatMoney, type ZoneAndLocale } from "@/lib/orders/format"
import type { OrderDetail, OrderStatus, Rider } from "@/lib/orders/types"
import { cn } from "@/lib/utils"

const SURFACE = "shadow-[0_8px_30px_rgb(31_26_23/6%)]"

type Stage = { id: string; title: string; icon: LucideIcon; tone: string; statuses: OrderStatus[]; empty: string }

// The stages the existing order lifecycle supports for a delivery. "Assigned" and "picked up" are not
// separate lifecycle states: dispatching an own-rider delivery moves it straight to Out for delivery.
const STAGES: Stage[] = [
  { id: "new", title: "New", icon: Inbox, tone: "bg-warning-soft text-warning-foreground", statuses: ["pending"], empty: "No new deliveries." },
  { id: "preparing", title: "Preparing", icon: ChefHat, tone: "bg-info-soft text-info-foreground", statuses: ["accepted"], empty: "Nothing being prepared." },
  { id: "ready", title: "Ready to dispatch", icon: PackageCheck, tone: "bg-success-soft text-success-foreground", statuses: ["ready"], empty: "Nothing waiting for a rider." },
  { id: "out", title: "Out for delivery", icon: Bike, tone: "bg-cyan-soft text-cyan-foreground", statuses: ["out_for_delivery"], empty: "No deliveries on the road." },
  { id: "scheduled", title: "Scheduled", icon: CalendarClock, tone: "bg-violet-soft text-violet-foreground", statuses: ["scheduled"], empty: "No scheduled deliveries." },
]

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
 * Delivery operations, built on the existing order lifecycle: the same orders as the Orders board, only the
 * delivery ones, with the delivery facts first. Assigning an own rider is the existing Dispatch action.
 */
export function DeliveryBoard({
  orders,
  riders,
  context,
}: {
  orders: OrderDetail[]
  riders: Rider[]
  context: ZoneAndLocale
}) {
  const now = useNow(30_000, orders)
  const online = useOnline()
  useVisibleRefresh(online, REFRESH_INTERVAL_MS)
  const deliveries = orders.filter((order) => order.orderType === "delivery")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul aria-label="Deliveries by stage" className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {STAGES.map((stage) => {
            const Icon = stage.icon
            const count = deliveries.filter((order) => stage.statuses.includes(order.status)).length
            return (
              <li key={stage.id}>
                <a
                  href={`#delivery-${stage.id}`}
                  className={cn("flex items-center gap-3 rounded-3xl bg-card p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", SURFACE)}
                >
                  <span aria-hidden className={cn("grid size-11 shrink-0 place-items-center rounded-full", stage.tone)}>
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[13px] font-medium text-muted-foreground">{stage.title}</span>
                    <span className="text-[1.75rem] leading-9 font-bold tabular-nums">{count}</span>
                    <span className="sr-only">{count === 1 ? "delivery" : "deliveries"}</span>
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
        <ConnectionStatus state={online ? "polling" : "offline"} className="bg-card shadow-xs" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="flex flex-col gap-6">
          {STAGES.map((stage) => {
            const list = deliveries.filter((order) => stage.statuses.includes(order.status))
            const Icon = stage.icon
            return (
              <section
                key={stage.id}
                id={`delivery-${stage.id}`}
                aria-labelledby={`delivery-${stage.id}-title`}
                className="flex scroll-mt-20 flex-col gap-3 rounded-3xl bg-card/55 p-3 ring-1 ring-border-soft sm:p-4"
              >
                <h2 id={`delivery-${stage.id}-title`} className="flex items-center gap-3 text-base font-semibold">
                  <span className={cn("grid size-9 place-items-center rounded-full", stage.tone)}>
                    <Icon aria-hidden className="size-[18px]" strokeWidth={1.75} />
                  </span>
                  {stage.title}
                  <span className="ml-auto grid min-w-8 place-items-center rounded-full bg-card px-2.5 py-1 text-xs font-semibold tabular-nums shadow-[0_2px_8px_rgb(31_26_23/8%)]">
                    {list.length}
                    <span className="sr-only"> {list.length === 1 ? "delivery" : "deliveries"}</span>
                  </span>
                </h2>
                {list.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border bg-card/70 px-4 py-6 text-center text-sm text-muted-foreground">
                    {stage.empty}
                  </p>
                ) : (
                  <ul className="grid gap-3 md:grid-cols-2">
                    {list.map((order) => (
                      <li key={order.id} className="min-w-0">
                        <DeliveryCard order={order} riders={riders} context={context} now={now} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>

        <aside className="flex flex-col gap-4" aria-label="Delivery personnel and tracking">
          <RidersPanel riders={riders} deliveries={deliveries} />
          <section className="flex flex-col gap-2 rounded-3xl border border-dashed border-border bg-card/70 p-5 text-sm">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Route aria-hidden className="size-4" />
              Not connected yet
            </h2>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Live rider location and tracking.</li>
              <li>Foodi-rider assignment status and rider details.</li>
              <li>Proof of delivery and failed-delivery reasons from riders.</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              Nothing here is simulated. Own-rider dispatch uses the existing Dispatch action on each delivery.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}

function RidersPanel({ riders, deliveries }: { riders: Rider[]; deliveries: OrderDetail[] }) {
  return (
    <section aria-labelledby="riders-title" className={cn("flex flex-col gap-3 rounded-3xl bg-card p-5", SURFACE)}>
      <h2 id="riders-title" className="text-lg font-semibold">
        Your riders
      </h2>
      {riders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No own riders are set up. Foodi riders collect Foodi-delivery orders, and you can&apos;t assign them here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {riders.map((rider) => {
            const active = deliveries.filter((order) => order.rider?.id === rider.id && order.status === "out_for_delivery").length
            return (
              <li key={rider.id} className="flex items-center gap-3 rounded-2xl bg-background/70 p-3 ring-1 ring-border-soft">
                <span aria-hidden className="grid size-9 place-items-center rounded-full bg-primary-soft text-primary-text">
                  <UserRound className="size-4" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold">{rider.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {active === 0 ? "No deliveries on the road" : `${active} ${active === 1 ? "delivery" : "deliveries"} on the road`}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function DeliveryCard({
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
  const titleId = `delivery-card-${order.id}`
  return (
    <article aria-labelledby={titleId} className={cn("flex h-full flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-border-soft", SURFACE)}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={titleId} className="text-base font-bold tracking-tight">
            <Link
              href={`/orders/${encodeURIComponent(order.id)}`}
              className="rounded-sm underline-offset-4 outline-none hover:text-primary-text hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {order.reference}
            </Link>
          </h3>
          <p className="text-xs text-muted-foreground">
            {order.deliveryMode === "restaurant" ? "Delivery · own rider" : "Delivery · Foodi rider"}
          </p>
        </div>
        <OrderTimingChip order={order} now={now} />
      </header>

      <dl className="flex flex-col gap-2 rounded-xl bg-background/70 p-3 text-sm">
        <div className="flex items-start gap-2">
          <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <dt className="sr-only">Delivery address</dt>
            <dd>{order.deliveryAddress ?? "Address not shared"}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <UserRound aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <dt className="sr-only">Customer</dt>
            <dd>{order.customerName ?? "Name not shared"}</dd>
          </div>
        </div>
        {order.customerNote ? (
          <div className="flex items-start gap-2">
            <MessageSquareText aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <dt className="sr-only">Delivery instructions</dt>
              <dd>{order.customerNote}</dd>
            </div>
          </div>
        ) : null}
        {order.rider ? (
          <div className="flex items-start gap-2">
            <Bike aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <dt className="sr-only">Rider</dt>
              <dd>{order.rider.name}</dd>
            </div>
          </div>
        ) : null}
      </dl>

      <div className="flex items-center justify-between gap-3 border-t border-border-soft pt-3 text-sm">
        <span className="text-muted-foreground">
          {order.charges.deliveryFee ? `Delivery fee ${formatMoney(order.charges.deliveryFee, context.locale)}` : "No delivery fee"}
        </span>
        <span className="text-base font-bold tabular-nums">{formatMoney(order.total, context.locale)}</span>
      </div>

      <OrderActions order={order} riders={riders} context={context} layout="compact" />
    </article>
  )
}
