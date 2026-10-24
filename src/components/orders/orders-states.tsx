import Link from "next/link"
import { AlertTriangle, Inbox, PlugZap, SearchX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/dashboard/empty-state"
import { isServiceError } from "@/lib/data-source/errors"

export function OrdersNotConnected() {
  return (
    <EmptyState
      icon={PlugZap}
      title="Orders aren't connected yet"
      description="Your restaurant's orders will appear here once the Foodi orders service is connected. No order data is shown until then."
      className="min-h-72 bg-card"
    />
  )
}

export function OrdersError({ retryHref }: { retryHref: string }) {
  return (
    <div
      role="alert"
      className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-10 text-center"
    >
      <span className="grid size-10 place-items-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle aria-hidden className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium">We couldn&apos;t load orders</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
        Something went wrong while fetching orders. Nothing has changed. Try
        again in a moment.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href={retryHref}>Try again</Link>
      </Button>
    </div>
  )
}

export function OrdersEmpty() {
  return (
    <EmptyState
      icon={Inbox}
      title="No orders yet"
      description="New orders will appear here as soon as customers place them."
      className="min-h-72 bg-card"
    />
  )
}

export function OrdersNoResults({ clearHref }: { clearHref: string }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-10 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <SearchX aria-hidden className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium">No orders match these filters</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
        Try another status, reference or date range.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href={clearHref}>Clear filters</Link>
      </Button>
    </div>
  )
}

export function OrdersListSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading orders"
      className="flex flex-col gap-2 rounded-xl border bg-card p-4"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 py-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="hidden h-4 w-24 sm:block" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  )
}

/** Not connected for a missing API; otherwise a retryable error. Never fallback data. */
export function OrdersLoadFailure({ error, retryHref }: { error: unknown; retryHref: string }) {
  return isServiceError(error) && error.kind === "not_configured" ? (
    <OrdersNotConnected />
  ) : (
    <OrdersError retryHref={retryHref} />
  )
}

export function OrdersBoardSkeleton() {
  return (
    <div role="status" aria-label="Loading orders" className="grid gap-5 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, column) => (
        <div key={column} className="flex flex-col gap-3 rounded-2xl border bg-muted/40 p-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ))}
    </div>
  )
}
