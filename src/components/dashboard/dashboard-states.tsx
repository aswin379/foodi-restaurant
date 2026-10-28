import Link from "next/link"
import { AlertTriangle, FlaskConical, PlugZap, ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { isServiceError } from "@/lib/data-source/errors"

// Compact states for dashboard sections (B5a). Each section loads and fails
// on its own; none of them ever shows sample data in place of real data.

export function SectionSkeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  )
}

/** "Orders aren't connected yet", a permission refusal, or a retryable error. */
export function SectionFailure({ error, what, retryHref }: { error: unknown; what: string; retryHref: string }) {
  if (isServiceError(error) && error.kind === "not_configured") {
    return (
      <p className="flex items-start gap-2 rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
        <PlugZap aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          {capitalize(what)} {what.endsWith("s") ? "aren't" : "isn't"} connected yet. Nothing is shown until the Foodi
          service is connected.
        </span>
      </p>
    )
  }
  if (isServiceError(error) && error.kind === "forbidden") {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-md border border-dashed px-3 py-3 text-sm">
        <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        You don&apos;t have permission to see {what}.
      </p>
    )
  }
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed px-3 py-3 text-sm">
      <span className="flex items-center gap-2">
        <AlertTriangle aria-hidden className="size-4 shrink-0 text-red-600" />
        We couldn&apos;t load {what}. Nothing has changed.
      </span>
      <Button asChild variant="outline" size="sm">
        <Link href={retryHref}>Try again</Link>
      </Button>
    </div>
  )
}

/**
 * Marks a section's figures as preview data and names where they come from
 * (e.g. "sample orders"); counts worked out in preview are an estimate.
 */
export function PreviewDataBadge({ source, estimate = false }: { source: string; estimate?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900">
      <FlaskConical aria-hidden className="size-3" />
      {estimate ? `Preview estimate from ${source}` : `Preview: ${source}`}
    </span>
  )
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
