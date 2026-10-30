import "server-only"

import { getApiTransport } from "@/lib/api/transport"

import type { SettingsAdapter } from "./adapter"
import { commandBodyToApi, commandResultFromApi, orderSettingsFromApi, profileFromApi } from "./api-mapping"

/**
 * Integration point for the Foodi restaurant-settings API.
 *
 * No seller API exists yet, so the transport reports `not_configured` for
 * every call and the pages show "Settings aren't connected yet". Every path,
 * header and payload here is the PROPOSED contract in docs/settings-ui.md,
 * awaiting backend agreement. Image uploads need their own endpoint. Never
 * fall back to preview data.
 */
const PROPOSED_PATHS = {
  profile: "/seller/restaurant/profile",
  orderSettings: "/seller/restaurant/order-settings",
}

export const apiSettingsAdapter: SettingsAdapter = {
  async getProfile() {
    return profileFromApi(await getApiTransport().request<unknown>({ method: "GET", path: PROPOSED_PATHS.profile }))
  },

  async getOrderSettings() {
    return orderSettingsFromApi(await getApiTransport().request<unknown>({ method: "GET", path: PROPOSED_PATHS.orderSettings }))
  },

  async act(command, idempotencyKey) {
    const response = await getApiTransport().request<unknown>({
      method: command.type === "save_profile" ? "PATCH" : "PUT",
      path: command.type === "save_profile" ? PROPOSED_PATHS.profile : PROPOSED_PATHS.orderSettings,
      ifMatch: command.version,
      body: commandBodyToApi(command),
      idempotencyKey,
    })
    return commandResultFromApi(command, response)
  },
}
