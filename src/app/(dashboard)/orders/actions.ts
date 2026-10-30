"use server"

import { refresh } from "next/cache"

import { isIdempotencyKey } from "@/lib/api/idempotency"
import { actionFailure, runAction, type ActionResult } from "@/lib/data-source/result"
import { parseOrderCommand } from "@/lib/orders/commands"
import {
  ordersMode,
  performOrderCommand,
  resetOrdersPreview,
  simulateIncomingOrder,
} from "@/lib/orders/service"
import type { OrderDetail } from "@/lib/orders/types"

// Everything arriving here is untrusted browser input. The command is parsed
// and validated first; the data source then applies the lifecycle rules, so a
// command that doesn't fit the order's current state is refused there.

export async function runOrderCommand(input: {
  orderId: unknown
  command: unknown
  idempotencyKey: unknown
}): Promise<ActionResult<OrderDetail>> {
  if (typeof input.orderId !== "string" || input.orderId.length === 0 || input.orderId.length > 100) {
    return actionFailure("not_found")
  }
  if (!isIdempotencyKey(input.idempotencyKey)) return actionFailure("validation")

  const parsed = parseOrderCommand(input.command)
  if (!parsed.ok) return actionFailure("validation", parsed.fieldErrors)

  const orderId = input.orderId
  const idempotencyKey = input.idempotencyKey
  const result = await runAction(ordersMode(), () =>
    performOrderCommand(orderId, parsed.command, idempotencyKey)
  )
  if (result.ok) refresh()
  return result
}

/** Preview only: adds a sample incoming order. Refused outside preview mode. */
export async function simulateNewOrder(): Promise<ActionResult<{ reference: string }>> {
  const result = await runAction(ordersMode(), async () => {
    const order = await simulateIncomingOrder()
    return { reference: order.reference }
  })
  if (result.ok) refresh()
  return result
}

/** Preview only: restores the starting sample orders. */
export async function resetPreviewOrders(): Promise<ActionResult> {
  const result = await runAction(ordersMode(), async () => {
    await resetOrdersPreview()
    return undefined
  })
  if (result.ok) refresh()
  return result
}
