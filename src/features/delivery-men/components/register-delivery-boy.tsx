"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { notify } from "@/components/shared/notifications"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

import { createDeliveryBoy, getDeliveryLookups } from "../delivery-men-service"
import type { DeliveryLookups } from "../types"
import { RiderForm, toCreateForm } from "./rider-form"

/** The delivery boy registration page (Delivery → Delivery boys → Add delivery boy). */
export function RegisterDeliveryBoy() {
  const router = useRouter()
  const [lookups, setLookups] = useState<DeliveryLookups | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getDeliveryLookups()
      .then((l) => alive && setLookups(l))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Could not load the registration form."))
    return () => {
      alive = false
    }
  }, [])

  const notSelf = lookups !== null && lookups.deliveryMode !== "SELF"
  const noZone = lookups !== null && !notSelf && lookups.zone === null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Add delivery boy"
        description="The delivery boy is active as soon as you register them. You can switch them off any time."
        actions={
          <Button asChild variant="outline">
            <Link href="/delivery-boys">
              <ArrowLeft aria-hidden /> Back to delivery boys
            </Link>
          </Button>
        }
      />
      {error ? (
        <p role="alert" className="text-sm text-danger-foreground">
          {error}
        </p>
      ) : null}
      {!lookups && !error ? <Skeleton className="h-96 w-full rounded-2xl" /> : null}
      {notSelf ? (
        <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground">
          Delivery boys are available when the restaurant delivers its own orders. Choose &ldquo;We deliver ourselves&rdquo; in
          Restaurant profile &rarr; Delivery and timing.
        </p>
      ) : null}
      {noZone ? (
        <p role="alert" className="rounded-2xl bg-card p-5 text-sm text-danger-foreground">
          Set your restaurant location in Restaurant profile first, so it is placed in a delivery zone. Then you can add delivery boys.
        </p>
      ) : null}
      {lookups && !notSelf && !noZone ? (
        <section aria-label="Register a delivery boy" className="rounded-2xl bg-card p-5 shadow-[0_8px_30px_rgb(31_26_23/6%)] sm:p-6">
          <RiderForm
            lookups={lookups}
            submitLabel="Register delivery boy"
            onSubmit={async (values, files) => {
              await createDeliveryBoy(toCreateForm(values, files))
              notify({ kind: "success", title: "Delivery boy registered", description: "Active now. You can switch them off from the list.", preview: false })
              router.push("/delivery-boys")
            }}
          />
        </section>
      ) : null}
    </div>
  )
}
