"use client"

import { useCallback, useRef, useState, useTransition } from "react"

import { runMenuCommand } from "@/app/(dashboard)/menu/actions"
import { notifyActionResult } from "@/components/shared/notifications"
import { createIdempotencyKey } from "@/lib/api/idempotency"
import type { ActionResult } from "@/lib/data-source/result"
import type { MenuCommand } from "@/lib/menu/commands"
import type { MenuCommandResult } from "@/lib/menu/rules"

/**
 * Runs one menu command. A key is created per attempt and kept when the
 * attempt fails, so retrying the same change can't apply it twice; `begin()`
 * starts a fresh attempt (e.g. when a dialog opens).
 */
export function useMenuCommand() {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<ActionResult<MenuCommandResult> | null>(null)
  const keyRef = useRef<string | null>(null)

  const begin = useCallback(() => {
    keyRef.current = createIdempotencyKey()
    setResult(null)
  }, [])

  const run = useCallback(
    (command: MenuCommand, successText: string, onSuccess?: (result: MenuCommandResult) => void) => {
      const idempotencyKey = (keyRef.current ??= createIdempotencyKey())
      startTransition(async () => {
        const outcome = await runMenuCommand({ command, idempotencyKey })
        setResult(outcome)
        if (outcome.ok) {
          keyRef.current = null
          notifyActionResult(outcome, { success: successText })
          onSuccess?.(outcome.data)
        }
      })
    },
    []
  )

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {}
  return { pending, result, fieldErrors, begin, run }
}
