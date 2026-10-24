import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ordersHref } from "@/lib/orders/query"
import type { OrderListQuery, OrderListResult } from "@/lib/orders/types"

export function OrdersPagination({
  query,
  result,
}: {
  query: OrderListQuery
  result: OrderListResult
}) {
  const first = (result.page - 1) * result.pageSize + 1
  const last = first + result.items.length - 1
  const hasPrevious = result.page > 1
  const hasNext = result.page < result.totalPages

  return (
    <nav
      aria-label="Orders pagination"
      className="flex flex-col items-center justify-between gap-3 sm:flex-row"
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing {first}–{last} of {result.totalItems} orders
      </p>
      <div className="flex items-center gap-2">
        <PageLink
          href={hasPrevious ? ordersHref(query, { page: result.page - 1 }) : null}
          label="Previous page"
        >
          <ChevronLeft aria-hidden />
          Previous
        </PageLink>
        <span className="px-2 text-sm tabular-nums text-muted-foreground">
          Page {result.page} of {result.totalPages}
        </span>
        <PageLink
          href={hasNext ? ordersHref(query, { page: result.page + 1 }) : null}
          label="Next page"
        >
          Next
          <ChevronRight aria-hidden />
        </PageLink>
      </div>
    </nav>
  )
}

function PageLink({
  href,
  label,
  children,
}: {
  href: string | null
  label: string
  children: React.ReactNode
}) {
  if (!href) {
    return (
      <Button variant="outline" size="sm" disabled aria-label={label}>
        {children}
      </Button>
    )
  }
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href} aria-label={label}>
        {children}
      </Link>
    </Button>
  )
}
