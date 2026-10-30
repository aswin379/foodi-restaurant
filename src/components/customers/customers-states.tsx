import Link from "next/link"
import { AlertTriangle, Inbox, PlugZap, SearchX, ShieldAlert } from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CUSTOMERS_PATH } from "@/lib/customers/query"
import { isServiceError } from "@/lib/data-source/errors"

export function CustomersNotConnected() {
  return (
    <EmptyState
      icon={PlugZap}
      title="Customers aren't connected yet"
      description="Your customers will appear here once the Foodi customers service is connected. No customer data is shown until then."
      className="min-h-72 bg-card"
    />
  )
}

export function CustomersError({ retryHref, what = "customers" }: { retryHref: string; what?: string }) {
  return (
    <div
      role="alert"
      className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-10 text-center"
    >
      <span className="grid size-10 place-items-center rounded-full bg-red-50 text-red-600">
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

/** The backend decides who may see customers; a refusal is shown, never hidden. */
export function CustomersForbidden() {
  return (
    <div
      role="alert"
      className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card px-6 py-10 text-center"
    >
      <ShieldAlert aria-hidden className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">You don&apos;t have permission to see customers</p>
      <p className="max-w-sm text-xs text-muted-foreground">Ask the restaurant owner if you need access.</p>
    </div>
  )
}

export function CustomersEmpty() {
  return (
    <EmptyState
      icon={Inbox}
      title="No customers yet"
      description="Customers will appear here once they have ordered from your restaurant."
      className="min-h-72 bg-card"
    />
  )
}

export function CustomersNoResults({ clearHref = CUSTOMERS_PATH }: { clearHref?: string }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-10 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <SearchX aria-hidden className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium">No customers match this search</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">Check the spelling or try part of the name.</p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href={clearHref}>Clear search</Link>
      </Button>
    </div>
  )
}

/** C9: without an authoritative total, a page past the end is only known when it comes back empty. */
export function CustomersPastEnd({ firstPageHref }: { firstPageHref: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-10 text-center">
      <p className="text-sm font-medium">There is nothing on this page</p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href={firstPageHref}>Back to the first page</Link>
      </Button>
    </div>
  )
}

export function CustomersListSkeleton() {
  return (
    <div role="status" aria-label="Loading customers" className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 py-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-24 sm:block" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

export function CustomerDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading customer" className="flex flex-col gap-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
      </div>
    </div>
  )
}

/** Not connected for a missing API, a permission message for 403, otherwise a retryable error. Never sample data. */
export function CustomersLoadFailure({ error, retryHref, what }: { error: unknown; retryHref: string; what?: string }) {
  if (isServiceError(error) && error.kind === "not_configured") return <CustomersNotConnected />
  if (isServiceError(error) && error.kind === "forbidden") return <CustomersForbidden />
  return <CustomersError retryHref={retryHref} what={what} />
}
