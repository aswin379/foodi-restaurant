"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, Loader2, Plus, Store } from "lucide-react"

import { DASHBOARD_HOME } from "@/components/dashboard/navigation"
import { Button } from "@/components/ui/button"
import { useRestaurants } from "../restaurant-context"
import type { Restaurant } from "../types"
import { RestaurantStatusBadge } from "./restaurant-status-badge"

const STATUS_HELP: Record<string, string> = {
  SUBMITTED: "Your application is waiting for review. You will be able to manage this restaurant once it is approved.",
  UNDER_REVIEW: "Our team is reviewing your application.",
  CHANGES_REQUESTED: "Our team asked for changes. Open the application to see the feedback and resubmit.",
  REJECTED: "This application was not approved. Open it to see why and to correct and resubmit.",
  SUSPENDED: "This restaurant is suspended. Contact support for details.",
}

function RestaurantCard({ restaurant, onOpen }: { restaurant: Restaurant; onOpen: () => void }) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs">
      <div className="flex items-center gap-3">
        {restaurant.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from storage
          <img src={restaurant.logoUrl} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-text">
            <Store aria-hidden className="size-6" strokeWidth={1.75} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{restaurant.name}</h2>
          <div className="mt-1">
            <RestaurantStatusBadge status={restaurant.status} />
          </div>
        </div>
      </div>
      {restaurant.isOperational ? (
        <>
          {restaurant.subscriptionStatus ? (
            <p className="text-xs text-muted-foreground">
              Subscription: {restaurant.subscriptionStatus.toLowerCase()}
              {restaurant.subscriptionExpiresOn ? ` · until ${restaurant.subscriptionExpiresOn}` : ""}
            </p>
          ) : null}
          <Button onClick={onOpen} className="mt-auto">
            Open dashboard
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {STATUS_HELP[restaurant.status] ?? "This restaurant is not available yet."}
          </p>
          <Button asChild variant="outline" className="mt-auto">
            <Link href={`/restaurants/${restaurant.id}`}>
              {restaurant.status === "CHANGES_REQUESTED" || restaurant.status === "REJECTED"
                ? "View feedback and update"
                : "View application"}
            </Link>
          </Button>
        </>
      )}
    </li>
  )
}

/**
 * My Restaurants. Arriving right after sign-in (`?auto=1`) with exactly one approved restaurant goes straight
 * to its dashboard; otherwise the owner chooses, or sees the pending state.
 */
export function RestaurantList() {
  const router = useRouter()
  const auto = useSearchParams().get("auto") === "1"
  const { status, restaurants, active, select, reload } = useRestaurants()
  const approved = restaurants.filter((r) => r.isOperational)

  useEffect(() => {
    if (auto && status === "ready" && approved.length === 1 && active) router.replace(DASHBOARD_HOME)
  }, [auto, status, approved.length, active, router])

  if (status === "loading" || (auto && approved.length === 1)) {
    return (
      <div role="status" className="grid min-h-60 place-items-center text-muted-foreground">
        <Loader2 aria-hidden className="size-6 animate-spin" />
        <span className="sr-only">Loading your restaurants…</span>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-danger-line bg-danger-soft p-4 text-danger-foreground">
        <p className="flex items-center gap-2 text-sm font-medium">
          <AlertCircle aria-hidden className="size-4" /> We couldn&apos;t load your restaurants.
        </p>
        <Button variant="outline" onClick={() => void reload()}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My restaurants</h1>
          <p className="text-sm text-muted-foreground">Choose a restaurant to manage, or apply for another one.</p>
        </div>
        <Button asChild>
          <Link href="/restaurants/new">
            <Plus aria-hidden /> Add restaurant
          </Link>
        </Button>
      </div>

      {approved.length === 0 && restaurants.length > 0 ? (
        <p role="status" className="rounded-2xl border bg-info-soft p-4 text-sm text-info-foreground">
          None of your restaurants is approved yet. You can manage a restaurant here as soon as it is approved.
        </p>
      ) : null}

      {restaurants.length === 0 ? (
        <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          You don&apos;t have any restaurants yet. Use Add restaurant to apply.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {restaurants.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              onOpen={() => {
                select(restaurant.id)
                router.push(DASHBOARD_HOME)
              }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
