"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

import { notify } from "@/components/shared/notifications"

import { createDeliveryBoy, getDeliveryLookups, listDeliveryBoys } from "../delivery-men-service"
import type { DeliveryLookups } from "../types"
import { RiderForm, toCreateForm } from "./rider-form"

/**
 * Shown inside the delivery form when "We deliver ourselves" is chosen. Until one delivery boy is registered the
 * registration form is shown here; the parent blocks saving until `onCountChange` reports at least one.
 */
export function RiderRegistration({ onCountChange }: { onCountChange: (count: number) => void }) {
  const [lookups, setLookups] = useState<DeliveryLookups | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [l, page] = await Promise.all([getDeliveryLookups(), listDeliveryBoys()])
      setLookups(l)
      setCount(page.total)
      onCountChange(page.total)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load delivery boys.")
    }
  }, [onCountChange])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
    void load()
  }, [load])

  if (loadError) return <p role="alert" className="text-sm text-danger-foreground">{loadError}</p>
  if (!lookups || count === null) return <p className="text-sm text-muted-foreground">Loading delivery boys…</p>

  if (count > 0) {
    return (
      <div className="rounded-2xl bg-card p-5 text-sm shadow-[0_8px_30px_rgb(31_26_23/6%)]">
        {count} delivery {count === 1 ? "boy" : "boys"} registered.{" "}
        <Link href="/delivery-boys" className="font-medium text-primary-text underline underline-offset-4">
          Manage delivery boys
        </Link>
      </div>
    )
  }

  if (lookups.zone === null) {
    return (
      <p role="alert" className="rounded-2xl bg-card p-5 text-sm text-danger-foreground">
        Set your restaurant location first so it is placed in a delivery zone, then register your delivery boy.
      </p>
    )
  }

  return (
    <section aria-label="Register a delivery boy" className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-[0_8px_30px_rgb(31_26_23/6%)]">
      <div>
        <h2 className="text-lg font-semibold">Register your delivery boy</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Required for Self Delivery. The application is reviewed by Foodi; the delivery boy can sign in once approved.
        </p>
      </div>
      <RiderForm
        lookups={lookups}
        submitLabel="Register delivery boy"
        onSubmit={async (values, files) => {
          await createDeliveryBoy(toCreateForm(values, files))
          notify({ kind: "success", title: "Delivery boy registered", description: "Awaiting admin approval", preview: false })
          await load()
        }}
      />
    </section>
  )
}
