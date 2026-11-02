"use server"

import { refresh } from "next/cache"

import { isIdempotencyKey } from "@/lib/api/idempotency"
import { withRequestAuth } from "@/lib/api/transport"
import { actionFailure, runAction, type ActionResult } from "@/lib/data-source/result"
import { parseMenuCommand } from "@/lib/menu/commands"
import type { MealPeriod } from "@/lib/menu/meal-periods"
import type { MenuCommandResult } from "@/lib/menu/rules"
import { listMealPeriods, menuMode, performMenuCommand, resetMenuPreview } from "@/lib/menu/service"

// Everything arriving here is untrusted browser input. The command is parsed
// and validated with the same rules as the form; the data source then applies
// the menu rules, refusing anything that no longer fits the menu.

export async function runMenuCommand(input: {
  command: unknown
  idempotencyKey: unknown
  accessToken?: string
  restaurantId?: number | string
}): Promise<ActionResult<MenuCommandResult>> {
  if (!isIdempotencyKey(input.idempotencyKey)) return actionFailure("validation")
  const parsed = parseMenuCommand(input.command)
  if (!parsed.ok) return actionFailure("validation", parsed.fieldErrors)

  const idempotencyKey = input.idempotencyKey
  const authContext = {
    accessToken: input.accessToken,
    restaurantId: input.restaurantId,
  }
  const result = await withRequestAuth(authContext, () =>
    runAction(menuMode(), () => performMenuCommand(parsed.command, idempotencyKey))
  )
  if (result.ok) refresh()
  return result
}

/**
 * Re-reads the meal periods (B3b), so "Convert to custom times" can check
 * whether a period changed since the editor loaded. Read-only.
 */
export async function readMealPeriods(auth?: {
  accessToken?: string
  restaurantId?: number | string
}): Promise<ActionResult<MealPeriod[]>> {
  return withRequestAuth(auth ?? {}, () => runAction(menuMode(), () => listMealPeriods()))
}

/** Preview only: restores the starting sample menu. Refused outside preview mode. */
export async function resetPreviewMenu(): Promise<ActionResult> {
  const result = await runAction(menuMode(), async () => {
    await resetMenuPreview()
    return undefined
  })
  if (result.ok) refresh()
  return result
}
