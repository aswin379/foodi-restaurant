import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateTime, type ZoneAndLocale } from "@/lib/orders/format"
import type { Review } from "@/lib/reviews/types"

import { RatingStars } from "./rating-stars"
import { ModerationBadge, ReplyStatusBadge } from "./review-badges"
import { ReplySection } from "./reply-section"
import { ReportAbuse } from "./report-abuse"
import { ReviewText } from "./reviews-list"

/**
 * One review in full: only what the source supplies, a display name and no
 * contact details (R3), an order link only for a real order reference (R4),
 * statuses only when given (R7).
 */
export function ReviewDetail({ review, context }: { review: Review; context: ZoneAndLocale }) {
  const name = review.reviewerName ?? "a customer"

  return (
    <>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] leading-9 font-bold tracking-[-0.02em] sm:text-[2rem] sm:leading-10 lg:text-[2.5rem] lg:leading-[3rem]">Review by {name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <RatingStars rating={review.rating} />
            <time dateTime={review.createdAt}>{formatDateTime(review.createdAt, context)}</time>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReplyStatusBadge review={review} />
          <ModerationBadge review={review} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <DetailCard title="Review">
            <p className="rounded-2xl bg-background/70 p-4 text-[15px] leading-relaxed ring-1 ring-border-soft">
              <ReviewText review={review} clamp={false} />
            </p>
          </DetailCard>
          <Card className="gap-4 rounded-3xl border-transparent py-6 shadow-[0_8px_30px_rgb(31_26_23/6%)]">
            <CardContent>
              <ReplySection reviewId={review.id} reply={review.reply} context={context} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <DetailCard title="Details">
            <dl className="flex flex-col gap-3 text-sm">
              <InfoRow label="Reviewer" value={review.reviewerName ?? "Name not shared"} />
              <InfoRow label="Rating" value={<RatingStars rating={review.rating} />} />
              <InfoRow
                label="Order"
                value={
                  review.order ? (
                    <Link
                      href={`/orders/${encodeURIComponent(review.order.id)}`}
                      className="rounded-sm text-primary-text underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      Order {review.order.reference}
                    </Link>
                  ) : (
                    "Not linked to an order"
                  )
                }
              />
            </dl>
          </DetailCard>
          <DetailCard title="Report abuse">
            <ReportAbuse reviewId={review.id} report={review.report} context={context} />
          </DetailCard>
        </div>
      </div>
    </>
  )
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="gap-4 rounded-3xl border-transparent py-6 shadow-[0_8px_30px_rgb(31_26_23/6%)]">
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg font-semibold">{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
