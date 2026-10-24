import { Lock } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  LIFECYCLE_PENDING_MESSAGE,
  proposedActionsFor,
} from "@/lib/orders/lifecycle"
import type { FulfilmentMethod, OrderStatus } from "@/lib/orders/types"
import { cn } from "@/lib/utils"

/**
 * Proposed restaurant actions, all disabled until the lifecycle and API are
 * approved. Buttons use aria-disabled (not `disabled`) so keyboard and
 * screen-reader users can still reach them and hear why they're unavailable.
 */
export function OrderActions({
  status,
  fulfilment,
}: {
  status: OrderStatus
  fulfilment: FulfilmentMethod
}) {
  const actions = proposedActionsFor(status, fulfilment)
  const explanationId = "order-actions-explanation"

  return (
    <div className="flex flex-col gap-3">
      {actions.length > 0 ? (
        <div className="flex flex-col gap-2">
          {actions.map((action) => (
            <Button
              key={action.id}
              type="button"
              variant={action.destructive ? "outline" : "default"}
              aria-disabled="true"
              aria-describedby={explanationId}
              className={cn(
                "h-10 w-full cursor-not-allowed opacity-60",
                // No hover feedback: the action can't be used yet.
                action.destructive
                  ? "hover:bg-background hover:text-foreground"
                  : "hover:bg-primary"
              )}
            >
              {action.label}
              {action.requiresReason ? (
                <span className="text-xs font-normal opacity-80">(reason required)</span>
              ) : null}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          The proposed lifecycle has no restaurant actions for an order in this state.
        </p>
      )}
      <p
        id={explanationId}
        className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground"
      >
        <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        {LIFECYCLE_PENDING_MESSAGE}
      </p>
    </div>
  )
}
