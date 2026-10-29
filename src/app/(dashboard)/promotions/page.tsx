import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/dashboard/page-header"
import { PromotionsList } from "@/components/promotions/promotions-list"
import { PromotionsPagination } from "@/components/promotions/promotions-pagination"
import {
  PromotionsEmpty,
  PromotionsListSkeleton,
  PromotionsLoadFailure,
  PromotionsNoResults,
  PromotionsPastEnd,
} from "@/components/promotions/promotions-states"
import { PromotionsToolbar } from "@/components/promotions/promotions-toolbar"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { isServiceError } from "@/lib/data-source/errors"
import {
  hasActivePromotionFilter,
  parsePromotionListQuery,
  promotionsHref,
  type RawSearchParams,
} from "@/lib/promotions/query"
import { getPromotionsContext, listPromotions, promotionsMode } from "@/lib/promotions/service"
import type { PromotionListQuery } from "@/lib/promotions/types"

export const metadata: Metadata = {
  title: "Promotions",
}

export default function PromotionsPage({ searchParams }: PageProps<"/promotions">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Promotions"
        description="Your coupons, as provided by Foodi. This page is read-only: it shows each coupon's terms and doesn't calculate savings."
      />
      <Suspense fallback={<PromotionsListSkeleton />}>
        <PromotionsView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function PromotionsView({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = await searchParams
  const query = parsePromotionListQuery(params)
  const preview = promotionsMode() === "preview"

  return (
    <div className="flex flex-col gap-4">
      {preview ? <PreviewNotice detail="Sample coupons are made up and are not real offers." /> : null}
      {/* Keyed so a new filter or page shows the loading state instead of stale rows. */}
      <Suspense
        key={promotionsHref(query)}
        fallback={
          <>
            <PromotionsToolbar query={query} />
            <PromotionsListSkeleton />
          </>
        }
      >
        <PromotionsResults query={query} preview={params.preview} />
      </Suspense>
    </div>
  )
}

async function PromotionsResults({ query, preview }: { query: PromotionListQuery; preview: unknown }) {
  let loaded
  try {
    const [context, result] = await Promise.all([getPromotionsContext(), listPromotions(query, preview)])
    loaded = { context, result }
  } catch (error) {
    // No fallback data: a failed request is shown as a failure. There is nothing to filter while no
    // promotions service is connected, so the filter is left out then.
    const connected = !(isServiceError(error) && error.kind === "not_configured")
    return (
      <>
        {connected ? <PromotionsToolbar query={query} /> : null}
        <PromotionsLoadFailure error={error} retryHref={promotionsHref(query)} />
      </>
    )
  }
  const { context, result } = loaded

  // The page may have been clamped (an out-of-range ?page=), so links use the page actually shown.
  const shown = { ...query, page: result.page }
  let content
  if (result.items.length === 0 && result.page === 1) {
    content = hasActivePromotionFilter(query) ? <PromotionsNoResults /> : <PromotionsEmpty />
  } else if (result.items.length === 0) {
    content = <PromotionsPastEnd firstPageHref={promotionsHref(query, { page: 1 })} />
  } else {
    content = (
      <>
        <PromotionsList promotions={result.items} query={shown} context={{ timeZone: context.timeZone, locale: context.locale }} />
        <PromotionsPagination page={result} itemCount={result.items.length} hrefFor={(page) => promotionsHref(shown, { page })} />
      </>
    )
  }

  return (
    <>
      <PromotionsToolbar query={query} />
      {content}
    </>
  )
}
