import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { reviewHref } from "@/lib/reviews/query"
import type { Review, ReviewListQuery } from "@/lib/reviews/types"
import { formatDate, type ZoneAndLocale } from "@/lib/orders/format"

import { ModerationBadge, ReplyStatusBadge, ReportedBadge } from "./review-badges"
import { RatingStars } from "./rating-stars"

const reviewerOf = (review: Review) => review.reviewerName ?? "Name not shared"

/** R2: a review with no text says so, instead of showing an empty row. */
export function ReviewText({ review, clamp = true }: { review: Pick<Review, "text">; clamp?: boolean }) {
  if (review.text === null) {
    return <span className="text-muted-foreground italic">Rating only, no written review</span>
  }
  return <span className={clamp ? "line-clamp-2" : "whitespace-pre-wrap"}>{review.text}</span>
}

/** Table from md up, cards below, both rendered from the same reviews. */
export function ReviewsList({
  reviews,
  query,
  context,
}: {
  reviews: Review[]
  /** The list's filters, carried to the detail page so "back" returns to the same view. */
  query: ReviewListQuery
  context: ZoneAndLocale
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-3xl bg-card shadow-[0_8px_30px_rgb(31_26_23/6%)] lg:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Rating</TableHead>
              <TableHead>Review</TableHead>
              <TableHead>Reviewer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-6 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.map((review) => (
              <TableRow key={review.id} className="h-[4.5rem]">
                <TableCell className="pl-6">
                  <RatingStars rating={review.rating} />
                </TableCell>
                <TableCell className="max-w-72 whitespace-normal lg:max-w-md">
                  <ReviewText review={review} />
                </TableCell>
                <TableCell>{reviewerOf(review)}</TableCell>
                <TableCell className="text-muted-foreground">
                  <time dateTime={review.createdAt}>{formatDate(review.createdAt, context)}</time>
                </TableCell>
                <TableCell>
                  <span className="flex flex-wrap gap-1.5">
                    <ReplyStatusBadge review={review} />
                    <ModerationBadge review={review} />
                    <ReportedBadge review={review} />
                  </span>
                </TableCell>
                <TableCell className="pr-6 text-right">
                  <Link
                    href={reviewHref(review.id, query)}
                    className="inline-flex items-center gap-2 rounded-full text-sm font-semibold text-primary-text outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    View{" "}
                    <span className="sr-only">review by {reviewerOf(review)}</span>
                    <span aria-hidden className="grid size-7 place-items-center rounded-full bg-primary-soft"><ArrowRight className="size-3.5" /></span>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
        {reviews.map((review) => (
          <li key={review.id}>
            <Link
              href={reviewHref(review.id, query)}
              className="block h-full rounded-2xl bg-card p-4 shadow-[0_8px_30px_rgb(31_26_23/6%)] outline-none transition-shadow hover:shadow-[0_12px_36px_rgb(214_63_8/16%)] focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <div className="flex items-start justify-between gap-3">
                <RatingStars rating={review.rating} />
                <time dateTime={review.createdAt} className="text-xs text-muted-foreground">
                  {formatDate(review.createdAt, context)}
                </time>
              </div>
              <p className="mt-2 text-sm">
                <ReviewText review={review} />
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border-soft pt-3">
                <span className="text-sm text-muted-foreground">{reviewerOf(review)}</span>
                <span className="flex flex-wrap gap-1.5">
                  <ReplyStatusBadge review={review} />
                  <ModerationBadge review={review} />
                  <ReportedBadge review={review} />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
