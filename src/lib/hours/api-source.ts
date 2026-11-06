import "server-only"

import { getApiTransport, type ApiMethod } from "@/lib/api/transport"
import { isServiceError, ServiceError } from "@/lib/data-source/errors"
import { getRestaurantContext } from "@/lib/restaurant/context"

import type { HoursAdapter } from "./adapter"
import { ORDER_TYPES, type OrderType } from "@/lib/domain/order-types"
import { isRecord } from "@/lib/api/guards"

import {
  apiPauseScope,
  commandBodyToApi,
  DELIVERY_MODES_API,
  commandResultFromApi,
  pauseFromApi,
  specialDateFromApi,
  statusFromApi,
  weeklyHoursFromApi,
} from "./api-mapping"
import type { HoursCommand } from "./commands"

/**
 * Integration point for the Foodi hours API.
 *
 * No seller API exists yet, so the transport reports `not_configured` for
 * every call and the pages show "Hours aren't connected yet". Every path,
 * header and payload here is the PROPOSED contract in docs/hours-ui.md,
 * awaiting backend agreement. Never fall back to preview data.
 */
const PROPOSED_PATHS = {
  hours: "/seller/hours",
  specialDates: "/seller/hours/special-dates",
  specialDate: (id: string) => `/seller/hours/special-dates/${encodeURIComponent(id)}`,
  pause: "/seller/pause",
  status: "/seller/availability/status",
}

function request(command: HoursCommand): { method: ApiMethod; path: string; ifMatch?: string } {
  switch (command.type) {
    case "save_hours":
      return { method: "PUT", path: PROPOSED_PATHS.hours, ifMatch: command.version }
    case "add_special_date":
      return { method: "POST", path: PROPOSED_PATHS.specialDates }
    case "update_special_date":
      return { method: "PATCH", path: PROPOSED_PATHS.specialDate(command.id), ifMatch: command.version }
    case "delete_special_date":
      return { method: "DELETE", path: PROPOSED_PATHS.specialDate(command.id), ifMatch: command.version }
    case "pause":
      return { method: "POST", path: PROPOSED_PATHS.pause }
    case "resume":
      return { method: "DELETE", path: PROPOSED_PATHS.pause }
  }
}

const pausePath = (scope: string) => `${PROPOSED_PATHS.pause}?orderType=${encodeURIComponent(scope)}`

/** The delivery modes the seller has switched on, as the server reports them. */
async function enabledDeliveryModes(): Promise<string[]> {
  const raw = await getApiTransport().request<unknown>({ method: "GET", path: PROPOSED_PATHS.hours })
  const enabled = isRecord(raw) && isRecord(raw.enabledTypes) ? raw.enabledTypes : {}
  return DELIVERY_MODES_API.filter((mode) => enabled[mode] === true)
}

export const apiHoursAdapter: HoursAdapter = {
  context: getRestaurantContext,

  async getHours() {
    return weeklyHoursFromApi(await getApiTransport().request<unknown>({ method: "GET", path: PROPOSED_PATHS.hours }))
  },

  async listSpecialDates() {
    const response = await getApiTransport().request<unknown>({ method: "GET", path: PROPOSED_PATHS.specialDates })
    if (!Array.isArray(response)) throw new ServiceError("unavailable", "Invalid hours data from API: special dates")
    return response.map(specialDateFromApi)
  },

  async getPause() {
    return pauseFromApi(await getApiTransport().request<unknown>({ method: "GET", path: PROPOSED_PATHS.pause }))
  },

  async getStatus() {
    const transport = getApiTransport()
    const [status, ...pauses] = await Promise.all([
      transport.request<unknown>({ method: "GET", path: PROPOSED_PATHS.status }),
      ...ORDER_TYPES.map((type) => transport.request<unknown>({ method: "GET", path: pausePath(apiPauseScope(type)) })),
    ])
    const pauseByType = Object.fromEntries(ORDER_TYPES.map((type, index) => [type, pauseFromApi(pauses[index])])) as Partial<Record<OrderType, ReturnType<typeof pauseFromApi>>>
    return statusFromApi(status, pauseByType)
  },

  async act(command, idempotencyKey) {
    const transport = getApiTransport()
    const writesDelivery =
      (command.type === "save_hours" && (!command.scope || command.scope === "delivery")) ||
      ((command.type === "add_special_date" || command.type === "update_special_date") && command.draft.orderTypes.includes("delivery"))
    const deliveryModes = writesDelivery ? await enabledDeliveryModes() : undefined
    let target = request(command)
    if (command.type === "resume") {
      // End the pause the server reports for this tab (it may be a wider, whole-restaurant one).
      const current = pauseFromApi(await transport.request<unknown>({ method: "GET", path: pausePath(apiPauseScope(command.scope)) }))
      target = { ...target, path: pausePath(current.paused && current.scope ? current.scope : apiPauseScope(command.scope)) }
    }
    let response: unknown
    try {
      response = await transport.request<unknown>({
        ...target,
        body: commandBodyToApi(command, deliveryModes),
        idempotencyKey,
      })
    } catch (error) {
      // A stale If-Match on the weekly hours: say plainly what happened and what to do.
      if (command.type === "save_hours" && isServiceError(error) && error.kind === "conflict") {
        throw new ServiceError("conflict", error.message, undefined, "Someone else changed these hours. Reload the page to see the latest, then try again.")
      }
      throw error
    }
    return commandResultFromApi(command, response)
  },
}
