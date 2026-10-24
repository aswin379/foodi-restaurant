import type { RestaurantContext } from "@/lib/restaurant/context"

import type { HoursCommand } from "./commands"
import type { HoursCommandResult } from "./rules"
import type { AvailabilityStatus, PauseState, SpecialDate, WeeklyHours } from "./types"

/**
 * What the Hours screens need from a data source: the Foodi API
 * (api-source.ts) or labelled preview data (preview-source.ts).
 * `previewScenario` is ignored by the API adapter.
 */
export type HoursAdapter = {
  context(): Promise<RestaurantContext>
  getHours(previewScenario?: unknown): Promise<WeeklyHours>
  /** Recent past (read-only) and upcoming special dates; the range is the server's default. */
  listSpecialDates(previewScenario?: unknown): Promise<SpecialDate[]>
  getPause(previewScenario?: unknown): Promise<PauseState>
  /** Server-computed state per order type (an estimate in preview mode). */
  getStatus(previewScenario?: unknown): Promise<AvailabilityStatus>
  /** Applies a command. Replays the stored result for a repeated key. */
  act(command: HoursCommand, idempotencyKey: string): Promise<HoursCommandResult>
}
