"use client"

import { Loader2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

/**
 * Confirmation for consequential actions (cancel an order, archive an item).
 * The confirm button doesn't close the dialog by itself: the caller closes it
 * once the server has answered, so a failure stays visible in the dialog.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Go back",
  destructive = false,
  pending = false,
  onConfirm,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  /** While true the dialog can't be dismissed and the button shows progress. */
  pending?: boolean
  onConfirm: () => void
  /** Extra content, e.g. a ReasonPicker or an ActionResultMessage. */
  children?: React.ReactNode
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild={typeof description !== "string"}>
            {typeof description === "string" ? description : <div>{description}</div>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            // aria-disabled (not disabled) keeps focus on the button while pending.
            aria-disabled={pending || undefined}
            onClick={() => {
              if (!pending) onConfirm()
            }}
          >
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
