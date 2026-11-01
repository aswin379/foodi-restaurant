"use client"

import { useEffect, useRef, useState } from "react"
import { LocateFixed } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { hasMapsKey, loadGoogleMaps } from "@/lib/google-maps"

export type PickedLocation = {
  latitude: number
  longitude: number
  /** Street address of the pin, when Google could give one. */
  address?: string
}

const WORLD = { lat: 20, lng: 0 }

const valid = (value: string) => value.trim() !== "" && Number.isFinite(Number(value))

/**
 * Map to set the restaurant's exact location: search a place, click the map, drag the pin or use the current
 * position. The parent owns the coordinates. Without a Maps key it renders nothing and the typed coordinates remain.
 */
export function LocationPicker({
  latitude,
  longitude,
  onPick,
}: {
  latitude: string
  longitude: string
  onPick: (location: PickedLocation) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const map = useRef<google.maps.Map | null>(null)
  const marker = useRef<google.maps.Marker | null>(null)
  const geocoder = useRef<google.maps.Geocoder | null>(null)
  const latest = useRef({ latitude, longitude, onPick })
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    latest.current = { latitude, longitude, onPick }
  })

  /** Put the pin on a point and report it, with the address Google knows for it. */
  const place = (point: google.maps.LatLngLiteral, address?: string) => {
    marker.current?.setPosition(point)
    marker.current?.setMap(map.current)
    if (address !== undefined) {
      latest.current.onPick({ latitude: point.lat, longitude: point.lng, address })
      return
    }
    // Report the coordinates at once; the address follows if the lookup works.
    latest.current.onPick({ latitude: point.lat, longitude: point.lng })
    geocoder.current?.geocode({ location: point }, (results, status) => {
      const found = status === "OK" ? results?.[0]?.formatted_address : undefined
      if (found) latest.current.onPick({ latitude: point.lat, longitude: point.lng, address: found })
    })
  }

  // Create the map once.
  useEffect(() => {
    if (!hasMapsKey) return
    let cancelled = false
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !container.current) return
        const { latitude: lat, longitude: lng } = latest.current
        const start = valid(lat) && valid(lng) ? { lat: Number(lat), lng: Number(lng) } : null
        const instance = new google.maps.Map(container.current, {
          center: start ?? WORLD,
          zoom: start ? 16 : 2,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        })
        const pin = new google.maps.Marker({ map: start ? instance : null, position: start ?? WORLD, draggable: true })
        pin.addListener("dragend", () => {
          const position = pin.getPosition()
          if (position) place({ lat: position.lat(), lng: position.lng() })
        })
        instance.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (event.latLng) place({ lat: event.latLng.lat(), lng: event.latLng.lng() })
        })
        geocoder.current = new google.maps.Geocoder()
        map.current = instance
        marker.current = pin
        setReady(true)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Google Maps could not be loaded")
      })
    return () => {
      cancelled = true
      marker.current?.setMap(null)
      marker.current = null
      map.current = null
    }
  }, [])

  // Place search: moves the pin to the chosen place.
  useEffect(() => {
    const instance = map.current
    const input = searchInput.current
    if (!ready || !instance || !input || !google.maps.places) return
    const autocomplete = new google.maps.places.Autocomplete(input, { fields: ["geometry", "formatted_address"] })
    const listener = autocomplete.addListener("place_changed", () => {
      const result = autocomplete.getPlace()
      const location = result.geometry?.location
      if (!location) return
      const point = { lat: location.lat(), lng: location.lng() }
      instance.setCenter(point)
      instance.setZoom(17)
      place(point, result.formatted_address)
    })
    return () => listener.remove()
  }, [ready])

  // Typed coordinates move the pin too.
  useEffect(() => {
    const instance = map.current
    const pin = marker.current
    if (!ready || !instance || !pin || !valid(latitude) || !valid(longitude)) return
    const point = { lat: Number(latitude), lng: Number(longitude) }
    const current = pin.getPosition()
    if (pin.getMap() && current && current.lat() === point.lat && current.lng() === point.lng) return
    pin.setPosition(point)
    pin.setMap(instance)
    instance.panTo(point)
  }, [latitude, longitude, ready])

  function useMyLocation() {
    if (!navigator.geolocation) return setError("Your browser cannot share its location.")
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude }
        map.current?.setCenter(point)
        map.current?.setZoom(17)
        setError(null)
        place(point)
      },
      () => setError("Location access was denied. Search a place or click the map instead.")
    )
  }

  if (!hasMapsKey) return null

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="rounded-lg border border-danger-line bg-danger-soft p-3 text-sm text-danger-foreground">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          ref={searchInput}
          type="text"
          placeholder="Search a place or address"
          aria-label="Search a place"
          disabled={!ready}
          // Enter picks a suggestion; it must not submit the form.
          onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
          className="min-w-0 flex-1"
        />
        <Button type="button" variant="outline" disabled={!ready} onClick={useMyLocation}>
          <LocateFixed aria-hidden /> My location
        </Button>
      </div>
      <div ref={container} className="h-64 w-full rounded-lg border sm:h-72" />
      <p className="text-xs text-muted-foreground">Click the map or drag the pin to set the exact location.</p>
    </div>
  )
}
