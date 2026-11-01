"use client"

import { useId, useState } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

import { saveDelivery } from "../profile-service"
import type { PrepUnit, RestaurantProfile } from "../types"
import { SectionForm, selectClass, toNumber } from "./section-form"

type Mode = "SELF" | "FOODI" | "PICKUP"

const MODES: Array<{ value: Mode; label: string }> = [
  { value: "SELF", label: "We deliver ourselves" },
  { value: "FOODI", label: "Foodi delivery partners" },
  { value: "PICKUP", label: "Pickup only" },
]

/** Delivery mode, radius, fees, cash on delivery and the preparation time. Same rules as the admin panel. */
export function DeliveryForm({
  profile,
  onSaved,
}: {
  profile: RestaurantProfile
  onSaved: (profile: RestaurantProfile) => void
}) {
  const id = useId()
  const { delivery, prepTime } = profile
  const [mode, setMode] = useState<Mode | "">(delivery.mode ?? "")
  const [radius, setRadius] = useState(String(delivery.radiusKm ?? ""))
  const [fee, setFee] = useState(String(delivery.fee ?? ""))
  const [threshold, setThreshold] = useState(String(delivery.freeDeliveryThreshold ?? ""))
  const [cod, setCod] = useState(delivery.codEnabled)
  const [min, setMin] = useState(String(prepTime.min ?? ""))
  const [max, setMax] = useState(String(prepTime.max ?? ""))
  const [unit, setUnit] = useState<PrepUnit>(prepTime.unit)

  async function save() {
    if (mode === "") throw new Error("Choose how orders are delivered.")
    const deliveryRadiusKm = toNumber(radius)
    const deliveryFee = toNumber(fee)
    const freeDeliveryThreshold = toNumber(threshold)
    const prepTimeMin = toNumber(min)
    const prepTimeMax = toNumber(max)
    if (!(deliveryRadiusKm > 0)) throw new Error("Enter a delivery radius greater than 0.")
    if (!(deliveryFee >= 0)) throw new Error("Enter the delivery fee (0 or more).")
    if (threshold.trim() !== "" && !(freeDeliveryThreshold >= 0)) throw new Error("Enter the free delivery amount (0 or more).")
    if (!Number.isInteger(prepTimeMin) || !Number.isInteger(prepTimeMax) || prepTimeMin < 1 || prepTimeMax < 1) {
      throw new Error("Enter the preparation time as whole numbers.")
    }
    if (prepTimeMax <= prepTimeMin) throw new Error("Maximum time must be greater than minimum time.")
    if (unit === "min" && prepTimeMin < 10) throw new Error("Minimum time must be at least 10 minutes.")
    onSaved(
      await saveDelivery({
        deliveryMode: mode,
        deliveryRadiusKm,
        deliveryFee,
        ...(threshold.trim() === "" ? {} : { freeDeliveryThreshold }),
        codEnabled: cod,
        prepTimeUnit: unit,
        prepTimeMin,
        prepTimeMax,
      })
    )
  }

  return (
    <SectionForm title="Delivery and timing" description="How orders reach customers and how long they take." onSave={save}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${id}-mode`}>Delivery mode</Label>
          <select id={`${id}-mode`} value={mode} onChange={(event) => setMode(event.target.value as Mode | "")} className={selectClass}>
            <option value="">Choose…</option>
            {MODES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-radius`}>Delivery radius (km)</Label>
          <Input id={`${id}-radius`} inputMode="decimal" value={radius} onChange={(event) => setRadius(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-fee`}>Delivery fee</Label>
          <Input id={`${id}-fee`} inputMode="decimal" value={fee} onChange={(event) => setFee(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-threshold`}>Free delivery above (optional)</Label>
          <Input id={`${id}-threshold`} inputMode="decimal" value={threshold} onChange={(event) => setThreshold(event.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-3 text-sm">
        <Switch checked={cod} onCheckedChange={setCod} aria-label="Cash on delivery" />
        Accept cash on delivery
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${id}-min`}>Minimum prep time</Label>
          <Input id={`${id}-min`} inputMode="numeric" value={min} onChange={(event) => setMin(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-max`}>Maximum prep time</Label>
          <Input id={`${id}-max`} inputMode="numeric" value={max} onChange={(event) => setMax(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-unit`}>Unit</Label>
          <select id={`${id}-unit`} value={unit} onChange={(event) => setUnit(event.target.value as PrepUnit)} className={selectClass}>
            <option value="min">Minutes</option>
            <option value="hours">Hours</option>
          </select>
        </div>
      </div>
    </SectionForm>
  )
}
