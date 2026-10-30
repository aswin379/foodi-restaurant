"use client"

import { useState } from "react"
import Link from "next/link"
import { CircleCheck, Clock, Info, LayoutGrid, List, Sparkles, Users, Utensils, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatMoney } from "@/lib/orders/format"
import type { FloorTable, TableStatus } from "@/lib/tables"
import { cn } from "@/lib/utils"

const SURFACE = "shadow-[0_8px_30px_rgb(31_26_23/6%)]"

// Each status has a word, an icon and a tone: colour is never the only signal.
const STATUS: Record<TableStatus, { label: string; icon: LucideIcon; tone: string; ring: string }> = {
  available: { label: "Available", icon: CircleCheck, tone: "bg-success-soft text-success-foreground", ring: "ring-success-line" },
  occupied: { label: "Occupied", icon: Utensils, tone: "bg-warning-soft text-warning-foreground", ring: "ring-warning-line" },
  reserved: { label: "Reserved", icon: Clock, tone: "bg-info-soft text-info-foreground", ring: "ring-info-line" },
  cleaning: { label: "Cleaning", icon: Sparkles, tone: "bg-neutral-soft text-neutral-foreground", ring: "ring-neutral-line" },
}

/**
 * Floor plan and list of tables, with a details panel. Sample data only (labelled by the page). Nothing here
 * starts, moves or closes a table: the tables service isn't connected, and the panel says so.
 */
export function FloorView({ tables, locale }: { tables: FloorTable[]; locale: string }) {
  const [view, setView] = useState<"plan" | "list">("plan")
  const [zone, setZone] = useState<string>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const zones = [...new Set(tables.map((table) => table.zone))]
  const shown = tables.filter((table) => zone === "all" || table.zone === zone)
  const selected = tables.find((table) => table.id === selectedId) ?? null
  const counts = (Object.keys(STATUS) as TableStatus[]).map((status) => ({ status, count: tables.filter((table) => table.status === status).length }))

  return (
    <div className="flex flex-col gap-5">
      <ul aria-label="Tables by status" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {counts.map(({ status, count }) => {
          const Icon = STATUS[status].icon
          return (
            <li key={status} className={cn("flex items-center gap-3 rounded-3xl bg-card p-4", SURFACE)}>
              <span aria-hidden className={cn("grid size-11 shrink-0 place-items-center rounded-full", STATUS[status].tone)}>
                <Icon className="size-5" strokeWidth={1.75} />
              </span>
              <span className="flex flex-col">
                <span className="text-[13px] font-medium text-muted-foreground">{STATUS[status].label}</span>
                <span className="text-[1.75rem] leading-9 font-bold tabular-nums">{count}</span>
              </span>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="View" className={cn("flex w-fit gap-1 rounded-full bg-card p-1", SURFACE)}>
          {([["plan", "Floor plan", LayoutGrid], ["list", "List", List]] as const).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => setView(value)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                view === value ? "bg-primary text-primary-foreground shadow-[0_6px_14px_rgb(214_63_8/25%)]" : "text-muted-foreground hover:bg-primary-faint hover:text-foreground"
              )}
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Zone" className="flex flex-wrap gap-2">
          {["all", ...zones].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={zone === value}
              onClick={() => setZone(value)}
              className={cn(
                "inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                zone === value ? "bg-foreground text-background" : "bg-card text-foreground shadow-xs hover:bg-primary-faint"
              )}
            >
              {value === "all" ? "All zones" : value}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        {view === "plan" ? (
          <section aria-label="Floor plan" className={cn("relative aspect-[4/3] min-h-[22rem] w-full rounded-3xl bg-card/70 p-2 ring-1 ring-border-soft", SURFACE)}>
            {shown.map((table) => {
              const { label, icon: Icon, tone, ring } = STATUS[table.status]
              return (
                <button
                  key={table.id}
                  type="button"
                  aria-pressed={selectedId === table.id}
                  onClick={() => setSelectedId(table.id)}
                  style={{ left: `${table.x}%`, top: `${table.y}%` }}
                  className={cn(
                    "absolute flex h-[22%] w-[19%] min-w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl bg-card p-1 text-center outline-none ring-2 transition-shadow focus-visible:ring-[3px] focus-visible:ring-ring/60",
                    ring,
                    selectedId === table.id && "shadow-[0_12px_36px_rgb(214_63_8/22%)] ring-primary"
                  )}
                >
                  <span className="text-sm leading-tight font-bold">{table.name}</span>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold", tone)}>
                    <Icon aria-hidden className="size-3" />
                    {label}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Users aria-hidden className="size-3" />
                    {table.capacity}
                    <span className="sr-only"> seats</span>
                  </span>
                </button>
              )
            })}
          </section>
        ) : (
          <div className={cn("overflow-hidden rounded-3xl bg-card", SURFACE)}>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Table</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Seats</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((table) => {
                  const { label, icon: Icon, tone } = STATUS[table.status]
                  return (
                    <TableRow key={table.id} className="h-14 cursor-pointer" onClick={() => setSelectedId(table.id)}>
                      <TableCell className="pl-6">
                        <button type="button" onClick={() => setSelectedId(table.id)} className="rounded-sm font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                          {table.name}
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{table.zone}</TableCell>
                      <TableCell className="tabular-nums">{table.capacity}</TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", tone)}>
                          <Icon aria-hidden className="size-3.5" />
                          {label}
                        </span>
                      </TableCell>
                      <TableCell className="pr-6 text-right text-muted-foreground tabular-nums">{table.occupiedMinutes ? `${table.occupiedMinutes} min` : "—"}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <aside aria-label="Table details" className={cn("flex flex-col gap-4 rounded-3xl bg-card p-5", SURFACE)}>
          {selected ? (
            <>
              <div>
                <h2 className="text-lg font-semibold">{selected.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {selected.zone} · {selected.capacity} seats
                </p>
              </div>
              <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold", STATUS[selected.status].tone)}>
                {STATUS[selected.status].label}
              </span>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-background/70 p-4 text-sm ring-1 ring-border-soft">
                <dt className="text-muted-foreground">Guests</dt>
                <dd className="font-medium">{selected.guests ?? "—"}</dd>
                <dt className="text-muted-foreground">Seated for</dt>
                <dd className="font-medium">{selected.occupiedMinutes ? `${selected.occupiedMinutes} min` : "—"}</dd>
                <dt className="text-muted-foreground">Order</dt>
                <dd className="font-medium">
                  {selected.order ? (
                    <Link href={`/orders/${selected.order.id}`} className="rounded-sm font-mono text-primary-text underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
                      {selected.order.reference}
                    </Link>
                  ) : (
                    "None linked"
                  )}
                </dd>
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="font-medium tabular-nums">{selected.order ? formatMoney({ amountMinor: selected.order.totalMinor, currency: "INR" }, locale) : "—"}</dd>
              </dl>
              <Button asChild disabled={selected.status !== "available"}>
                <Link href="/pos" aria-disabled={selected.status !== "available"}>Start an order in POS</Link>
              </Button>
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info aria-hidden className="mt-px size-3.5 shrink-0" />
                Seating, moving, combining and closing tables aren&apos;t connected, so none of them are offered. Tables don&apos;t change from this screen.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a table to see its details.</p>
          )}
        </aside>
      </div>
    </div>
  )
}
