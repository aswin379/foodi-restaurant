import Link from "next/link"

import { hasActiveReviewFilters, REVIEWS_PATH, reviewsHref } from "@/lib/reviews/query"
import { REVIEW_RATINGS, type ReviewListQuery, type ReviewRepliedFilter } from "@/lib/reviews/types"
import { cn } from "@/lib/utils"

const ratingTabs = [
  { value: "all" as const, label: "All ratings" },
  ...[...REVIEW_RATINGS].reverse().map((rating) => ({ value: rating, label: rating === 1 ? "1 star" : `${rating} stars` })),
]

const repliedTabs: { value: ReviewRepliedFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "replied", label: "Replied" },
  { value: "unreplied", label: "Not replied" },
]

/**
 * Filters are plain links, so they work before hydration and every filtered
 * view has a shareable URL. Changing a filter returns to page 1.
 */
export function ReviewsToolbar({ query }: { query: ReviewListQuery }) {
  return (
    <div className="flex flex-col gap-3">
      <FilterTabs label="Filter reviews by rating">
        {ratingTabs.map((tab) => (
          <FilterTab
            key={tab.value}
            href={reviewsHref(query, { rating: tab.value, page: 1 })}
            active={query.rating === tab.value}
            label={tab.label}
          />
        ))}
      </FilterTabs>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <FilterTabs label="Filter reviews by reply status">
          {repliedTabs.map((tab) => (
            <FilterTab
              key={tab.value}
              href={reviewsHref(query, { replied: tab.value, page: 1 })}
              active={query.replied === tab.value}
              label={tab.label}
            />
          ))}
        </FilterTabs>
        {hasActiveReviewFilters(query) ? (
          <Link
            href={REVIEWS_PATH}
            className="rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Reset filters
          </Link>
        ) : null}
      </div>
    </div>
  )
}

function FilterTabs({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto px-1 pb-1">
      <ul className="flex w-max gap-1 rounded-lg border bg-card p-1">{children}</ul>
    </nav>
  )
}

function FilterTab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
          active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {label}
      </Link>
    </li>
  )
}
