import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { PageInfo } from "@/lib/wallet/types"

/**
 * Previous and next links for a settlement list or an order breakdown. A total
 * is shown only when the source supplies one. Without it, only the rows on this
 * page and the source's own "has next page" answer are said, and nothing is
 * guessed.
 */
export function WalletPagination({
  label,
  noun,
  nounPlural,
  page,
  itemCount,
  hrefFor,
}: {
  label: string
  noun: string
  nounPlural: string
  page: PageInfo
  itemCount: number
  hrefFor: (page: number) => string
}) {
  const first = (page.page - 1) * page.pageSize + 1
  const last = first + itemCount - 1
  const range = itemCount > 0 ? `${first}–${last}` : "none"
  const showing =
    page.totalItems !== null
      ? `Showing ${range} of ${page.totalItems} ${page.totalItems === 1 ? noun : nounPlural}`
      : `Showing ${range} on this page`

  return (
    <nav aria-label={label} className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {showing}
      </p>
      <div className="flex items-center gap-2">
        <PageLink href={page.page > 1 ? hrefFor(page.page - 1) : null} label="Previous page">
          <ChevronLeft aria-hidden />
          Previous
        </PageLink>
        <span className="px-2 text-sm text-muted-foreground tabular-nums">
          {page.totalPages !== null ? `Page ${page.page} of ${page.totalPages}` : `Page ${page.page}`}
        </span>
        <PageLink href={page.hasNextPage ? hrefFor(page.page + 1) : null} label="Next page">
          Next
          <ChevronRight aria-hidden />
        </PageLink>
      </div>
    </nav>
  )
}

function PageLink({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
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
