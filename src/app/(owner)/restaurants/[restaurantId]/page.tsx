import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ApplicationDetail } from "@/features/restaurants/components/application-detail"

// The (owner) layout already marks this whole group noindex; nothing here is public.
export const metadata: Metadata = { title: "Restaurant application" }

export default function RestaurantApplicationPage({ params }: PageProps<"/restaurants/[restaurantId]">) {
  return (
    <Suspense>
      <ApplicationView params={params} />
    </Suspense>
  )
}

async function ApplicationView({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const id = Number(restaurantId)
  // The server still checks that this owner owns the restaurant; this only rejects ids that cannot exist.
  if (!Number.isInteger(id) || id <= 0) notFound()
  return <ApplicationDetail id={id} />
}
