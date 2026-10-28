import "server-only"

import { ServiceError } from "@/lib/data-source/errors"
import { getPreviewCollection } from "@/lib/data-source/preview-store"

import type { SettingsAdapter } from "./adapter"
import { buildFixtureSettings } from "./fixtures/settings"
import { applySettingsCommand, type SettingsCommandResult, type SettingsState } from "./rules"

// PREVIEW ADAPTER (development only). The profile and order settings live as
// one record in the in-memory preview store, so each command is applied
// atomically. Nothing reaches Foodi, everything resets when the server
// restarts, and the store refuses to run in production. It never touches the
// hours, menu or orders collections.

/** `?preview=empty|error|slow|forbidden` shows those states without a backend. */
export function parsePreviewScenario(value: unknown) {
  return value === "empty" || value === "error" || value === "slow" || value === "forbidden" ? value : null
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function applyScenario(value: unknown) {
  const scenario = parsePreviewScenario(value)
  await delay(scenario === "slow" ? 2500 : 50)
  if (scenario === "error") throw new ServiceError("unavailable", "Preview scenario: error")
  if (scenario === "forbidden") throw new ServiceError("forbidden", "Preview scenario: forbidden")
  // There is no "empty" profile: a restaurant always has one, so empty means not connected.
  if (scenario === "empty") throw new ServiceError("not_configured", "Preview scenario: empty")
}

type StoredSettings = SettingsState & { id: "settings" }
const SETTINGS_ID = "settings"

const store = () =>
  getPreviewCollection<StoredSettings>("restaurant.settings", () => [{ id: SETTINGS_ID, ...buildFixtureSettings(Date.now()) }])
// Results of commands already applied, by idempotency key.
const processed = () =>
  getPreviewCollection<{ id: string; command: string; result: SettingsCommandResult }>("restaurant.settings.idempotency", () => [])

// Preview tool: refuse saves the way the backend will for someone who isn't the owner (D9).
const previewFlags = () =>
  getPreviewCollection<{ id: "flags"; refuseSaves: boolean }>("restaurant.settings.preview", () => [{ id: "flags", refuseSaves: false }])

export function previewSaveRefusal(): boolean {
  return previewFlags().get("flags")?.refuseSaves ?? false
}

export function setPreviewSaveRefusal(refuseSaves: boolean) {
  previewFlags().update("flags", (flags) => ({ ...flags, refuseSaves }))
}

function current(): StoredSettings {
  const stored = store().get(SETTINGS_ID)
  if (!stored) throw new ServiceError("unavailable", "Preview settings are missing.")
  return stored
}

export function createPreviewSettingsAdapter(): SettingsAdapter {
  return {
    async getProfile(previewScenario) {
      await applyScenario(previewScenario)
      return current().profile
    },

    async getOrderSettings(previewScenario) {
      await applyScenario(previewScenario)
      return current().orderSettings
    },

    async act(command, idempotencyKey) {
      await delay(150)
      // A 403 from the backend carries no wording of its own; the UI shows its standard permission message.
      if (previewSaveRefusal()) throw new ServiceError("forbidden", "Preview: saves refused as for a non-owner")
      const fingerprint = JSON.stringify(command)
      const replay = processed().get(idempotencyKey)
      if (replay) {
        if (replay.command !== fingerprint) {
          throw new ServiceError("conflict", "This request key was already used for a different change.")
        }
        return replay.result
      }
      let result: SettingsCommandResult | undefined
      store().update(SETTINGS_ID, (state) => {
        // Preview keeps a replaced image as the compressed data URL the browser sent.
        const applied = applySettingsCommand(state, command, { now: new Date(), actor: "Preview staff", storeImage: (dataUrl) => dataUrl })
        result = applied.result
        return { ...applied.state, id: SETTINGS_ID }
      })
      processed().insert({ id: idempotencyKey, command: fingerprint, result: result! })
      return result!
    },
  }
}

/** Preview control: restores the starting sample settings. */
export function resetPreviewSettings() {
  store().reset()
  processed().reset()
  previewFlags().reset()
}
