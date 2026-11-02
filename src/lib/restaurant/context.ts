import "server-only"

import { cookies } from "next/headers"
import { ServiceError } from "@/lib/data-source/errors"
import { resolveDataSourceMode } from "@/lib/data-source/mode"

export type RestaurantContext = {
  restaurantId: string
  /** Null until a real profile is available. */
  name: string | null
  timeZone: string
  currency: string
  locale: string
}

export const PREVIEW_RESTAURANT: RestaurantContext = {
  restaurantId: "prv-restaurant",
  name: "Preview restaurant",
  timeZone: "Asia/Kolkata",
  currency: "INR",
  locale: "en-IN",
}

/** Returns the active restaurant context. */
export async function getRestaurantContext(): Promise<RestaurantContext> {
  if (resolveDataSourceMode(process.env.FOODI_RESTAURANT_DATA_SOURCE) === "preview") {
    return { ...PREVIEW_RESTAURANT }
  }

  if (process.env.FOODI_API_ENABLED === "true") {
    let restaurantId = PREVIEW_RESTAURANT.restaurantId
    try {
      const cookieStore = await cookies()
      const id = cookieStore.get("foodi_seller_restaurant_id")?.value
      if (id) restaurantId = id
    } catch {
      // Running outside request context
    }
    return {
      ...PREVIEW_RESTAURANT,
      restaurantId,
    }
  }

  throw new ServiceError("not_configured")
}
