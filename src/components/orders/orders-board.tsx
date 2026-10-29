"use client"

import { useEffect, useState } from "react"
import type { LucideIcon } from "lucide-react"
import { CalendarClock, ChefHat, Inbox, PackageCheck } from "lucide-react"

import { ConnectionStatus } from "@/components/shared/connection-status"
import { REFRESH_INTERVAL_MS, useVisibleRefresh } from "@/components/shared/use-visible-refresh"
import type { ZoneAndLocale } from "@/lib/orders/format"
import type { OrderDetail, Rider } from "@/lib/orders/types"
import { cn } from "@/lib/utils"

import { BoardOrderCard } from "./board-order-card"
import { NewOrderAlarm } from "./new-order-alarm"
import { useNow } from "./use-now"

/** PRD §7: polling fallback interval until real-time transport exists. */
export const BOARD_POLL_MS = REFRESH_INTERVAL_MS

type Column = {
  id: string
  title: string
  icon: LucideIcon
  /** The icon disc uses the same status tone as the badges on the cards below it. */
  tone: string
  empty: string
  orders: OrderDetail[]
}

const COLUMN_TONES = {
  new: "bg-warning-soft text-warning-foreground",
  kitchen: "bg-info-soft text-info-foreground",
  ready: "bg-success-soft text-success-foreground",
  scheduled: "bg-violet-soft text-violet-foreground",
}

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
 * Live order board (PRD §4.2): New → In kitchen → Ready, plus scheduled
 * orders. Columns sit side by side on wide screens and stack on phones, with
 * jump links to each column.
 */
export function OrdersBoard({
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
  // Re-fetches the board while the tab is visible and online (shared with the dashboard).
  useVisibleRefresh(online, BOARD_POLL_MS)

  const columns: Column[] = [
    {
      id: "board-new",
      title: "New",
      icon: Inbox,
      tone: COLUMN_TONES.new,
      empty: "No new orders.",
      orders: orders.filter((order) => order.status === "pending"),
    },
    {
      id: "board-kitchen",
      title: "In kitchen",
      icon: ChefHat,
      tone: COLUMN_TONES.kitchen,
      empty: "Nothing being prepared.",
      orders: orders.filter((order) => order.status === "accepted"),
    },
    {
      id: "board-ready",
      title: "Ready",
      icon: PackageCheck,
      tone: COLUMN_TONES.ready,
      empty: "Nothing waiting for collection or delivery.",
      orders: orders.filter((order) => order.status === "ready" || order.status === "out_for_delivery"),
    },
  ]
  const scheduled = orders.filter((order) => order.status === "scheduled")
  const pending = columns[0].orders

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <NewOrderAlarm pendingReferences={pending.map(({ id, reference }) => ({ id, reference }))} />
        <ConnectionStatus state={online ? "polling" : "offline"} className="bg-card shadow-xs" />
      </div>

      <nav aria-label="Board columns" className="lg:hidden">
        <ul className="flex flex-wrap gap-2">
          {[...columns, { id: "board-scheduled", title: "Scheduled", orders: scheduled }].map((column) => (
            <li key={column.id}>
              <a
                href={`#${column.id}`}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-card pr-1.5 pl-4 text-sm font-semibold shadow-[0_8px_30px_rgb(31_26_23/6%)] outline-none hover:bg-primary-faint focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {column.title}
                <span className="grid min-w-7 place-items-center rounded-full bg-foreground px-1.5 py-0.5 text-xs font-semibold text-background tabular-nums">
                  {column.orders.length}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        {columns.map((column) => (
          <BoardColumn key={column.id} column={column} riders={riders} context={context} now={now} />
        ))}
      </div>

      <BoardColumn
        column={{
          id: "board-scheduled",
          title: "Scheduled",
          icon: CalendarClock,
          tone: COLUMN_TONES.scheduled,
          empty: "No scheduled orders.",
          orders: scheduled,
        }}
        riders={riders}
        context={context}
        now={now}
        wide
      />
    </div>
  )
}

function BoardColumn({
  column,
  riders,
  context,
  now,
  wide = false,
}: {
  column: Column
  riders: Rider[]
  context: ZoneAndLocale
  now: number | null
  wide?: boolean
}) {
  const Icon = column.icon
  const headingId = `${column.id}-heading`
  return (
    <section
      id={column.id}
      aria-labelledby={headingId}
      className="flex scroll-mt-20 flex-col gap-3 rounded-3xl bg-card/55 p-3 ring-1 ring-border-soft sm:p-4"
    >
      <h2 id={headingId} className="flex items-center gap-3 text-base font-semibold">
        <span className={cn("grid size-9 place-items-center rounded-full", column.tone)}>
          <Icon aria-hidden className="size-[18px]" strokeWidth={1.75} />
        </span>
        {column.title}
        <span className="ml-auto grid min-w-8 place-items-center rounded-full bg-card px-2.5 py-1 text-xs font-semibold tabular-nums shadow-[0_2px_8px_rgb(31_26_23/8%)]">
          {column.orders.length}
          <span className="sr-only"> {column.orders.length === 1 ? "order" : "orders"}</span>
        </span>
      </h2>
      {column.orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/70 px-4 py-6 text-center text-sm text-muted-foreground">
          {column.empty}
        </p>
      ) : (
        <ul className={cn("grid gap-3", wide && "md:grid-cols-2 xl:grid-cols-3")}>
          {column.orders.map((order) => (
            <li key={order.id} className="min-w-0">
              <BoardOrderCard order={order} riders={riders} context={context} now={now} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
