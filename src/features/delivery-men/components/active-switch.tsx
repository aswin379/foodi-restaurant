"use client"

import { Switch } from "@/components/ui/switch"

import type { DeliveryBoy } from "../types"

/**
 * The seller's Active / Inactive switch for one delivery boy: green when active, red when inactive. A delivery boy
 * that Foodi suspended or rejected cannot be switched by the seller, so the switch is locked and says why.
 */
export function ActiveSwitch({
  rider,
  busy = false,
  onToggle,
}: {
  rider: DeliveryBoy
  busy?: boolean
  onToggle: (next: "active" | "inactive") => void
}) {
  const active = rider.accountStatus === "active"
  const lockedReason =
    rider.accountStatus === "suspended" ? "Suspended by Foodi" : rider.applicationStatus === "denied" ? "Rejected by Foodi" : null
  const name = [rider.firstName, rider.lastName].filter(Boolean).join(" ")

  return (
    // Stops the click reaching a clickable table row, which would open the details panel.
    <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
      <Switch
        checked={active}
        disabled={busy || lockedReason !== null}
        onCheckedChange={(checked) => onToggle(checked ? "active" : "inactive")}
        aria-label={`Active: ${name}`}
        className="data-[state=checked]:bg-success data-[state=unchecked]:bg-danger"
      />
      {lockedReason ? (
        <span className="text-sm font-medium text-danger-foreground">{lockedReason}</span>
      ) : (
        <span className={active ? "text-sm font-medium text-success-foreground" : "text-sm font-medium text-danger-foreground"}>
          {active ? "Active" : "Inactive"}
        </span>
      )}
    </div>
  )
}
