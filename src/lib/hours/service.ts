import "server-only"

import { connection } from "next/server"

import { ServiceError } from "@/lib/data-source/errors"
import { selectAdapter, type DataSourceMode } from "@/lib/data-source/mode"
import type { RestaurantContext } from "@/lib/restaurant/context"

import type { HoursAdapter } from "./adapter"
import { apiHoursAdapter } from "./api-source"
import type { HoursCommand } from "./commands"
import { createPreviewHoursAdapter, resetPreviewHours } from "./preview-source"
import type { HoursCommandResult } from "./rules"
import type { AvailabilityStatus, PauseState, SpecialDate, WeeklyHours } from "./types"

/**
 * Preview data is an explicit development opt-in
 * (FOODI_HOURS_DATA_SOURCE=preview) and is refused in production builds.
 * There is no fallback: if the API fails, the UI shows an error.
 */
function hours(): { mode: DataSourceMode; adapter: HoursAdapter } {
  return selectAdapter({
    modeValue: process.env.FOODI_HOURS_DATA_SOURCE,
    api: apiHoursAdapter,
    preview: createPreviewHoursAdapter,
  })
}

export function hoursMode(): DataSourceMode {
  return hours().mode
}

export async function getHoursContext(): Promise<RestaurantContext> {
  await connection()
  return hours().adapter.context()
}

export async function getWeeklyHours(previewScenario?: unknown): Promise<WeeklyHours> {
  await connection()
  return hours().adapter.getHours(previewScenario)
}

export async function listSpecialDates(previewScenario?: unknown): Promise<SpecialDate[]> {
  await connection()
  return hours().adapter.listSpecialDates(previewScenario)
}

export async function getPauseState(previewScenario?: unknown): Promise<PauseState> {
  await connection()
  return hours().adapter.getPause(previewScenario)
}

export async function getAvailabilityStatus(previewScenario?: unknown): Promise<AvailabilityStatus> {
  await connection()
  return hours().adapter.getStatus(previewScenario)
}

export async function performHoursCommand(command: HoursCommand, idempotencyKey: string): Promise<HoursCommandResult> {
  return hours().adapter.act(command, idempotencyKey)
}

export async function resetHoursPreview(): Promise<void> {
  if (hours().mode !== "preview") {
    throw new ServiceError("forbidden", "Preview controls are only available in preview mode.")
  }
  resetPreviewHours()
}
