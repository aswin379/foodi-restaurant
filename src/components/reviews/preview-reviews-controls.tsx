"use client"

import { useState, useTransition } from "react"
import { RotateCcw } from "lucide-react"

import { resetPreviewReviews, setPreviewActionRefusal } from "@/app/(dashboard)/reviews/actions"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { notifyActionResult } from "@/components/shared/notifications"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

/**
 * Preview-only tools. Rendered only in preview mode, and the Server Actions
 * behind them refuse to run outside it.
 */
export function PreviewReviewsControls({ refusesActions }: { refusesActions: boolean }) {
  const [pending, startTransition] = useTransition()
  const [refusalPending, startRefusal] = useTransition()
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Preview tools">
      <span className="text-xs font-medium tracking-wide text-warning-foreground uppercase">Preview tools</span>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm(true)}>
        <RotateCcw aria-hidden />
        Reset sample reviews
      </Button>
      <div className="flex items-center gap-2">
        <Switch
          id="preview-refuse-review-actions"
          checked={refusesActions}
          aria-disabled={refusalPending || undefined}
          onCheckedChange={(refuseActions) =>
            !refusalPending &&
            startRefusal(async () => {
              const result = await setPreviewActionRefusal({ refuseActions })
              notifyActionResult(result, { success: refuseActions ? "Replies and reports will be refused" : "Replies and reports allowed again" })
            })
          }
        />
        <Label htmlFor="preview-refuse-review-actions" className="text-xs font-normal">
          Refuse replies and reports, as for someone who isn&apos;t the owner
        </Label>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Reset sample reviews?"
        description="All simulated replies and reports on this preview server are discarded and the starting sample reviews come back."
        confirmLabel="Reset"
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await resetPreviewReviews()
            notifyActionResult(result, { success: "Sample reviews reset" })
            if (result.ok) setConfirm(false)
          })
        }
      />
    </div>
  )
}
