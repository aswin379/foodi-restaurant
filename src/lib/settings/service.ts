import "server-only"

import { connection } from "next/server"

import { ServiceError } from "@/lib/data-source/errors"
import { selectAdapter, type DataSourceMode } from "@/lib/data-source/mode"

import type { SettingsAdapter } from "./adapter"
import { apiSettingsAdapter } from "./api-source"
import type { SettingsCommand } from "./commands"
import {
  createPreviewSettingsAdapter,
  previewSaveRefusal,
  resetPreviewSettings,
  setPreviewSaveRefusal,
} from "./preview-source"
import type { SettingsCommandResult } from "./rules"
import type { OrderSettings, RestaurantProfile } from "./types"

/**
 * Settings belong to the restaurant, so they use the existing
 * FOODI_RESTAURANT_DATA_SOURCE, like the shared restaurant context. Preview
 * is an explicit development opt-in and is refused in production builds.
 * There is no fallback: if the API fails, the UI shows an error.
 */
function settings(): { mode: DataSourceMode; adapter: SettingsAdapter } {
  return selectAdapter({
    modeValue: process.env.FOODI_RESTAURANT_DATA_SOURCE,
    api: apiSettingsAdapter,
    preview: createPreviewSettingsAdapter,
  })
}

export function settingsMode(): DataSourceMode {
  return settings().mode
}

export async function getRestaurantProfile(previewScenario?: unknown): Promise<RestaurantProfile> {
  await connection()
  return settings().adapter.getProfile(previewScenario)
}

export async function getOrderSettings(previewScenario?: unknown): Promise<OrderSettings> {
  await connection()
  return settings().adapter.getOrderSettings(previewScenario)
}

export async function performSettingsCommand(command: SettingsCommand, idempotencyKey: string): Promise<SettingsCommandResult> {
  return settings().adapter.act(command, idempotencyKey)
}

function assertPreviewMode() {
  if (settings().mode !== "preview") {
    throw new ServiceError("forbidden", "Preview controls are only available in preview mode.")
  }
}

export async function resetSettingsPreview(): Promise<void> {
  assertPreviewMode()
  resetPreviewSettings()
}

/** Preview tool: whether saves are refused as for a non-owner (D9). */
export function settingsPreviewRefusesSaves(): boolean {
  assertPreviewMode()
  return previewSaveRefusal()
}

export async function setSettingsPreviewSaveRefusal(refuseSaves: boolean): Promise<void> {
  assertPreviewMode()
  setPreviewSaveRefusal(refuseSaves)
}
