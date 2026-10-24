import "server-only"

import { getApiTransport, type ApiMethod } from "@/lib/api/transport"
import { ServiceError } from "@/lib/data-source/errors"
import { getRestaurantContext } from "@/lib/restaurant/context"

import type { HoursAdapter } from "./adapter"
import {
  commandBodyToApi,
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
    return statusFromApi(await getApiTransport().request<unknown>({ method: "GET", path: PROPOSED_PATHS.status }))
  },

  async act(command, idempotencyKey) {
    const response = await getApiTransport().request<unknown>({
      ...request(command),
      body: commandBodyToApi(command),
      idempotencyKey,
    })
    return commandResultFromApi(command, response)
  },
}
