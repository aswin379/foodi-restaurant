import type { SettingsCommand } from "./commands"
import type { SettingsCommandResult } from "./rules"
import type { OrderSettings, RestaurantProfile } from "./types"

/**
 * What the Settings screens need from a data source: the Foodi API
 * (api-source.ts) or labelled preview data (preview-source.ts).
 * `previewScenario` is ignored by the API adapter.
 */
export type SettingsAdapter = {
  getProfile(previewScenario?: unknown): Promise<RestaurantProfile>
  getOrderSettings(previewScenario?: unknown): Promise<OrderSettings>
  /** Applies a command. Replays the stored result for a repeated key. */
  act(command: SettingsCommand, idempotencyKey: string): Promise<SettingsCommandResult>
}
