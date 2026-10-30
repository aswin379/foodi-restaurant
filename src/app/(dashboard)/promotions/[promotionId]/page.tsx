import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { PromotionDetail, PromotionDisclaimer, PromotionHeading } from "@/components/promotions/promotion-detail"
import { PromotionDetailSkeleton, PromotionsLoadFailure } from "@/components/promotions/promotions-states"
import { PreviewNotice } from "@/components/shared/preview-notice"
import type { ZoneAndLocale } from "@/lib/orders/format"
import { parsePromotionListQuery, promotionHref, promotionsHref, type RawSearchParams } from "@/lib/promotions/query"
import { getPromotion, getPromotionsContext, promotionsMode } from "@/lib/promotions/service"

export const metadata: Metadata = {
  title: "Coupon",
}

export default function PromotionDetailPage({ params, searchParams }: PageProps<"/promotions/[promotionId]">) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<PromotionDetailSkeleton />}>
        <PromotionDetailView params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function PromotionDetailView({
  params,
  searchParams,
}: {
  params: Promise<{ promotionId: string }>
  searchParams: Promise<RawSearchParams>
}) {
  const { promotionId } = await params
  const rawParams = await searchParams
  // The list's filter and page arrive in the URL, so "back" returns to the same view.
  const listQuery = parsePromotionListQuery(rawParams)

  const back = (
    <Link
      href={promotionsHref(listQuery)}
      className="inline-flex w-fit items-center gap-2 rounded-full text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span aria-hidden className="grid size-8 place-items-center rounded-full bg-card shadow-[0_8px_30px_rgb(31_26_23/6%)]"><ArrowLeft className="size-4" /></span>
      All coupons
    </Link>
  )

  // A malformed percent-encoding can't name a coupon. The ID is only ever an opaque value for the API:
  // it never decides which restaurant's data is shown.
  let id: string
  try {
    id = decodeURIComponent(promotionId)
  } catch {
    notFound()
  }

  let loaded
  try {
    const [context, promotion] = await Promise.all([getPromotionsContext(), getPromotion(id, rawParams.preview)])
    loaded = { context, promotion }
  } catch (error) {
    return (
      <>
        {back}
        <PromotionsLoadFailure error={error} retryHref={promotionHref(id, listQuery)} what="this coupon" />
      </>
    )
  }
  const promotion = loaded.promotion
  if (!promotion) notFound()
  const context: ZoneAndLocale = { timeZone: loaded.context.timeZone, locale: loaded.context.locale }

  return (
    <>
      {back}
      {promotionsMode() === "preview" ? <PreviewNotice detail="Sample coupons are made up and are not real offers." /> : null}
      <header>
        <PromotionHeading promotion={promotion} />
        <p className="mt-1 text-sm text-muted-foreground">Coupon</p>
      </header>
      <PromotionDetail promotion={promotion} context={context} />
      <PromotionDisclaimer />
    </>
  )
}
