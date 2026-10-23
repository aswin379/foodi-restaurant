"use client"

import { useState, useTransition } from "react"
import { BellPlus, RotateCcw } from "lucide-react"

import { resetPreviewOrders, simulateNewOrder } from "@/app/(dashboard)/orders/actions"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { notifyActionResult } from "@/components/shared/notifications"
import { Button } from "@/components/ui/button"

/**
 * Preview-only tools for trying the board. Rendered only in preview mode, and
 * the Server Actions behind them refuse to run outside it.
 */
export function PreviewOrderControls() {
  const [pending, startTransition] = useTransition()
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Preview tools" role="group">
      <span className="text-xs font-medium tracking-wide text-amber-900 uppercase">Preview tools</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-disabled={pending || undefined}
        onClick={() => {
          if (pending) return
          startTransition(async () => {
            const result = await simulateNewOrder()
            notifyActionResult(result, {
              success: result.ok ? `Sample order ${result.data.reference} placed` : "",
            })
          })
        }}
      >
        <BellPlus aria-hidden />
        Simulate a new order
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
        <RotateCcw aria-hidden />
        Reset sample orders
      </Button>
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset sample orders?"
        description="All simulated changes on this preview server are discarded and the starting sample orders come back."
        confirmLabel="Reset"
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await resetPreviewOrders()
            notifyActionResult(result, { success: "Sample orders reset" })
            if (result.ok) setConfirmReset(false)
          })
        }
      />
    </div>
  )
}
