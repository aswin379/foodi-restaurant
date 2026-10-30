import { ServiceError } from "@/lib/data-source/errors"
import type { ImageChange } from "@/lib/menu/validation"

import type { SettingsCommand } from "./commands"
import type { OrderSettings, RestaurantProfile } from "./types"
import { orderSettingsFromDraft, profileFieldsFromDraft } from "./validation"

// The rules a settings command must satisfy, as one pure function. The
// preview data source uses it to simulate the backend, which is expected to
// enforce the same rules itself (docs/settings-ui.md). Only the settings
// record changes: hours, menu and orders are never touched (D6).

export type SettingsState = { profile: RestaurantProfile; orderSettings: OrderSettings }

export type SettingsCommandResult =
  | { kind: "profile"; profile: RestaurantProfile }
  | { kind: "order_settings"; orderSettings: OrderSettings }

export type SettingsContext = {
  now: Date
  actor: string
  /** Stores a replaced image and returns its URL (preview: the data URL itself). */
  storeImage: (dataUrl: string) => string
}

function stale(what: string) {
  const message = `${what} changed since you opened this page. Reload to see the latest, then make your change again.`
  return new ServiceError("conflict", message, undefined, message)
}

/** Preview versions count up: "<prefix>-1", "<prefix>-2", … */
function nextVersion(version: string) {
  const parts = version.split("-")
  const count = Number(parts.at(-1))
  return Number.isInteger(count) ? [...parts.slice(0, -1), count + 1].join("-") : `${version}-2`
}

function imageUrl(change: ImageChange, current: string | null, context: SettingsContext) {
  if (change.kind === "keep") return current
  if (change.kind === "remove") return null
  return context.storeImage(change.dataUrl)
}

export function applySettingsCommand(
  state: SettingsState,
  command: SettingsCommand,
  context: SettingsContext
): { state: SettingsState; result: SettingsCommandResult } {
  const stamp = { updatedAt: context.now.toISOString(), updatedBy: context.actor }
  switch (command.type) {
    case "save_profile": {
      const current = state.profile
      if (current.version !== command.version) throw stale("The profile")
      const profile: RestaurantProfile = {
        ...current,
        ...profileFieldsFromDraft(command.draft),
        logoUrl: imageUrl(command.draft.logo, current.logoUrl, context),
        coverUrl: imageUrl(command.draft.cover, current.coverUrl, context),
        // Time zone, currency and language are read-only here (D7).
        timeZone: current.timeZone,
        currency: current.currency,
        locale: current.locale,
        version: nextVersion(current.version),
        ...stamp,
      }
      return { state: { ...state, profile }, result: { kind: "profile", profile } }
    }
    case "save_order_settings": {
      const current = state.orderSettings
      if (current.version !== command.version) throw stale("Order settings")
      const orderSettings: OrderSettings = {
        ...current,
        ...orderSettingsFromDraft(command.draft, state.profile.currency),
        version: nextVersion(current.version),
        ...stamp,
      }
      return { state: { ...state, orderSettings }, result: { kind: "order_settings", orderSettings } }
    }
  }
}
