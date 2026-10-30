import Link from "next/link"
import { AlertTriangle, PlugZap, ShieldAlert, type LucideIcon } from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"
import { Button } from "@/components/ui/button"
import { isServiceError } from "@/lib/data-source/errors"

const surface = "rounded-3xl bg-card shadow-[0_8px_30px_rgb(31_26_23/6%)]"

/** The standard not-connected, forbidden and error states for modules without a backend yet. */
export function OpsLoadFailure({
  error,
  retryHref,
  icon = PlugZap,
  what,
}: {
  error: unknown
  retryHref: string
  icon?: LucideIcon
  /** Plain-language name, e.g. "Tables" or "Staff and roles". */
  what: string
}) {
  if (isServiceError(error) && error.kind === "not_configured") {
    return (
      <EmptyState
        icon={icon}
        title={`${what} aren't connected yet`}
        description={`${what} will appear here once the Foodi service for them is connected. Nothing is shown or saved until then.`}
        className="min-h-72 rounded-3xl border-border bg-card"
      />
    )
  }
  if (isServiceError(error) && error.kind === "forbidden") {
    return (
      <div role="alert" className={`${surface} flex min-h-40 flex-col items-center justify-center gap-3 px-6 py-10 text-center text-sm`}>
        <span className="grid size-11 place-items-center rounded-full bg-warning-soft text-warning-foreground">
          <ShieldAlert aria-hidden className="size-5" />
        </span>
        You don&apos;t have permission to see {what.toLowerCase()}.
      </div>
    )
  }
  return (
    <div role="alert" className={`${surface} flex min-h-72 flex-col items-center justify-center px-6 py-10 text-center`}>
      <span className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger-foreground">
        <AlertTriangle aria-hidden className="size-5" />
      </span>
      <p className="mt-3 text-sm font-semibold">We couldn&apos;t load {what.toLowerCase()}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">Something went wrong while fetching them. Nothing has changed. Try again in a moment.</p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href={retryHref}>Try again</Link>
      </Button>
    </div>
  )
}
