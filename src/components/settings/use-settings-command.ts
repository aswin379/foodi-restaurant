"use client"

import { useCallback, useRef, useState, useTransition } from "react"

import { runSettingsCommand } from "@/app/(dashboard)/settings/actions"
import { notifyActionResult } from "@/components/shared/notifications"
import { createIdempotencyKey } from "@/lib/api/idempotency"
import { actionFailure, type ActionResult } from "@/lib/data-source/result"
import type { SettingsCommand } from "@/lib/settings/commands"
import type { SettingsCommandResult } from "@/lib/settings/rules"

/** Shown when the request itself fails (too large, offline, server error): the action never answered. */
export const REQUEST_FAILED_MESSAGE =
  "Your change couldn't be sent, so nothing was saved. Check your connection and try again. If you changed both images, try saving one at a time."

/**
 * Runs one settings command. A key is created per attempt and kept when the
 * attempt fails, so retrying the same change can't apply it twice. A request
 * that fails before the action answers (for example, rejected as too large)
 * becomes an ordinary failure result: nothing is reported as saved, and the
 * form stays editable so the user can try again.
 */
export function useSettingsCommand() {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<ActionResult<SettingsCommandResult> | null>(null)
  const keyRef = useRef<string | null>(null)

  const run = useCallback((command: SettingsCommand, successText: string) => {
    const idempotencyKey = (keyRef.current ??= createIdempotencyKey())
    startTransition(async () => {
      let outcome: ActionResult<SettingsCommandResult>
      try {
        outcome = await runSettingsCommand({ command, idempotencyKey })
      } catch {
        outcome = actionFailure("unavailable", undefined, REQUEST_FAILED_MESSAGE)
      }
      setResult(outcome)
      if (outcome.ok) {
        keyRef.current = null
        notifyActionResult(outcome, { success: successText })
      }
    })
  }, [])

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {}
  return { pending, result, fieldErrors, run }
}
