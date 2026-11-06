"use client"

import { useEffect, useSyncExternalStore } from "react"

import { getDeliveryLookups } from "./delivery-men-service"

// Whether the active restaurant delivers its own orders, from the delivery lookups (readable by anyone with the
// delivery permission). It decides if the "Delivery boys" sub-link of Delivery is shown; the API enforces access regardless.
type State = boolean | null

let current: State = null
const listeners = new Set<() => void>()

function publish(next: State) {
  current = next
  listeners.forEach((listener) => listener())
}

export async function refreshOwnDelivery(): Promise<void> {
  try {
    publish((await getDeliveryLookups()).deliveryMode === "SELF")
  } catch {
    publish(false)
  }
}

/** Call after the delivery mode is saved so the sidebar updates without a reload. */
export function setUsesOwnDelivery(value: boolean) {
  publish(value)
}

export function useUsesOwnDelivery(enabled: boolean): boolean {
  const value = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
    () => null
  )
  useEffect(() => {
    if (enabled && current === null) void refreshOwnDelivery()
  }, [enabled])
  return value === true
}
