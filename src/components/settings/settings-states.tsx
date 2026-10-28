import Link from "next/link"
import { AlertTriangle, PlugZap, ShieldAlert } from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { isServiceError } from "@/lib/data-source/errors"

export function SettingsNotConnected() {
  return (
    <EmptyState
      icon={PlugZap}
      title="Settings aren't connected yet"
      description="Your restaurant profile and order settings will appear here once the Foodi restaurant service is connected. Nothing is shown or saved until then."
      className="min-h-72 bg-card"
    />
  )
}

export function SettingsError({ retryHref }: { retryHref: string }) {
  return (
    <div role="alert" className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-10 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle aria-hidden className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium">We couldn&apos;t load your settings</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
        Something went wrong while fetching them. Nothing has changed. Try again in a moment.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href={retryHref}>Try again</Link>
      </Button>
    </div>
  )
}

/** D9: the backend decides who may see or change settings; a refusal is shown, never hidden. */
export function SettingsForbidden() {
  return (
    <div role="alert" className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card px-6 py-10 text-center">
      <ShieldAlert aria-hidden className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">You don&apos;t have permission to see or change restaurant settings</p>
      <p className="max-w-sm text-xs text-muted-foreground">Only the restaurant owner can. Ask them if something needs changing.</p>
    </div>
  )
}

/** Not connected for a missing API, a permission message for 403, otherwise a retryable error. Never sample data. */
export function SettingsLoadFailure({ error, retryHref }: { error: unknown; retryHref: string }) {
  if (isServiceError(error) && error.kind === "not_configured") return <SettingsNotConnected />
  if (isServiceError(error) && error.kind === "forbidden") return <SettingsForbidden />
  return <SettingsError retryHref={retryHref} />
}

export function SettingsSkeleton({ label = "Loading settings" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  )
}
