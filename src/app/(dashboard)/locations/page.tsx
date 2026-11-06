import type { Metadata } from "next"

import { LocationsPage } from "@/features/locations/components/locations-page"

export const metadata: Metadata = {
  title: "Locations & QR",
}

export default function LocationsRoutePage() {
  return <LocationsPage />
}
