import Link from "next/link"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { orderStatusLabels } from "@/lib/orders/lifecycle"
import { hasActiveFilters, ORDER_HISTORY_PATH, ordersHref } from "@/lib/orders/query"
import { ORDER_STATUSES, type OrderListQuery } from "@/lib/orders/types"
import { cn } from "@/lib/utils"

const statusTabs = [
  { value: "all" as const, label: "All" },
  ...ORDER_STATUSES.map((status) => ({ value: status, label: orderStatusLabels[status] })),
]

/**
 * Filters are plain links and a GET form, so they work before hydration and
 * every filtered view has a shareable URL.
 */
export function OrdersToolbar({ query }: { query: OrderListQuery }) {
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Filter orders by status" className="-mx-1 overflow-x-auto px-1 pt-1 pb-4">
        <ul className="flex w-max gap-1 rounded-full bg-card p-1 shadow-[0_4px_14px_rgb(31_26_23/8%)]">
          {statusTabs.map((tab) => {
            const active = query.status === tab.value
            return (
              <li key={tab.value}>
                <Link
                  href={ordersHref(query, { status: tab.value, page: 1 })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    active
                      ? "bg-primary text-primary-foreground shadow-[0_6px_14px_rgb(214_63_8/25%)]"
                      : "text-muted-foreground hover:bg-primary-faint hover:text-foreground"
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <form
        action={ORDER_HISTORY_PATH}
        method="get"
        role="search"
        aria-label="Search and filter orders"
        className="grid gap-4 rounded-3xl bg-card p-5 shadow-[0_8px_30px_rgb(31_26_23/6%)] sm:grid-cols-2 sm:p-6 lg:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))_auto] lg:items-end"
      >
        {query.status !== "all" ? (
          <input type="hidden" name="status" value={query.status} />
        ) : null}
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="orders-search">Order reference</Label>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="orders-search"
              name="q"
              type="search"
              defaultValue={query.search}
              placeholder="Search by order reference"
              autoComplete="off"
              maxLength={60}
              className="h-10 bg-background pl-9"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="orders-from">From</Label>
          <Input
            id="orders-from"
            name="from"
            type="date"
            defaultValue={query.from ?? ""}
            className="h-10 bg-background"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="orders-to">To</Label>
          <Input
            id="orders-to"
            name="to"
            type="date"
            defaultValue={query.to ?? ""}
            className="h-10 bg-background"
          />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <Button type="submit" className="h-10 flex-1 lg:flex-none">
            Apply
          </Button>
          {hasActiveFilters(query) ? (
            <Button asChild variant="ghost" className="h-10">
              <Link href={ordersHref({ ...query, search: "", from: null, to: null, page: 1 })}>
                Clear
              </Link>
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  )
}
