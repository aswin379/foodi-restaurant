"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { useRestaurants } from "./restaurant-context"

/**
 * Dashboard pages need an approved active restaurant; otherwise the owner is sent to My Restaurants. Keyed by
 * the restaurant id so switching restaurants remounts the page and never shows the previous restaurant's data.
 * A convenience only: the API checks the owner's access to the restaurant on every request.
 */
export function RequireRestaurant({ children }: { children: React.ReactNode }) {
  const { status, active } = useRestaurants()
  const router = useRouter()

  useEffect(() => {
    if (status !== "loading" && !active) router.replace("/restaurants")
  }, [status, active, router])

  if (!active) {
    return (
      <div role="status" className="grid min-h-60 place-items-center text-muted-foreground">
        <Loader2 aria-hidden className="size-6 animate-spin" />
        <span className="sr-only">Loading…</span>
      </div>
    )
  }
  return <div key={active.id}>{children}</div>
}
