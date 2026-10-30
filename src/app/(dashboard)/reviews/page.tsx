import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/dashboard/page-header"
import { PreviewReviewsControls } from "@/components/reviews/preview-reviews-controls"
import { ReviewsList } from "@/components/reviews/reviews-list"
import { ReviewsPagination } from "@/components/reviews/reviews-pagination"
import {
  ReviewsEmpty,
  ReviewsListSkeleton,
  ReviewsLoadFailure,
  ReviewsNoResults,
} from "@/components/reviews/reviews-states"
import { ReviewsToolbar } from "@/components/reviews/reviews-toolbar"
import { PreviewNotice } from "@/components/shared/preview-notice"
import {
  hasActiveReviewFilters,
  parseReviewListQuery,
  REVIEWS_PATH,
  reviewsHref,
  type RawSearchParams,
} from "@/lib/reviews/query"
import { getReviewsContext, listReviews, reviewsMode, reviewsPreviewRefusesActions } from "@/lib/reviews/service"
import type { ReviewListQuery } from "@/lib/reviews/types"

export const metadata: Metadata = {
  title: "Reviews",
}

export default function ReviewsPage({ searchParams }: PageProps<"/reviews">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="hero"
        title="Reviews"
        description="See what customers say about your restaurant, and reply to their reviews."
      />
      <Suspense fallback={<ReviewsListSkeleton />}>
        <ReviewsView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function ReviewsView({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = await searchParams
  const query = parseReviewListQuery(params)
  const preview = reviewsMode() === "preview"

  return (
    <div className="flex flex-col gap-4">
      {preview ? <PreviewNotice detail="Sample reviews and reviewer names are made up." /> : null}
      <ReviewsToolbar query={query} />
      {/* Keyed so a new filter or page shows the loading state instead of stale rows. */}
      <Suspense key={reviewsHref(query)} fallback={<ReviewsListSkeleton />}>
        <ReviewsResults query={query} preview={params.preview} />
      </Suspense>
    </div>
  )
}

async function ReviewsResults({ query, preview }: { query: ReviewListQuery; preview: unknown }) {
  // The preview tools open a modal dialog, which marks the rest of the page aria-hidden. They sit in the same
  // Suspense boundary as the results so that using them hydrates the results first; in a separate boundary
  // the dialog could stamp aria-hidden onto results that haven't hydrated yet, causing a hydration mismatch.
  const tools = reviewsMode() === "preview" ? <PreviewReviewsControls refusesActions={reviewsPreviewRefusesActions()} /> : null

  let loaded
  try {
    const [context, result] = await Promise.all([getReviewsContext(), listReviews(query, preview)])
    loaded = { context, result }
  } catch (error) {
    // No fallback data: a failed request is shown as a failure.
    return (
      <div className="flex flex-col gap-4">
        {tools}
        <ReviewsLoadFailure error={error} retryHref={reviewsHref(query)} />
      </div>
    )
  }
  const { context, result } = loaded

  if (result.totalItems === 0) {
    return (
      <div className="flex flex-col gap-4">
        {tools}
        {hasActiveReviewFilters(query) ? <ReviewsNoResults clearHref={REVIEWS_PATH} /> : <ReviewsEmpty />}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {tools}
      {/* The page may have been clamped (an out-of-range ?page=), so links use the page actually shown. */}
      <ReviewsList
        reviews={result.items}
        query={{ ...query, page: result.page }}
        context={{ timeZone: context.timeZone, locale: context.locale }}
      />
      <ReviewsPagination query={query} result={result} />
    </div>
  )
}
