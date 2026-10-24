"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { CalendarClock, ChefHat, Inbox, PackageCheck } from "lucide-react"

import { ConnectionStatus } from "@/components/shared/connection-status"
import type { ZoneAndLocale } from "@/lib/orders/format"
import type { OrderDetail, Rider } from "@/lib/orders/types"
import { cn } from "@/lib/utils"

import { BoardOrderCard } from "./board-order-card"
import { NewOrderAlarm } from "./new-order-alarm"
import { useNow } from "./use-now"

/** PRD §7: polling fallback interval until real-time transport exists. */
export const BOARD_POLL_MS = 15_000

type Column = {
  id: string
  title: string
  icon: LucideIcon
  empty: string
  orders: OrderDetail[]
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

/** Re-fetches the board while the tab is visible and online. */
function usePolling(enabled: boolean) {
  const router = useRouter()
  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh()
    }, BOARD_POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [enabled, router])
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
  usePolling(online)

  const columns: Column[] = [
    {
      id: "board-new",
      title: "New",
      icon: Inbox,
      empty: "No new orders.",
      orders: orders.filter((order) => order.status === "pending"),
    },
    {
      id: "board-kitchen",
      title: "In kitchen",
      icon: ChefHat,
      empty: "Nothing being prepared.",
      orders: orders.filter((order) => order.status === "accepted"),
    },
    {
      id: "board-ready",
      title: "Ready",
      icon: PackageCheck,
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
        <ConnectionStatus state={online ? "polling" : "offline"} />
      </div>

      <nav aria-label="Board columns" className="lg:hidden">
        <ul className="flex flex-wrap gap-2">
          {[...columns, { id: "board-scheduled", title: "Scheduled", orders: scheduled }].map((column) => (
            <li key={column.id}>
              <a
                href={`#${column.id}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {column.title}
                <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{column.orders.length}</span>
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
      className="flex scroll-mt-20 flex-col gap-3 rounded-2xl border bg-muted/40 p-3"
    >
      <h2 id={headingId} className="flex items-center gap-2 px-1 text-sm font-semibold">
        <Icon aria-hidden className="size-4 text-muted-foreground" />
        {column.title}
        <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs tabular-nums">
          {column.orders.length}
          <span className="sr-only"> {column.orders.length === 1 ? "order" : "orders"}</span>
        </span>
      </h2>
      {column.orders.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-background px-4 py-6 text-center text-sm text-muted-foreground">
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
