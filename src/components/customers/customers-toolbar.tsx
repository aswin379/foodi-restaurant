import Link from "next/link"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CUSTOMERS_PATH, CUSTOMER_SEARCH_MAX_LENGTH, customersHref, hasActiveCustomerSearch } from "@/lib/customers/query"
import {
  CUSTOMER_SORTS,
  DEFAULT_CUSTOMER_SORT,
  customerSortLabels,
  type CustomerListQuery,
  type CustomerSort,
} from "@/lib/customers/types"
import { cn } from "@/lib/utils"

/**
 * Search is a plain GET form and sorting is plain links, so both work before
 * hydration and every view has a shareable URL. Changing either returns to
 * page 1. A sort the source doesn't reliably support is disabled (C8, C9).
 */
export function CustomersToolbar({
  query,
  supportedSorts,
}: {
  query: CustomerListQuery
  /** Null while unknown (the list failed or is loading): every sort is then offered. */
  supportedSorts: CustomerSort[] | null
}) {
  return (
    <div className="flex flex-col gap-3">
      <form action={CUSTOMERS_PATH} method="get" role="search" className="flex max-w-xl items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="customer-search">Search customers by name</Label>
          <Input
            id="customer-search"
            name="q"
            type="search"
            defaultValue={query.search}
            maxLength={CUSTOMER_SEARCH_MAX_LENGTH}
            autoComplete="off"
            placeholder="Name"
          />
        </div>
        {query.sort !== DEFAULT_CUSTOMER_SORT ? <input type="hidden" name="sort" value={query.sort} /> : null}
        <Button type="submit">
          <Search aria-hidden />
          Search
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <nav aria-label="Sort customers" className="-mx-1 overflow-x-auto px-1 pb-1">
          <ul className="flex w-max gap-1 rounded-lg border bg-card p-1">
            {CUSTOMER_SORTS.map((sort) => (
              <SortTab
                key={sort}
                label={customerSortLabels[sort]}
                active={query.sort === sort}
                href={supportedSorts === null || supportedSorts.includes(sort) ? customersHref(query, { sort, page: 1 }) : null}
              />
            ))}
          </ul>
        </nav>
        {hasActiveCustomerSearch(query) ? (
          <Link
            href={customersHref({ search: "", sort: query.sort, page: 1 })}
            className="rounded-sm text-sm font-medium text-primary-text underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Clear search
          </Link>
        ) : null}
      </div>
    </div>
  )
}

const tabClass =
  "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

function SortTab({ href, active, label }: { href: string | null; active: boolean; label: string }) {
  if (href === null) {
    return (
      <li>
        <span aria-disabled="true" title="Not available from this source" className={cn(tabClass, "cursor-not-allowed text-muted-foreground/60")}>
          {label}
        </span>
      </li>
    )
  }
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(tabClass, active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
      >
        {label}
      </Link>
    </li>
  )
}
