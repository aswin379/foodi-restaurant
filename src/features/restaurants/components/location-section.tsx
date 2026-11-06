"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, MapPin } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ApiError } from "@/api-client"
import { cn } from "@/lib/utils"

import { resolveLocation } from "../restaurant-service"
import type { Option } from "../types"
import { OTHER_ZONE, zoneNote, type ZoneCheck } from "../zone-rules"
import { Field, ariaFor } from "./form-field"
import { LocationPicker, type PickedLocation } from "./location-picker"

export type LocationValues = {
  zoneId: string
  requestedZoneName: string
  address: string
  latitude: string
  longitude: string
}

/**
 * Zone, map, address and coordinates of a restaurant. The pin decides the zone: it is looked up on the server
 * (the same check that runs on submit) and fills an empty zone choice. "Other" requests a new zone for a reviewer.
 * The parent owns the values, so the new-restaurant and the correction forms share this one section.
 */
export function LocationSection({
  idPrefix,
  zones,
  values,
  onChange,
  zoneCheck,
  onZoneCheck,
  errors,
  zonePlaceholder = "Select a zone",
  zoneLabel = "Zone",
  zoneRequired = false,
}: {
  idPrefix: string
  zones: Option[]
  values: LocationValues
  onChange: (patch: Partial<LocationValues>) => void
  zoneCheck: ZoneCheck
  onZoneCheck: (check: ZoneCheck) => void
  errors: Record<string, string>
  zonePlaceholder?: string
  zoneLabel?: string
  zoneRequired?: boolean
}) {
  const [looking, setLooking] = useState(false)
  const [lookupFailed, setLookupFailed] = useState(false)
  const lastLookup = useRef("")
  const latest = useRef({ values, onChange, onZoneCheck })
  useEffect(() => {
    latest.current = { values, onChange, onZoneCheck }
  })

  const key = (name: string) => `${idPrefix}-${name}`
  const other = values.zoneId === OTHER_ZONE

  /** Ask the server which zone a point is in; an empty zone choice takes the answer. */
  async function lookUp(latitude: number, longitude: number) {
    lastLookup.current = `${latitude},${longitude}`
    setLooking(true)
    setLookupFailed(false)
    try {
      const result = await resolveLocation(latitude, longitude)
      latest.current.onZoneCheck({ id: result.zoneId, name: result.zoneName })
      if (latest.current.values.zoneId === "") latest.current.onChange({ zoneId: String(result.zoneId) })
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) latest.current.onZoneCheck("outside")
      else {
        latest.current.onZoneCheck(null)
        setLookupFailed(true)
      }
    } finally {
      setLooking(false)
    }
  }

  function onPick(location: PickedLocation) {
    const latitude = Number(location.latitude.toFixed(7))
    const longitude = Number(location.longitude.toFixed(7))
    const current = latest.current.values
    onChange({
      latitude: String(latitude),
      longitude: String(longitude),
      ...(current.address.trim() === "" && location.address ? { address: location.address } : {}),
    })
    if (lastLookup.current !== `${latitude},${longitude}`) void lookUp(latitude, longitude)
  }

  const lat = Number(values.latitude)
  const lng = Number(values.longitude)
  const canCheck = values.latitude !== "" && values.longitude !== "" && Number.isFinite(lat) && Number.isFinite(lng)
  const note = zoneNote(values.zoneId, zoneCheck)

  return (
    <div className="flex flex-col gap-5">
      <Field htmlId={key("zoneId")} label={zoneLabel} error={errors["zoneId"]} required={zoneRequired}>
        <Select value={values.zoneId} onValueChange={(zoneId) => onChange({ zoneId })}>
          <SelectTrigger {...ariaFor(key("zoneId"), errors["zoneId"])}>
            <SelectValue placeholder={zonePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {zones.map((z) => (
              <SelectItem key={z.id} value={String(z.id)}>
                {z.name}
              </SelectItem>
            ))}
            <SelectItem value={OTHER_ZONE}>Other (request a new zone)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {other ? "A reviewer will create the zone or assign an existing one before approval." : "The pin below must be inside this zone."}
        </p>
      </Field>

      {other ? (
        <Field htmlId={key("requestedZoneName")} label="Zone you need" error={errors["requestedZoneName"]} required>
          <Input
            {...ariaFor(key("requestedZoneName"), errors["requestedZoneName"])}
            value={values.requestedZoneName}
            onChange={(e) => onChange({ requestedZoneName: e.target.value })}
            maxLength={100}
          />
        </Field>
      ) : null}

      <div className="flex flex-col gap-2">
        <LocationPicker latitude={values.latitude} longitude={values.longitude} onPick={onPick} />
        <p className="text-xs text-muted-foreground">
          The pin you set decides your restaurant&apos;s zone. If it falls outside every zone, choose &quot;Other&quot; to request a new one.
        </p>
      </div>

      <Field htmlId={key("address")} label="Restaurant address" error={errors["address"]} required>
        <Input
          {...ariaFor(key("address"), errors["address"])}
          placeholder="Restaurant address"
          autoComplete="street-address"
          value={values.address}
          onChange={(e) => onChange({ address: e.target.value })}
          maxLength={1000}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlId={key("latitude")} label="Latitude" error={errors["latitude"]} required>
          <Input
            {...ariaFor(key("latitude"), errors["latitude"])}
            inputMode="decimal"
            placeholder="e.g. 12.9716"
            value={values.latitude}
            onChange={(e) => onChange({ latitude: e.target.value })}
          />
        </Field>
        <Field htmlId={key("longitude")} label="Longitude" error={errors["longitude"]} required>
          <Input
            {...ariaFor(key("longitude"), errors["longitude"])}
            inputMode="decimal"
            placeholder="e.g. 77.5946"
            value={values.longitude}
            onChange={(e) => onChange({ longitude: e.target.value })}
          />
        </Field>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <Button type="button" variant="outline" size="sm" disabled={looking || !canCheck} onClick={() => void lookUp(lat, lng)}>
          {looking ? <Loader2 aria-hidden className="animate-spin" /> : <MapPin aria-hidden />} Check zone
        </Button>
        <p role="status" className={cn("text-sm", note.warn ? "text-warning-foreground" : "text-muted-foreground")}>
          {lookupFailed ? "The zone could not be checked right now. It is checked again when you submit." : note.text}
        </p>
      </div>
    </div>
  )
}
