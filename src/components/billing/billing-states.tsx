import Link from "next/link"
import { AlertTriangle, FileQuestion, PlugZap, ShieldAlert } from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { isServiceError } from "@/lib/data-source/errors"

export function BillingNotConnected() {
  return (
    <EmptyState
      icon={PlugZap}
      title="Billing isn't connected yet"
      description="Your plan and fees will appear here once the Foodi billing service is connected. No plan or fee details are shown until then."
      className="min-h-72 rounded-3xl border-border bg-card"
    />
  )
}

/** The source has no plan for this restaurant. It is not an error and nothing is assumed. */
export function NoPlan() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="No plan found"
      description="We couldn't find a plan for your restaurant. If you expected one, contact Foodi support."
      className="min-h-72 rounded-3xl border-border bg-card"
    />
  )
}

export function BillingError({ retryHref }: { retryHref: string }) {
  return (
    <div
      role="alert"
      className="flex min-h-72 flex-col items-center justify-center rounded-3xl bg-card px-6 py-10 text-center shadow-[0_8px_30px_rgb(31_26_23/6%)]"
    >
      <span className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger-foreground">
        <AlertTriangle aria-hidden className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium">We couldn&apos;t load your plan</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
        Something went wrong while fetching your plan. Nothing has changed. Try again in a moment.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href={retryHref}>Try again</Link>
      </Button>
    </div>
  )
}

/** The backend decides who may see billing; a refusal is shown, never hidden. */
export function BillingForbidden() {
  return (
    <div
      role="alert"
      className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-3xl bg-card px-6 py-10 text-center shadow-[0_8px_30px_rgb(31_26_23/6%)]"
    >
      <ShieldAlert aria-hidden className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">You don&apos;t have permission to see billing</p>
      <p className="max-w-sm text-xs text-muted-foreground">Plan and billing details are for the restaurant owner. Ask them if you need access.</p>
    </div>
  )
}

export function BillingSkeleton() {
  return (
    <div role="status" aria-label="Loading plan" className="flex flex-col gap-6">
      <Skeleton className="h-28 rounded-3xl" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    </div>
  )
}

/** Not connected for a missing API, a permission message for 403, otherwise a retryable error. Never sample data. */
export function BillingLoadFailure({ error, retryHref }: { error: unknown; retryHref: string }) {
  if (isServiceError(error) && error.kind === "not_configured") return <BillingNotConnected />
  if (isServiceError(error) && error.kind === "forbidden") return <BillingForbidden />
  return <BillingError retryHref={retryHref} />
}
