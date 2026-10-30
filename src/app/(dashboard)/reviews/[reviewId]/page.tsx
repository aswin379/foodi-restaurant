import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { PreviewReviewsControls } from "@/components/reviews/preview-reviews-controls"
import { ReviewDetail } from "@/components/reviews/review-detail"
import { ReviewDetailSkeleton, ReviewsLoadFailure } from "@/components/reviews/reviews-states"
import { PreviewNotice } from "@/components/shared/preview-notice"
import type { ZoneAndLocale } from "@/lib/orders/format"
import { parseReviewListQuery, reviewsHref, type RawSearchParams } from "@/lib/reviews/query"
import { getReview, getReviewsContext, reviewsMode, reviewsPreviewRefusesActions } from "@/lib/reviews/service"

export const metadata: Metadata = {
  title: "Review",
}

export default function ReviewDetailPage({ params, searchParams }: PageProps<"/reviews/[reviewId]">) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<ReviewDetailSkeleton />}>
        <ReviewDetailView params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function ReviewDetailView({
  params,
  searchParams,
}: {
  params: Promise<{ reviewId: string }>
  searchParams: Promise<RawSearchParams>
}) {
  const { reviewId } = await params
  const rawParams = await searchParams
  // The list's filters arrive in the URL, so "back" returns to the same filtered page.
  const backHref = reviewsHref(parseReviewListQuery(rawParams))

  const back = (
    <Link
      href={backHref}
      className="inline-flex w-fit items-center gap-2 rounded-full text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span aria-hidden className="grid size-8 place-items-center rounded-full bg-card shadow-[0_8px_30px_rgb(31_26_23/6%)]">
        <ArrowLeft className="size-4" />
      </span>
      All reviews
    </Link>
  )

  // A malformed percent-encoding can't name a review.
  let id: string
  try {
    id = decodeURIComponent(reviewId)
  } catch {
    notFound()
  }

  let loaded
  try {
    const [context, review] = await Promise.all([getReviewsContext(), getReview(id, rawParams.preview)])
    loaded = { context, review }
  } catch (error) {
    return (
      <>
        {back}
        <ReviewsLoadFailure error={error} retryHref={`/reviews/${reviewId}`} />
      </>
    )
  }
  const review = loaded.review
  if (!review) notFound()
  const context: ZoneAndLocale = { timeZone: loaded.context.timeZone, locale: loaded.context.locale }

  return (
    <>
      {back}
      {reviewsMode() === "preview" ? (
        <>
          <PreviewNotice detail="Sample reviews and reviewer names are made up." />
          <PreviewReviewsControls refusesActions={reviewsPreviewRefusesActions()} />
        </>
      ) : null}

      <ReviewDetail review={review} context={context} />
    </>
  )
}
