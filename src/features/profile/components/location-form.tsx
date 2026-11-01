"use client"

import { useId, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import { resolveLocation, saveAddress } from "../profile-service"
import type { RestaurantProfile } from "../types"
import { SectionForm, toNumber } from "./section-form"

/** Address and map pin. The zone follows the pin, so it is shown but never chosen. */
export function LocationForm({
  profile,
  onSaved,
}: {
  profile: RestaurantProfile
  onSaved: (profile: RestaurantProfile) => void
}) {
  const id = useId()
  const [address, setAddress] = useState(profile.address.address ?? "")
  const [latitude, setLatitude] = useState(String(profile.address.latitude ?? ""))
  const [longitude, setLongitude] = useState(String(profile.address.longitude ?? ""))
  const [zone, setZone] = useState<{ text: string; ok: boolean } | null>(null)

  function pin() {
    const lat = toNumber(latitude)
    const lng = toNumber(longitude)
    if (!(lat >= -90 && lat <= 90)) throw new Error("Latitude must be between -90 and 90.")
    if (!(lng >= -180 && lng <= 180)) throw new Error("Longitude must be between -180 and 180.")
    return { latitude: lat, longitude: lng }
  }

  async function checkZone() {
    try {
      const { latitude: lat, longitude: lng } = pin()
      const found = await resolveLocation(lat, lng)
      setZone({ text: `This pin is in ${found.zoneName}.`, ok: true })
    } catch (e) {
      setZone({ text: e instanceof Error ? e.message : "Could not check the zone.", ok: false })
    }
  }

  async function save() {
    if (!address.trim()) throw new Error("Enter the address.")
    onSaved(await saveAddress({ address: address.trim(), ...pin() }))
    // The saved zone is shown again instead of the earlier check.
    setZone(null)
  }

  return (
    <SectionForm title="Address and location" description="Where customers find the restaurant." onSave={save}>
      <div className="space-y-2">
        <Label htmlFor={`${id}-address`}>Address</Label>
        <Textarea
          id={`${id}-address`}
          value={address}
          maxLength={1000}
          rows={3}
          onChange={(event) => setAddress(event.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${id}-lat`}>Latitude</Label>
          <Input id={`${id}-lat`} inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-lng`}>Longitude</Label>
          <Input id={`${id}-lng`} inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Button type="button" variant="outline" size="sm" onClick={() => void checkZone()}>
          Check zone
        </Button>
        <span aria-live="polite" className={zone && !zone.ok ? "text-danger-foreground" : "text-muted-foreground"}>
          {zone ? zone.text : `Current zone: ${profile.address.zone ?? "none"}`}
        </span>
      </div>
    </SectionForm>
  )
}
