"use client"

import { useCallback, useRef, useState, useTransition } from "react"

import { runHoursCommand } from "@/app/(dashboard)/hours/actions"
import { notifyActionResult } from "@/components/shared/notifications"
import { createIdempotencyKey } from "@/lib/api/idempotency"
import type { ActionResult } from "@/lib/data-source/result"
import type { HoursCommand } from "@/lib/hours/commands"
import type { HoursCommandResult } from "@/lib/hours/rules"

/**
 * Runs one hours command. A key is created per attempt and kept when the
 * attempt fails, so retrying the same change can't apply it twice; `begin()`
 * starts a fresh attempt (e.g. when a dialog opens).
 */
export function useHoursCommand() {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<ActionResult<HoursCommandResult> | null>(null)
  const keyRef = useRef<string | null>(null)

  const begin = useCallback(() => {
    keyRef.current = createIdempotencyKey()
    setResult(null)
  }, [])

  const run = useCallback(
    (
      command: HoursCommand,
      successText: string | ((result: HoursCommandResult) => string),
      onSuccess?: (result: HoursCommandResult) => void
    ) => {
      const idempotencyKey = (keyRef.current ??= createIdempotencyKey())
      startTransition(async () => {
        const outcome = await runHoursCommand({ command, idempotencyKey })
        setResult(outcome)
        if (outcome.ok) {
          keyRef.current = null
          notifyActionResult(outcome, {
            success: typeof successText === "function" ? successText(outcome.data) : successText,
          })
          onSuccess?.(outcome.data)
        }
      })
    },
    []
  )

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {}
  return { pending, result, fieldErrors, begin, run }
}
