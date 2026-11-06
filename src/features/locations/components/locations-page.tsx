"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, CircleAlert, QrCode, X } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRestaurants } from "@/features/restaurants/restaurant-context"

import { getOverview } from "../location-service"
import type { LocationsOverview, PlaceType } from "../types"
import { PlacesSection } from "./places-section"
import { SingleQrCard } from "./single-qr-card"

function ServiceBadge({ label, on }: { label: string; on: boolean }) {
  return (
    <Badge variant={on ? "secondary" : "outline"} className="gap-1">
      {on ? <Check aria-hidden className="size-3" /> : <X aria-hidden className="size-3" />}
      {label}
    </Badge>
  )
}

/** Locations & QR: the single QR plus the tables, rooms and seats the restaurant's enabled ways of ordering allow. */
export function LocationsPage() {
  const { active } = useRestaurants()
  const restaurantName = active?.name ?? "Restaurant"
  const activeId = active?.id
  const [overview, setOverview] = useState<LocationsOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pickedType, setPickedType] = useState<PlaceType | null>(null)

  // Loads again when the owner switches restaurant: the request is scoped to the active one.
  const load = useCallback(async () => {
    setError(null)
    try {
      setOverview(await getOverview())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your locations.")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- activeId is the trigger, not a value used inside
  }, [activeId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    void load()
  }, [load])

  const header = (
    <PageHeader
      title="Locations & QR"
      description="Tables, rooms and seats, each with its own QR code, plus one QR for the whole restaurant."
      actions={
        <Button asChild variant="outline">
          <Link href="/tables">
            <ArrowLeft aria-hidden />
            Tables
          </Link>
        </Button>
      }
    />
  )

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-danger-line bg-danger-soft px-4 py-4 text-sm text-danger-foreground">
          <p className="flex items-center gap-2">
            <CircleAlert aria-hidden className="size-4" />
            {error}
          </p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (overview === null) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div role="status" aria-label="Loading locations" className="flex flex-col gap-3">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  const { services, counts } = overview
  const canManage = overview.canManage

  // Only the kinds of location the restaurant's enabled ways of ordering allow are offered (the API enforces it too).
  const kinds: Array<{ type: PlaceType; label: string; count: number }> = [
    ...(services.dineIn ? [{ type: "TABLE" as const, label: "Tables", count: counts.tables }] : []),
    ...(services.roomService ? [{ type: "ROOM" as const, label: "Rooms", count: counts.rooms }] : []),
    ...(services.theaterService ? [{ type: "SEAT" as const, label: "Seats", count: counts.seats }] : []),
  ]
  const activeType = kinds.find((kind) => kind.type === pickedType)?.type ?? kinds[0]?.type
  const nothingOn = !services.dineIn && !services.roomService && !services.theaterService && !services.takeAway && !services.delivery

  return (
    <div className="flex flex-col gap-6">
      {header}

      {!overview.canManage ? (
        <div role="status" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Locations can only be changed while the restaurant is approved. Its current status is{" "}
          {overview.status.toLowerCase().replace(/_/g, " ")}.
        </div>
      ) : null}

      <section aria-label="Enabled ways of ordering" className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <ServiceBadge label="Dine-in" on={services.dineIn} />
          <ServiceBadge label="Room service" on={services.roomService} />
          <ServiceBadge label="Theater service" on={services.theaterService} />
          <ServiceBadge label="Takeaway" on={services.takeAway} />
          <ServiceBadge label="Delivery" on={services.delivery} />
        </div>
        <p className="text-sm text-muted-foreground">
          What you can add follows these switches. Change them in{" "}
          <Link className="underline" href="/settings/profile">
            Restaurant profile
          </Link>
          , Order options.
        </p>
      </section>

      {nothingOn ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <QrCode aria-hidden className="size-5" />
          </span>
          <p className="mt-3 text-sm font-medium">No ways of ordering are turned on</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
            Turn on dine-in, room service, theater service, takeaway or delivery to create QR codes.
          </p>
        </div>
      ) : null}

      <SingleQrCard restaurantName={restaurantName} overview={overview} canManage={canManage} onChanged={() => void load()} />

      {kinds.length > 0 ? (
        <>
          {kinds.length > 1 ? (
            <Tabs value={activeType} onValueChange={(value) => setPickedType(value as PlaceType)}>
              <TabsList>
                {kinds.map((kind) => (
                  <TabsTrigger key={kind.type} value={kind.type}>
                    {kind.label} ({kind.count})
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : null}

          {activeType ? (
            <PlacesSection
              key={activeType}
              restaurantName={restaurantName}
              type={activeType}
              canManage={canManage}
              onChanged={() => void load()}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}
