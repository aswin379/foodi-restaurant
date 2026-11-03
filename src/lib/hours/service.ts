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
 * When in development, if the backend server is temporarily unreachable,
 * it safely falls back to preview data to avoid broken screens.
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

function shouldFallback(error: unknown): boolean {
  if (process.env.NODE_ENV === "production") return false
  if (error && typeof error === "object" && "kind" in error && (error as any).kind === "not_configured") {
    return false
  }
  return true
}

export async function getHoursContext(): Promise<RestaurantContext> {
  await connection()
  try {
    return await hours().adapter.context()
  } catch (error) {
    if (shouldFallback(error)) {
      try {
        return await createPreviewHoursAdapter().context()
      } catch {}
    }
    throw error
  }
}

export async function getWeeklyHours(previewScenario?: unknown): Promise<WeeklyHours> {
  await connection()
  try {
    return await hours().adapter.getHours(previewScenario)
  } catch (error) {
    if (shouldFallback(error)) {
      try {
        return await createPreviewHoursAdapter().getHours(previewScenario)
      } catch {}
    }
    throw error
  }
}

export async function listSpecialDates(previewScenario?: unknown): Promise<SpecialDate[]> {
  await connection()
  try {
    return await hours().adapter.listSpecialDates(previewScenario)
  } catch (error) {
    if (shouldFallback(error)) {
      try {
        return await createPreviewHoursAdapter().listSpecialDates(previewScenario)
      } catch {}
    }
    throw error
  }
}

export async function getPauseState(previewScenario?: unknown): Promise<PauseState> {
  await connection()
  try {
    return await hours().adapter.getPause(previewScenario)
  } catch (error) {
    if (shouldFallback(error)) {
      try {
        return await createPreviewHoursAdapter().getPause(previewScenario)
      } catch {}
    }
    throw error
  }
}

export async function getAvailabilityStatus(previewScenario?: unknown): Promise<AvailabilityStatus> {
  await connection()
  try {
    return await hours().adapter.getStatus(previewScenario)
  } catch (error) {
    if (shouldFallback(error)) {
      try {
        return await createPreviewHoursAdapter().getStatus(previewScenario)
      } catch {}
    }
    throw error
  }
}

export async function performHoursCommand(command: HoursCommand, idempotencyKey: string): Promise<HoursCommandResult> {
  try {
    return await hours().adapter.act(command, idempotencyKey)
  } catch (error) {
    if (shouldFallback(error)) {
      try {
        return await createPreviewHoursAdapter().act(command, idempotencyKey)
      } catch {}
    }
    throw error
  }
}

export async function resetHoursPreview(): Promise<void> {
  if (hours().mode !== "preview") {
    throw new ServiceError("forbidden", "Preview controls are only available in preview mode.")
  }
  await resetPreviewHours()
}
