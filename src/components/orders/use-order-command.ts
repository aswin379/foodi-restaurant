"use client"

import { useCallback, useRef, useState, useTransition } from "react"

import { runOrderCommand } from "@/app/(dashboard)/orders/actions"
import { notifyActionResult } from "@/components/shared/notifications"
import { createIdempotencyKey } from "@/lib/api/idempotency"
import type { ActionResult } from "@/lib/data-source/result"
import type { OrderCommand } from "@/lib/orders/commands"
import type { OrderDetail } from "@/lib/orders/types"

/**
 * Runs one restaurant command against an order. A key is created per attempt
 * and kept when the attempt fails, so retrying the same change can't apply it
 * twice; `begin()` starts a fresh attempt (e.g. when a dialog opens).
 */
export function useOrderCommand(orderId: string) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<ActionResult<OrderDetail> | null>(null)
  const keyRef = useRef<string | null>(null)

  const begin = useCallback(() => {
    keyRef.current = createIdempotencyKey()
    setResult(null)
  }, [])

  const run = useCallback(
    (command: OrderCommand, successText: string, onSuccess?: () => void) => {
      const idempotencyKey = (keyRef.current ??= createIdempotencyKey())
      startTransition(async () => {
        const outcome = await runOrderCommand({ orderId, command, idempotencyKey })
        setResult(outcome)
        if (outcome.ok) {
          keyRef.current = null
          notifyActionResult(outcome, { success: successText })
          onSuccess?.()
        }
      })
    },
    [orderId]
  )

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {}
  return { pending, result, fieldErrors, begin, run }
}
