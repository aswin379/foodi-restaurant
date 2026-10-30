import Link from "next/link"
import { AlertTriangle, Inbox, PlugZap, ShieldAlert } from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { isServiceError } from "@/lib/data-source/errors"

export function WalletNotConnected() {
  return (
    <EmptyState
      icon={PlugZap}
      title="Wallet isn't connected yet"
      description="Your earnings and settlements will appear here once the Foodi settlements service is connected. No financial figures are shown until then."
      className="min-h-72 bg-card"
    />
  )
}

export function WalletError({ retryHref, what = "wallet" }: { retryHref: string; what?: string }) {
  return (
    <div
      role="alert"
      className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-10 text-center"
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

/** The backend decides who may see financial data; a refusal is shown, never hidden. */
export function WalletForbidden() {
  return (
    <div
      role="alert"
      className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card px-6 py-10 text-center"
    >
      <ShieldAlert aria-hidden className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">You don&apos;t have permission to see the wallet</p>
      <p className="max-w-sm text-xs text-muted-foreground">Earnings and settlements are for the restaurant owner. Ask them if you need access.</p>
    </div>
  )
}

export function SettlementsEmpty() {
  return (
    <EmptyState
      icon={Inbox}
      title="No settlements yet"
      description="Settlements will appear here once Foodi has created them for your restaurant."
      className="min-h-48 bg-card"
    />
  )
}

/** Without an authoritative total, a page past the end is only known when it comes back empty. */
export function SettlementsPastEnd({ firstPageHref }: { firstPageHref: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-10 text-center">
      <p className="text-sm font-medium">There is nothing on this page</p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href={firstPageHref}>Back to the first page</Link>
      </Button>
    </div>
  )
}

export function WalletSkeleton({ label = "Loading wallet" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      {Array.from({ length: 5 }, (_, index) => (
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

export function SettlementDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading settlement" className="flex flex-col gap-6">
      <Skeleton className="h-8 w-72" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
      </div>
    </div>
  )
}

/** Not connected for a missing API, a permission message for 403, otherwise a retryable error. Never sample data. */
export function WalletLoadFailure({ error, retryHref, what }: { error: unknown; retryHref: string; what?: string }) {
  if (isServiceError(error) && error.kind === "not_configured") return <WalletNotConnected />
  if (isServiceError(error) && error.kind === "forbidden") return <WalletForbidden />
  return <WalletError retryHref={retryHref} what={what} />
}
