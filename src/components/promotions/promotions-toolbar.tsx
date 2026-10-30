import Link from "next/link"

import { PROMOTIONS_PATH, hasActivePromotionFilter, promotionsHref } from "@/lib/promotions/query"
import { PROMOTION_STATUS_FILTERS, promotionStatusLabels, type PromotionListQuery, type PromotionStatusFilter } from "@/lib/promotions/types"
import { cn } from "@/lib/utils"

const label = (status: PromotionStatusFilter) => (status === "all" ? "All" : promotionStatusLabels[status])

/**
 * The status filter is plain links, so it works before hydration and every
 * filtered view has a shareable URL. Changing the filter returns to page 1.
 */
export function PromotionsToolbar({ query }: { query: PromotionListQuery }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <nav aria-label="Filter coupons by status" className="">
        <ul className="flex w-fit max-w-full flex-wrap gap-1 rounded-3xl bg-card p-1 shadow-[0_4px_14px_rgb(31_26_23/8%)]">
          {PROMOTION_STATUS_FILTERS.map((status) => (
            <li key={status}>
              <Link
                href={promotionsHref(query, { status, page: 1 })}
                aria-current={query.status === status ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  query.status === status
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {label(status)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {hasActivePromotionFilter(query) ? (
        <Link
          href={PROMOTIONS_PATH}
          className="rounded-sm text-sm font-medium text-primary-text underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Reset filter
        </Link>
      ) : null}
    </div>
  )
}
