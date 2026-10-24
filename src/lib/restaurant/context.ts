import "server-only"

import { ServiceError } from "@/lib/data-source/errors"
import { resolveDataSourceMode } from "@/lib/data-source/mode"

/**
 * Per-restaurant settings every screen needs to format data: the IANA time
 * zone (PRD §3.2), currency and locale. In api mode these will come from the
 * restaurant's session and profile, which don't exist yet.
 *
 * Orders, Menu and Hours read the zone and locale from here (through their
 * own data sources) rather than hard-coding them.
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
