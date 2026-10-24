import "server-only"

import { ServiceError } from "@/lib/data-source/errors"
import { resolveDataSourceMode } from "@/lib/data-source/mode"

/**
 * Per-restaurant settings every screen needs to format data: the IANA time
 * zone (PRD §3.2), currency and locale. In api mode these will come from the
 * restaurant's session and profile, which don't exist yet.
 *
 * Only B0+ code reads this. Orders and Menu still use their own hard-coded
 * Asia/Kolkata / ₹ formatting until B1 and B2 move them over.
 */
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

/** Throws ServiceError("not_configured") outside preview mode. */
export async function getRestaurantContext(): Promise<RestaurantContext> {
  if (resolveDataSourceMode(process.env.FOODI_RESTAURANT_DATA_SOURCE) === "preview") {
    return { ...PREVIEW_RESTAURANT }
  }
  throw new ServiceError("not_configured")
}
