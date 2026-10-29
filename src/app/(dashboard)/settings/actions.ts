"use server"

import { refresh } from "next/cache"

import { isIdempotencyKey } from "@/lib/api/idempotency"
import { actionFailure, runAction, type ActionResult } from "@/lib/data-source/result"
import { parseSettingsCommand } from "@/lib/settings/commands"
import type { SettingsCommandResult } from "@/lib/settings/rules"
import { performSettingsCommand, resetSettingsPreview, setSettingsPreviewSaveRefusal, settingsMode } from "@/lib/settings/service"

// Everything arriving here is untrusted browser input. The command is parsed
// and validated with the same rules as the forms; the data source then
// applies the settings rules (versions). Authorization is the backend's.

export async function runSettingsCommand(input: {
  command: unknown
  idempotencyKey: unknown
}): Promise<ActionResult<SettingsCommandResult>> {
  if (!isIdempotencyKey(input.idempotencyKey)) return actionFailure("validation")
  const parsed = parseSettingsCommand(input.command)
  if (!parsed.ok) return actionFailure("validation", parsed.fieldErrors)

  const idempotencyKey = input.idempotencyKey
  const result = await runAction(settingsMode(), () => performSettingsCommand(parsed.command, idempotencyKey))
  if (result.ok) refresh()
  return result
}

/** Preview only: restores the starting sample settings. Refused outside preview mode. */
export async function resetPreviewSettings(): Promise<ActionResult> {
  const result = await runAction(settingsMode(), async () => {
    await resetSettingsPreview()
    return undefined
  })
  if (result.ok) refresh()
  return result
}

/** Preview only: refuse (or allow) saves as the backend will for a non-owner. Refused outside preview mode. */
export async function setPreviewSaveRefusal(input: { refuseSaves: unknown }): Promise<ActionResult> {
  const result = await runAction(settingsMode(), async () => {
    await setSettingsPreviewSaveRefusal(input.refuseSaves === true)
    return undefined
  })
  if (result.ok) refresh()
  return result
}
