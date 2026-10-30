import Link from "next/link"
import { AlertTriangle, Inbox, PlugZap, SearchX, ShieldAlert } from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { isServiceError } from "@/lib/data-source/errors"
import { PROMOTIONS_PATH } from "@/lib/promotions/query"

export function PromotionsNotConnected() {
  return (
    <EmptyState
      icon={PlugZap}
      title="Promotions aren't connected yet"
      description="Your coupons will appear here once the Foodi promotions service is connected. No coupon details are shown until then."
      className="min-h-72 rounded-3xl border-border bg-card"
    />
  )
}

export function PromotionsError({ retryHref, what = "coupons" }: { retryHref: string; what?: string }) {
  return (
    <div
      role="alert"
      className="flex min-h-72 flex-col items-center justify-center rounded-3xl bg-card px-6 py-10 text-center shadow-[0_8px_30px_rgb(31_26_23/6%)]"
    >
      <span className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger-foreground">
        <AlertTriangle aria-hidden className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium">We couldn&apos;t load {what}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
        Something went wrong while fetching {what}. Nothing has changed. Try again in a moment.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href={retryHref}>Try again</Link>
      </Button>
    </div>
  )
}

/** The backend decides who may see coupons; a refusal is shown, never hidden. */
export function PromotionsForbidden() {
  return (
    <div
      role="alert"
      className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-3xl bg-card px-6 py-10 text-center shadow-[0_8px_30px_rgb(31_26_23/6%)]"
    >
      <ShieldAlert aria-hidden className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">You don&apos;t have permission to see promotions</p>
      <p className="max-w-sm text-xs text-muted-foreground">Ask the restaurant owner if you need access.</p>
    </div>
  )
}

export function PromotionsEmpty() {
  return (
    <EmptyState
      icon={Inbox}
      title="No coupons yet"
      description="Coupons will appear here once Foodi has set them up for your restaurant."
      className="min-h-72 rounded-3xl border-border bg-card"
    />
  )
}

export function PromotionsNoResults({ clearHref = PROMOTIONS_PATH }: { clearHref?: string }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl bg-card px-6 py-10 text-center shadow-[0_8px_30px_rgb(31_26_23/6%)]">
      <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
        <SearchX aria-hidden className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium">No coupons have this status</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">Try another status.</p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href={clearHref}>Reset filter</Link>
      </Button>
    </div>
  )
}

/** Without an authoritative total, a page past the end is only known when it comes back empty. */
export function PromotionsPastEnd({ firstPageHref }: { firstPageHref: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-3xl bg-card px-6 py-10 text-center shadow-[0_8px_30px_rgb(31_26_23/6%)]">
      <p className="text-sm font-medium">There is nothing on this page</p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href={firstPageHref}>Back to the first page</Link>
      </Button>
    </div>
  )
}

export function PromotionsListSkeleton() {
  return (
    <div role="status" aria-label="Loading coupons" className="flex flex-col gap-2 rounded-3xl bg-card p-5 shadow-[0_8px_30px_rgb(31_26_23/6%)]">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 py-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-24 sm:block" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function PromotionDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading coupon" className="flex flex-col gap-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-52 rounded-3xl" />
        <Skeleton className="h-52 rounded-3xl" />
      </div>
    </div>
  )
}

/** Not connected for a missing API, a permission message for 403, otherwise a retryable error. Never sample data. */
export function PromotionsLoadFailure({ error, retryHref, what }: { error: unknown; retryHref: string; what?: string }) {
  if (isServiceError(error) && error.kind === "not_configured") return <PromotionsNotConnected />
  if (isServiceError(error) && error.kind === "forbidden") return <PromotionsForbidden />
  return <PromotionsError retryHref={retryHref} what={what} />
}
