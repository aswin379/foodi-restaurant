import Link from "next/link"
import { AlertTriangle, Inbox, PlugZap, SearchX, ShieldAlert } from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { isServiceError } from "@/lib/data-source/errors"
import { REVIEWS_PATH } from "@/lib/reviews/query"

export function ReviewsNotConnected() {
  return (
    <EmptyState
      icon={PlugZap}
      title="Reviews aren't connected yet"
      description="Your customers' reviews will appear here once the Foodi reviews service is connected. No review data is shown until then."
      className="min-h-72 bg-card"
    />
  )
}

export function ReviewsError({ retryHref }: { retryHref: string }) {
  return (
    <div
      role="alert"
      className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-10 text-center"
    >
      <span className="grid size-10 place-items-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle aria-hidden className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium">We couldn&apos;t load reviews</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
        Something went wrong while fetching reviews. Nothing has changed. Try again in a moment.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href={retryHref}>Try again</Link>
      </Button>
    </div>
  )
}

/** R9: the backend decides who may see reviews; a refusal is shown, never hidden. */
export function ReviewsForbidden() {
  return (
    <div
      role="alert"
      className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card px-6 py-10 text-center"
    >
      <ShieldAlert aria-hidden className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">You don&apos;t have permission to see or answer reviews</p>
      <p className="max-w-sm text-xs text-muted-foreground">Only the restaurant owner can. Ask them if something needs doing.</p>
    </div>
  )
}

export function ReviewsEmpty() {
  return (
    <EmptyState
      icon={Inbox}
      title="No reviews yet"
      description="Reviews will appear here once customers start leaving them."
      className="min-h-72 bg-card"
    />
  )
}

export function ReviewsNoResults({ clearHref = REVIEWS_PATH }: { clearHref?: string }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-10 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <SearchX aria-hidden className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium">No reviews match these filters</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">Try another rating or reply status.</p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href={clearHref}>Reset filters</Link>
      </Button>
    </div>
  )
}

export function ReviewsListSkeleton() {
  return (
    <div role="status" aria-label="Loading reviews" className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 py-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-24 sm:block" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function ReviewDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading review" className="flex flex-col gap-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}

/** Not connected for a missing API, a permission message for 403, otherwise a retryable error. Never sample data. */
export function ReviewsLoadFailure({ error, retryHref }: { error: unknown; retryHref: string }) {
  if (isServiceError(error) && error.kind === "not_configured") return <ReviewsNotConnected />
  if (isServiceError(error) && error.kind === "forbidden") return <ReviewsForbidden />
  return <ReviewsError retryHref={retryHref} />
}
