"use client"

import { useId, useState } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

import { saveSettings } from "../profile-service"
import type { RestaurantProfile, RestaurantSettings, SettingsChanges, SettingsGates } from "../types"
import { SectionForm, selectClass, toNumber } from "./section-form"

type Toggle = keyof {
  [K in keyof RestaurantSettings as RestaurantSettings[K] extends boolean ? K : never]: true
}

// `gate` is the global admin switch that can block turning the option on.
const TOGGLES: Array<{ key: Toggle; label: string; gate?: keyof SettingsGates }> = [
  { key: "homeDelivery", label: "Home delivery", gate: "homeDelivery" },
  { key: "takeAway", label: "Takeaway", gate: "takeAway" },
  { key: "dineIn", label: "Dine-in", gate: "dineIn" },
  { key: "roomService", label: "Room service" },
  { key: "theaterService", label: "Theater service" },
  { key: "instantOrder", label: "Instant orders", gate: "instantOrder" },
  { key: "scheduleOrder", label: "Scheduled orders", gate: "scheduleOrder" },
  { key: "selfDeliverySystem", label: "Self delivery" },
  { key: "customDateOrder", label: "Orders for a chosen date" },
  { key: "orderSubscriptionActive", label: "Repeat orders", gate: "orderSubscription" },
  { key: "canEditOrder", label: "Allow editing orders", gate: "canEditOrder" },
  { key: "foodSection", label: "Show food section" },
  { key: "reviewsSection", label: "Show reviews" },
  { key: "posSystem", label: "POS system" },
  { key: "halalTag", label: "Halal tag" },
]

/** The same options as the admin Settings tab. Only changed values are sent; the API enforces the rules. */
export function OptionsForm({
  profile,
  onSaved,
}: {
  profile: RestaurantProfile
  onSaved: (profile: RestaurantProfile) => void
}) {
  const id = useId()
  const before = profile.settings
  const [values, setValues] = useState<RestaurantSettings>({ ...before })

  const set = <K extends keyof RestaurantSettings>(key: K, value: RestaurantSettings[K]) =>
    setValues((current) => ({ ...current, [key]: value }))

  async function save() {
    if (!(values.minimumOrder >= 0)) throw new Error("Enter the minimum order amount (0 or more).")
    if (!Number.isInteger(values.dineInMinTime) || values.dineInMinTime < 0) {
      throw new Error("Enter the dine-in minimum time as a whole number.")
    }
    if (!Number.isInteger(values.customerOrderDays) || values.customerOrderDays < 0) {
      throw new Error("Enter the order window in whole days.")
    }
    const changes: SettingsChanges = {}
    for (const key of Object.keys(values) as Array<keyof RestaurantSettings>) {
      if (values[key] !== before[key]) Object.assign(changes, { [key]: values[key] })
    }
    if (Object.keys(changes).length === 0) throw new Error("Nothing has changed.")
    onSaved(await saveSettings(changes))
  }

  return (
    <SectionForm title="Order options" description="Which kinds of orders the restaurant accepts." onSave={save}>
      <div className="grid gap-3 sm:grid-cols-2">
        {TOGGLES.map(({ key, label, gate }) => {
          const blocked = gate !== undefined && !profile.gates[gate] && !values[key]
          return (
            <label key={key} className="flex items-center gap-3 text-sm">
              <Switch
                checked={values[key]}
                disabled={blocked}
                onCheckedChange={(checked) => set(key, checked)}
                aria-label={label}
              />
              <span>
                {label}
                {blocked ? <span className="block text-xs text-muted-foreground">Turned off by Foodi</span> : null}
              </span>
            </label>
          )
        })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${id}-menu`}>Menu type</Label>
          <select
            id={`${id}-menu`}
            value={values.menuType}
            onChange={(event) => set("menuType", event.target.value as RestaurantSettings["menuType"])}
            className={selectClass}
          >
            <option value="both">Veg and non-veg</option>
            <option value="veg">Veg only</option>
            <option value="non_veg">Non-veg only</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-minimum`}>Minimum order amount</Label>
          <Input
            id={`${id}-minimum`}
            inputMode="decimal"
            value={Number.isNaN(values.minimumOrder) ? "" : String(values.minimumOrder)}
            onChange={(event) => set("minimumOrder", toNumber(event.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-dine`}>Dine-in minimum booking time</Label>
          <div className="flex gap-2">
            <Input
              id={`${id}-dine`}
              inputMode="numeric"
              value={Number.isNaN(values.dineInMinTime) ? "" : String(values.dineInMinTime)}
              onChange={(event) => set("dineInMinTime", toNumber(event.target.value))}
            />
            <select
              aria-label="Dine-in time unit"
              value={values.dineInMinTimeUnit}
              onChange={(event) => set("dineInMinTimeUnit", event.target.value as RestaurantSettings["dineInMinTimeUnit"])}
              className={selectClass}
            >
              <option value="min">Minutes</option>
              <option value="hour">Hours</option>
              <option value="day">Days</option>
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-days`}>Order window (days ahead)</Label>
          <Input
            id={`${id}-days`}
            inputMode="numeric"
            value={Number.isNaN(values.customerOrderDays) ? "" : String(values.customerOrderDays)}
            onChange={(event) => set("customerOrderDays", toNumber(event.target.value))}
          />
        </div>
      </div>
    </SectionForm>
  )
}
