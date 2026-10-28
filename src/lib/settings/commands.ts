import {
  hasErrors,
  orderSettingsDraftFromInput,
  profileDraftFromInput,
  validateOrderSettingsDraft,
  validateProfileDraft,
  type FieldErrors,
  type OrderSettingsDraft,
  type ProfileDraft,
} from "./validation"

// Restaurant commands on settings. Server Actions parse untrusted browser
// input with parseSettingsCommand; the rules (rules.ts, or the backend) then
// decide whether the command fits the saved settings (versions).

export type SettingsCommand =
  | { type: "save_profile"; version: string; draft: ProfileDraft }
  | { type: "save_order_settings"; version: string; draft: OrderSettingsDraft }

export type ParsedSettingsCommand = { ok: true; command: SettingsCommand } | { ok: false; fieldErrors: FieldErrors }

const VERSION_PATTERN = /^[\w.-]{1,100}$/
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
const unknownCommand: ParsedSettingsCommand = { ok: false, fieldErrors: { command: "Unknown action." } }

export function parseSettingsCommand(input: unknown): ParsedSettingsCommand {
  if (!isRecord(input)) return unknownCommand
  // Every save carries the version it was loaded at, so a stale one can be refused.
  const version = typeof input.version === "string" && VERSION_PATTERN.test(input.version) ? input.version : null
  if (!version) return unknownCommand

  switch (input.type) {
    case "save_profile": {
      const draft = profileDraftFromInput(input.draft)
      const errors = validateProfileDraft(draft)
      return hasErrors(errors) ? { ok: false, fieldErrors: errors } : { ok: true, command: { type: "save_profile", version, draft } }
    }
    case "save_order_settings": {
      const draft = orderSettingsDraftFromInput(input.draft)
      const errors = validateOrderSettingsDraft(draft)
      return hasErrors(errors)
        ? { ok: false, fieldErrors: errors }
        : { ok: true, command: { type: "save_order_settings", version, draft } }
    }
    default:
      return unknownCommand
  }
}
