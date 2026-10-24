"use server"

import { refresh } from "next/cache"

import { isIdempotencyKey } from "@/lib/api/idempotency"
import { actionFailure, runAction, type ActionResult } from "@/lib/data-source/result"
import { parseHoursCommand } from "@/lib/hours/commands"
import type { HoursCommandResult } from "@/lib/hours/rules"
import { hoursMode, performHoursCommand, resetHoursPreview } from "@/lib/hours/service"

// Everything arriving here is untrusted browser input. The command is parsed
// and validated with the same rules as the editor; the data source then
// applies the hours rules (versions, past dates, duplicates, pause state).

export async function runHoursCommand(input: {
  command: unknown
  idempotencyKey: unknown
}): Promise<ActionResult<HoursCommandResult>> {
  if (!isIdempotencyKey(input.idempotencyKey)) return actionFailure("validation")
  const parsed = parseHoursCommand(input.command)
  if (!parsed.ok) return actionFailure("validation", parsed.fieldErrors)

  const idempotencyKey = input.idempotencyKey
  const result = await runAction(hoursMode(), () => performHoursCommand(parsed.command, idempotencyKey))
  if (result.ok) refresh()
  return result
}

/** Preview only: restores the starting sample hours. Refused outside preview mode. */
export async function resetPreviewHours(): Promise<ActionResult> {
  const result = await runAction(hoursMode(), async () => {
    await resetHoursPreview()
    return undefined
  })
  if (result.ok) refresh()
  return result
}
