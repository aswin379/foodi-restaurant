"use client"

import { useState, useTransition } from "react"
import { RotateCcw } from "lucide-react"

import { resetPreviewMenu } from "@/app/(dashboard)/menu/actions"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { notifyActionResult } from "@/components/shared/notifications"
import { Button } from "@/components/ui/button"

/**
 * Preview-only reset. Rendered only in preview mode, and the Server Action
 * behind it refuses to run outside it.
 */
export function PreviewMenuControls() {
  const [pending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Preview tools">
      <span className="text-xs font-medium tracking-wide text-warning-foreground uppercase">Preview tools</span>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm(true)}>
        <RotateCcw aria-hidden />
        Reset sample menu
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Reset sample menu?"
        description="All simulated changes to items and categories on this preview server are discarded and the starting sample menu comes back."
        confirmLabel="Reset"
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await resetPreviewMenu()
            notifyActionResult(result, { success: "Sample menu reset" })
            if (result.ok) setConfirm(false)
          })
        }
      />
    </div>
  )
}
