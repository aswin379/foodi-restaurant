"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api-client"

import { getRestaurant, reopenRestaurant } from "../restaurant-service"
import type { RestaurantDetail } from "../types"
import { AddRestaurantForm } from "./add-restaurant-form"
import { RestaurantStatusBadge } from "./restaurant-status-badge"

const STATUS_HELP: Record<string, string> = {
  SUBMITTED: "Your application is waiting for review. You will be able to manage this restaurant once it is approved.",
  UNDER_REVIEW: "Our team is reviewing your application.",
  APPROVED: "This restaurant is approved. Pick it from the restaurant list to manage it.",
  SUSPENDED: "This restaurant is suspended. Contact support for details.",
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-44 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm wrap-break-word">{value || "–"}</dd>
    </div>
  )
}

/** Status, reviewer feedback and details of one application; lets the owner correct and resubmit when allowed. */
export function ApplicationDetail({ id }: { id: number }) {
  const [restaurant, setRestaurant] = useState<RestaurantDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reopening, setReopening] = useState(false)

  // Ignore a response that arrives after the owner moved to another application.
  useEffect(() => {
    let alive = true
    getRestaurant(id)
      .then((loaded) => {
        if (alive) setRestaurant(loaded)
      })
      .catch((e: unknown) => {
        if (alive) {
          setError(e instanceof ApiError && e.status === 404 ? "We couldn't find this restaurant." : "We couldn't load this application.")
        }
      })
    return () => {
      alive = false
    }
  }, [id])

  async function reopen() {
    if (reopening) return
    setReopening(true)
    try {
      setRestaurant(await reopenRestaurant(id))
      setError(null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.")
    } finally {
      setReopening(false)
    }
  }

  if (error && !restaurant) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-danger-line bg-danger-soft p-4 text-danger-foreground">
        <p className="flex items-center gap-2 text-sm font-medium">
          <AlertCircle aria-hidden className="size-4" /> {error}
        </p>
        <Button variant="outline" asChild>
          <Link href="/restaurants">Back to my restaurants</Link>
        </Button>
      </div>
    )
  }
  if (!restaurant) {
    return (
      <div role="status" className="grid min-h-40 place-items-center text-muted-foreground">
        <Loader2 aria-hidden className="size-6 animate-spin" />
        <span className="sr-only">Loading…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{restaurant.name}</h1>
        <RestaurantStatusBadge status={restaurant.status} />
      </div>

      {restaurant.reviewReason ? (
        <div role="note" className="rounded-2xl border bg-warning-soft p-4 text-sm text-warning-foreground">
          <p className="font-medium">Message from the review team</p>
          <p className="mt-1 whitespace-pre-line">{restaurant.reviewReason}</p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-danger-foreground">
          <AlertCircle aria-hidden className="size-4" /> {error}
        </p>
      ) : null}

      {restaurant.canEdit ? (
        <AddRestaurantForm existing={restaurant} onResubmitted={setRestaurant} />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {restaurant.canReopen
              ? "This application was not approved. You can correct it and send it for review again."
              : (STATUS_HELP[restaurant.status] ?? "")}
          </p>
          <dl className="flex max-w-2xl flex-col gap-3 rounded-2xl border bg-card p-4">
            <Row label="Address" value={restaurant.address} />
            <Row label="Zone" value={restaurant.zoneName ?? restaurant.requestedZoneName} />
            <Row
              label="Preparation time"
              value={
                restaurant.prepTime.min !== null
                  ? `${restaurant.prepTime.min}–${restaurant.prepTime.max} ${restaurant.prepTime.unit === "hours" ? "hours" : "minutes"}`
                  : null
              }
            />
            <Row label="ID document" value={restaurant.documents.idDocumentType} />
            <Row
              label="Documents on file"
              value={[restaurant.documents.hasIdDocument && "ID", restaurant.documents.hasTaxCertificate && "Tax certificate"]
                .filter(Boolean)
                .join(", ")}
            />
            <Row label="Submitted" value={restaurant.submittedAt ? new Date(restaurant.submittedAt).toLocaleString() : null} />
          </dl>
          <div className="flex gap-3">
            {restaurant.canReopen ? (
              <Button onClick={() => void reopen()} disabled={reopening}>
                {reopening ? <Loader2 aria-hidden className="animate-spin" /> : null}
                Edit and resubmit
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/restaurants">Back to my restaurants</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
