"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ActionResultMessage } from "@/components/shared/action-result-message"
import type { ZoneAndLocale } from "@/lib/orders/format"
import {
  availableActions,
  orderHint,
  orderActionLabels,
  type OrderActionId,
} from "@/lib/orders/lifecycle"
import type { Rider } from "@/lib/orders/types"
import { cn } from "@/lib/utils"

import {
  AcceptOrderDialog,
  AdjustPrepTimeDialog,
  CancelOrderDialog,
  DispatchOrderDialog,
  RejectOrderDialog,
  type DialogOrder,
} from "./order-dialogs"
import { useOrderCommand } from "./use-order-command"

type DialogAction = Exclude<OrderActionId, "mark_ready" | "complete">

const ACTIVE = new Set(["scheduled", "pending", "accepted", "ready", "out_for_delivery"])

/**
 * The restaurant's actions for one order. What's offered comes from the
 * shared lifecycle rules; the server applies the same rules and refuses
 * anything that no longer fits the order.
 */
export function OrderActions({
  order,
  riders,
  context,
  layout = "stacked",
}: {
  order: DialogOrder
  riders: Rider[]
  context: ZoneAndLocale
  /** "stacked" for the detail page, "compact" for board cards. */
  layout?: "stacked" | "compact"
}) {
  const command = useOrderCommand(order.id)
  const [dialog, setDialog] = useState<DialogAction | null>(null)
  const [direct, setDirect] = useState<OrderActionId | null>(null)
  const actions = availableActions(order)
  const hint = orderHint(order)

  const open = (action: DialogAction) => {
    command.begin()
    setDirect(null)
    setDialog(action)
  }
  const close = (next: boolean) => {
    if (!next) setDialog(null)
  }
  const runDirect = (action: "mark_ready" | "complete") => {
    command.begin()
    setDirect(action)
    command.run(
      { type: action },
      action === "mark_ready" ? `Order ${order.reference} marked ready` : `Order ${order.reference} completed`
    )
  }

  const dialogProps = { order, command, context, open: true, onOpenChange: close }
  const compact = layout === "compact"

  return (
    <div className="flex flex-col gap-2">
      {actions.length > 0 ? (
        <div className={cn("flex gap-2", compact ? "flex-wrap" : "flex-col")}>
          {actions.map((action, index) => {
            const primary = index === 0 && action !== "cancel"
            const destructive = action === "cancel" || action === "reject"
            const isDirect = action === "mark_ready" || action === "complete"
            const busy = command.pending && direct === action
            return (
              <Button
                key={action}
                type="button"
                variant={primary ? "default" : destructive ? "ghost" : "outline"}
                size={compact ? "default" : "lg"}
                aria-disabled={busy || undefined}
                onClick={() => {
                  if (busy) return
                  if (isDirect) runDirect(action)
                  else open(action)
                }}
                className={cn(
                  compact ? (primary ? "h-11 flex-1 basis-full text-base" : "h-10 flex-1") : "w-full",
                  destructive && "text-destructive hover:bg-destructive/10 hover:text-destructive"
                )}
              >
                {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
                {orderActionLabels[action]}
                <span className="sr-only"> for {order.reference}</span>
              </Button>
            )
          })}
        </div>
      ) : null}

      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : actions.length === 0 && !ACTIVE.has(order.status) ? (
        <p className="text-sm text-muted-foreground">No actions: this order is closed.</p>
      ) : null}

      {/* Failures of one-tap actions are shown inline; dialogs show their own. */}
      {direct && command.result && !command.result.ok ? (
        <ActionResultMessage result={command.result} successText="" />
      ) : null}

      {dialog === "accept" ? <AcceptOrderDialog {...dialogProps} /> : null}
      {dialog === "reject" ? <RejectOrderDialog {...dialogProps} /> : null}
      {dialog === "cancel" ? <CancelOrderDialog {...dialogProps} /> : null}
      {dialog === "adjust_prep_time" ? <AdjustPrepTimeDialog {...dialogProps} /> : null}
      {dialog === "dispatch" ? <DispatchOrderDialog {...dialogProps} riders={riders} /> : null}
    </div>
  )
}
