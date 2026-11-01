import type { Metadata } from "next"
import { Suspense } from "react"

import { RestaurantList } from "@/features/restaurants/components/restaurant-list"

export const metadata: Metadata = { title: "My restaurants" }

export default function RestaurantsPage() {
  // useSearchParams (the post-login redirect flag) needs a Suspense boundary.
  return (
    <Suspense>
      <RestaurantList />
    </Suspense>
  )
}
