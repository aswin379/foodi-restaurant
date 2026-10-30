"use client"

import { useState, useTransition } from "react"
import { RotateCcw } from "lucide-react"

import { resetPreviewSettings, setPreviewSaveRefusal } from "@/app/(dashboard)/settings/actions"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { notifyActionResult } from "@/components/shared/notifications"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

/**
 * Preview-only reset. Rendered only in preview mode, and the Server Action
 * behind it refuses to run outside it.
 */
export function PreviewSettingsControls({ refusesSaves }: { refusesSaves: boolean }) {
  const [pending, startTransition] = useTransition()
  const [refusalPending, startRefusal] = useTransition()
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Preview tools">
      <span className="text-xs font-medium tracking-wide text-warning-foreground uppercase">Preview tools</span>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm(true)}>
        <RotateCcw aria-hidden />
        Reset sample settings
      </Button>
      <div className="flex items-center gap-2">
        <Switch
          id="preview-refuse-saves"
          checked={refusesSaves}
          aria-disabled={refusalPending || undefined}
          onCheckedChange={(refuseSaves) =>
            !refusalPending &&
            startRefusal(async () => {
              const result = await setPreviewSaveRefusal({ refuseSaves })
              notifyActionResult(result, { success: refuseSaves ? "Saves will be refused" : "Saves allowed again" })
            })
          }
        />
        <Label htmlFor="preview-refuse-saves" className="text-xs font-normal">
          Refuse saves, as for someone who isn&apos;t the owner
        </Label>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Reset sample settings?"
        description="All simulated changes to the profile and order settings on this preview server are discarded and the starting sample settings come back."
        confirmLabel="Reset"
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await resetPreviewSettings()
            notifyActionResult(result, { success: "Sample settings reset" })
            if (result.ok) setConfirm(false)
          })
        }
      />
    </div>
  )
}
