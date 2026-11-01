/** Browser key for the Maps JavaScript API. Public by design: restrict it by HTTP referrer in Google Cloud. */
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

export const hasMapsKey = Boolean(GOOGLE_MAPS_API_KEY)

let loader: Promise<void> | undefined

/** Loads the Maps JavaScript API (with Places) once; later calls reuse the same promise. */
export function loadGoogleMaps(): Promise<void> {
  if (loader) return loader
  loader = new Promise<void>((resolve, reject) => {
    if (typeof google !== "undefined" && google.maps) {
      resolve()
      return
    }
    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY ?? "")}&libraries=places&v=weekly`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loader = undefined
      reject(new Error("Google Maps could not be loaded"))
    }
    document.head.append(script)
  })
  return loader
}
