import { CircleAlert, CircleCheck, FlaskConical } from "lucide-react"

import { PREVIEW_ONLY_LABEL } from "@/lib/data-source/preview-copy"
import type { ActionResult } from "@/lib/data-source/result"
import { cn } from "@/lib/utils"

/**
 * Inline outcome of a form submission. Failures use role="alert"; successes
 * are announced politely. Simulated successes always carry the preview label.
 */
export function ActionResultMessage({
  result,
  successText,
  id,
  className,
}: {
  result: ActionResult<unknown> | null
  /** Describes what happened, e.g. "Order accepted". Never claims it was saved to Foodi. */
  successText: string
  id?: string
  className?: string
}) {
  if (!result) {
    // Keep an empty live region mounted so the first result is announced.
    return <div id={id} role="status" aria-live="polite" className="sr-only" />
  }

  if (!result.ok) {
    return (
      <div
        id={id}
        role="alert"
        className={cn(
          "flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive",
          className
        )}
      >
        <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        <p>{result.message}</p>
      </div>
    )
  }

  const Icon = result.preview ? FlaskConical : CircleCheck
  return (
    <div
      id={id}
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
        result.preview
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : "border-primary/30 bg-primary/5 text-foreground",
        className
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p>
        {successText}
        {result.preview ? (
          <>
            . <span className="font-semibold">{PREVIEW_ONLY_LABEL}.</span>
          </>
        ) : null}
      </p>
    </div>
  )
}
