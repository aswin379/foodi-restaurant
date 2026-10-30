"use client"

import { useState, useTransition } from "react"
import { RotateCcw } from "lucide-react"

import { resetPreviewHours } from "@/app/(dashboard)/hours/actions"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { notifyActionResult } from "@/components/shared/notifications"
import { Button } from "@/components/ui/button"

/**
 * Preview-only reset. Rendered only in preview mode, and the Server Action
 * behind it refuses to run outside it.
 */
export function PreviewHoursControls() {
  const [pending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Preview tools">
      <span className="text-xs font-medium tracking-wide text-warning-foreground uppercase">Preview tools</span>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm(true)}>
        <RotateCcw aria-hidden />
        Reset sample hours
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Reset sample hours?"
        description="All simulated changes to hours, special dates and pause on this preview server are discarded and the starting sample hours come back."
        confirmLabel="Reset"
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await resetPreviewHours()
            notifyActionResult(result, { success: "Sample hours reset" })
            if (result.ok) setConfirm(false)
          })
        }
      />
    </div>
  )
}
