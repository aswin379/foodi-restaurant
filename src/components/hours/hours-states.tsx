import Link from "next/link"
import { AlertTriangle, PlugZap } from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { isServiceError } from "@/lib/data-source/errors"

export function HoursNotConnected({ compact = false }: { compact?: boolean }) {
  return (
    <EmptyState
      icon={PlugZap}
      title="Hours aren't connected yet"
      description="Your opening hours, special dates and pause status will appear here once the Foodi hours service is connected. Nothing is shown or saved until then."
      className={compact ? "min-h-40 bg-card" : "min-h-72 bg-card"}
    />
  )
}

export function HoursError({ retryHref, compact = false }: { retryHref: string; compact?: boolean }) {
  return (
    <div
      role="alert"
      className={`flex ${compact ? "min-h-40" : "min-h-72"} flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-10 text-center`}
    >
      <span className="grid size-10 place-items-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle aria-hidden className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium">We couldn&apos;t load your hours</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
        Something went wrong while fetching them. Nothing has changed. Try again in a moment.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href={retryHref}>Try again</Link>
      </Button>
    </div>
  )
}

/** Not connected for a missing API, a permission message for 403, otherwise a retryable error. Never sample data. */
export function HoursLoadFailure({ error, retryHref, compact = false }: { error: unknown; retryHref: string; compact?: boolean }) {
  if (isServiceError(error) && error.kind === "not_configured") return <HoursNotConnected compact={compact} />
  if (isServiceError(error) && error.kind === "forbidden") {
    return (
      <div role="alert" className="rounded-lg border border-dashed bg-card px-6 py-10 text-center text-sm">
        You don&apos;t have permission to see or change opening hours.
      </div>
    )
  }
  return <HoursError retryHref={retryHref} compact={compact} />
}

export function HoursSkeleton({ label = "Loading hours" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 py-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 flex-1" />
        </div>
      ))}
    </div>
  )
}
