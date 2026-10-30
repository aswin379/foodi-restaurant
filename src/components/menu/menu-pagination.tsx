import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { menuHref } from "@/lib/menu/query"
import type { MenuItemListQuery, MenuItemListResult } from "@/lib/menu/types"

export function MenuPagination({
  query,
  result,
}: {
  query: MenuItemListQuery
  result: MenuItemListResult
}) {
  if (result.totalPages <= 1) return null
  const hasPrevious = result.page > 1
  const hasNext = result.page < result.totalPages

  return (
    <nav aria-label="Menu items pagination" className="flex items-center justify-center gap-2 sm:justify-end">
      <PageLink href={hasPrevious ? menuHref(query, { page: result.page - 1 }) : null} label="Previous page">
        <ChevronLeft aria-hidden />
        Previous
      </PageLink>
      <span className="px-2 text-sm tabular-nums text-muted-foreground">
        Page {result.page} of {result.totalPages}
      </span>
      <PageLink href={hasNext ? menuHref(query, { page: result.page + 1 }) : null} label="Next page">
        Next
        <ChevronRight aria-hidden />
      </PageLink>
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
