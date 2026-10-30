import "server-only"

import { getApiTransport } from "@/lib/api/transport"
import { isServiceError } from "@/lib/data-source/errors"
import { getRestaurantContext } from "@/lib/restaurant/context"

import type { BillingAdapter } from "./adapter"
import { planFromApi } from "./api-mapping"

/**
 * Integration point for the Foodi plan and billing API.
 *
 * No seller API exists yet, so the transport reports `not_configured` for
 * every call and the page shows "Billing isn't connected yet". The path and
 * payload here are the PROPOSED contract in docs/billing-ui.md: NOT
 * IMPLEMENTED and not agreed with the backend team. Never fall back to preview
 * data. The restaurant comes from the seller session on the server; no
 * restaurant ID is ever taken from the URL or sent by the page, and the
 * backend must enforce authorization and ownership.
 */
const PROPOSED_PATHS = {
  plan: "/seller/plan",
}

export const apiBillingAdapter: BillingAdapter = {
  context: getRestaurantContext,

  async plan() {
    const { currency } = await getRestaurantContext()
    try {
      return planFromApi(await getApiTransport().request<unknown>({ method: "GET", path: PROPOSED_PATHS.plan }), { currency })
    } catch (error) {
      // A 404 means this restaurant has no plan: the "no plan" state, not an error.
      if (isServiceError(error) && error.kind === "not_found") return null
      throw error
    }
  },
}
