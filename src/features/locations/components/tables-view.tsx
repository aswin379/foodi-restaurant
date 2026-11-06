"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CircleAlert, LayoutGrid, QrCode } from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useRestaurants } from "@/features/restaurants/restaurant-context"
import { cn } from "@/lib/utils"

import { listAllDestinations } from "../location-service"
import type { Destination } from "../types"

/** The restaurant's real tables (the ones created in Locations & QR). Live status isn't recorded anywhere yet, so none is shown. */
export function TablesView() {
  const { active } = useRestaurants()
  const activeId = active?.id
  const [tables, setTables] = useState<Destination[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Destination | null>(null)

  // Loads again when the owner switches restaurant: the request is scoped to the active one.
  const load = useCallback(async () => {
    setError(null)
    try {
      setTables(await listAllDestinations({ type: "TABLE" }))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your tables.")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- activeId is the trigger, not a value used inside
  }, [activeId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    void load()
  }, [load])

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-danger-line bg-danger-soft px-4 py-4 text-sm text-danger-foreground">
        <p className="flex items-center gap-2">
          <CircleAlert aria-hidden className="size-4" />
          {error}
        </p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    )
  }

  if (tables === null) {
    return (
      <div role="status" aria-label="Loading tables" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (tables.length === 0) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title="No tables yet"
        description="Add your tables in Locations & QR and they will appear here."
        className="min-h-72 rounded-3xl border-border bg-card"
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Select a table to see its details.</p>
      <ul aria-label="Tables" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tables.map((table) => (
          <li key={table.id}>
            <button
              type="button"
              onClick={() => setSelected(table)}
              className={cn(
                "flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-2xl bg-card p-2 text-center shadow-[0_8px_30px_rgb(31_26_23/6%)] outline-none transition-shadow hover:shadow-[0_12px_36px_rgb(214_63_8/22%)] focus-visible:ring-[3px] focus-visible:ring-ring/60",
                !table.isActive && "opacity-60"
              )}
            >
              <span className="text-sm leading-tight font-bold">{table.label}</span>
              <Badge variant={table.isActive ? "secondary" : "outline"}>{table.isActive ? "Active" : "Disabled"}</Badge>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.label}</DialogTitle>
            <DialogDescription>Table details</DialogDescription>
          </DialogHeader>
          {selected ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium">{selected.isActive ? "Active" : "Disabled"}</dd>
              <dt className="text-muted-foreground">QR code</dt>
              <dd className="font-medium">{selected.qrGenerated ? "Ready" : "Not generated yet"}</dd>
            </dl>
          ) : null}
          <Button asChild variant="outline" className="w-fit">
            <Link href="/locations">
              <QrCode aria-hidden />
              Manage in Locations &amp; QR
            </Link>
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
