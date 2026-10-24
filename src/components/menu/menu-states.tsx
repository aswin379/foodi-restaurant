import Link from "next/link"
import { AlertTriangle, PlugZap, Plus, SearchX, UtensilsCrossed } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/dashboard/empty-state"
import { isServiceError } from "@/lib/data-source/errors"

const NOT_CONNECTED = {
  menu: { title: "Menu isn't connected yet", what: "menu items" },
  categories: { title: "Categories aren't connected yet", what: "categories" },
  meal_periods: { title: "Meal periods aren't connected yet", what: "meal periods" },
}

export function MenuNotConnected({ what = "menu" }: { what?: keyof typeof NOT_CONNECTED }) {
  return (
    <EmptyState
      icon={PlugZap}
      title={NOT_CONNECTED[what].title}
      description={`Your restaurant's ${NOT_CONNECTED[what].what} will appear here once the Foodi menu service is connected. Nothing is shown or saved until then.`}
      className="min-h-72 bg-card"
    />
  )
}

export function MenuError({ retryHref, what = "menu items" }: { retryHref: string; what?: string }) {
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
        Something went wrong while fetching them. Nothing has changed. Try again in a moment.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href={retryHref}>Try again</Link>
      </Button>
    </div>
  )
}

export function MenuEmpty() {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-10 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <UtensilsCrossed aria-hidden className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium">Your menu is empty</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
        Add the dishes and drinks customers can order. You can group them into
        categories, and give them sizes or option groups, like extras.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button asChild size="sm">
          <Link href="/menu/new">
            <Plus aria-hidden />
            Add your first item
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/menu/categories">Set up categories</Link>
        </Button>
      </div>
    </div>
  )
}

export function MenuNoResults({ clearHref }: { clearHref: string }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-10 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <SearchX aria-hidden className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium">No items match these filters</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
        Try another name, category or status.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href={clearHref}>Clear filters</Link>
      </Button>
    </div>
  )
}

export function MenuListSkeleton({ label = "Loading menu items" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 py-2">
          <Skeleton className="size-10 rounded-md" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-24 sm:block" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  )
}

/** Not connected for a missing API; otherwise a retryable error. Never fallback data. */
export function MenuLoadFailure({
  error,
  retryHref,
  what = "menu",
}: {
  error: unknown
  retryHref: string
  what?: "menu" | "categories" | "item" | "meal_periods"
}) {
  if (isServiceError(error) && error.kind === "not_configured") {
    return <MenuNotConnected what={what === "item" ? "menu" : what} />
  }
  return (
    <MenuError
      retryHref={retryHref}
      what={what === "categories" ? "categories" : what === "item" ? "this item" : what === "meal_periods" ? "meal periods" : "menu items"}
    />
  )
}
