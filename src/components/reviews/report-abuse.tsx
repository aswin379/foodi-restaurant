"use client"

import { useEffect, useRef, useState } from "react"
import { Flag } from "lucide-react"

import { ActionResultMessage } from "@/components/shared/action-result-message"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ReasonPicker } from "@/components/shared/reason-picker"
import { Button } from "@/components/ui/button"
import { validateReasonSelection, type ReasonErrors, type ReasonSelection } from "@/lib/forms/reasons"
import { formatDateTime, type ZoneAndLocale } from "@/lib/orders/format"
import { REVIEW_REPORT_REASONS, reportReasonLabel } from "@/lib/reviews/reasons"
import type { ReviewReport } from "@/lib/reviews/types"

import { useReviewCommand } from "./use-review-command"

const emptySelection: ReasonSelection = { reason: null, note: "" }

/**
 * Report a review as abusive (R8). It sends a report and nothing more: the
 * review stays where it is, and nothing here says it was removed, hidden,
 * looked into or judged abusive. A report that already exists is shown as a
 * fact, with no second report control.
 */
export function ReportAbuse({
  reviewId,
  report,
  context,
}: {
  reviewId: string
  report: ReviewReport | null
  context: ZoneAndLocale
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const hadReport = useRef(report !== null)
  const command = useReviewCommand(reviewId)
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState<ReasonSelection>(emptySelection)
  const [errors, setErrors] = useState<ReasonErrors>({})

  // The Report button is replaced by the report's details once it's recorded: focus goes there.
  useEffect(() => {
    if (report !== null && !hadReport.current) statusRef.current?.focus()
    hadReport.current = report !== null
  }, [report])

  if (report) {
    return (
      <div
        ref={statusRef}
        tabIndex={-1}
        className="flex flex-col gap-1 rounded-2xl bg-background/70 px-4 py-3 text-sm outline-none ring-1 ring-border-soft focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <p className="font-medium">
          You reported this review <time dateTime={report.reportedAt}>{formatDateTime(report.reportedAt, context)}</time>
        </p>
        <p className="text-muted-foreground">
          Reason: {reportReasonLabel(report.reason)}
          {report.note ? ` (${report.note})` : null}
        </p>
        <p className="text-xs text-muted-foreground">
          A report isn&apos;t a moderation decision. This page keeps showing the review unless Foodi changes its status.
        </p>
      </div>
    )
  }

  const shown: ReasonErrors = {
    reason: errors.reason ?? command.fieldErrors.reason,
    note: errors.note ?? command.fieldErrors.note,
  }
  const failure = command.result && !command.result.ok && !shown.reason && !shown.note ? command.result : null

  const close = () => {
    setOpen(false)
    // The dialog has no trigger element of its own, so return focus to the button ourselves.
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        className="w-fit"
        onClick={() => {
          command.reset()
          setValue(emptySelection)
          setErrors({})
          setOpen(true)
        }}
      >
        <Flag aria-hidden />
        Report abuse
      </Button>
      <p className="text-xs text-muted-foreground">
        Use this for spam, abuse or other content that breaks the rules. The review stays visible unless Foodi changes it.
      </p>

      <ConfirmDialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        title="Report this review?"
        description="This sends a report about the review to Foodi. It doesn't hide or remove the review, and a report isn't a moderation decision."
        confirmLabel="Submit report"
        cancelLabel="Cancel"
        pending={command.pending}
        onConfirm={() => {
          const next = validateReasonSelection(value, REVIEW_REPORT_REASONS)
          setErrors(next)
          if (next.reason || next.note) return
          command.run(
            { type: "report_abuse", reason: value.reason!, note: value.note.trim() },
            "Report submitted",
            () => setOpen(false)
          )
        }}
      >
        <ReasonPicker
          legend="Why are you reporting this review?"
          options={REVIEW_REPORT_REASONS}
          value={value}
          onChange={(next) => {
            setValue(next)
            setErrors({})
          }}
          errors={shown}
          noteHint="Required for Other."
        />
        {failure ? <ActionResultMessage result={failure} successText="" /> : null}
      </ConfirmDialog>
    </div>
  )
}
