import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Inbox } from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"
import { PreviewNotice } from "@/components/shared/preview-notice"
import {
  SettlementHeading,
  SettlementLines,
  SettlementOrders,
  SettlementOverview,
} from "@/components/wallet/settlement-detail"
import { SettlementDetailSkeleton, SettlementsPastEnd, WalletError, WalletLoadFailure, WalletSkeleton } from "@/components/wallet/wallet-states"
import { WalletPagination } from "@/components/wallet/wallet-pagination"
import {
  parseSettlementListQuery,
  parseSettlementOrdersQuery,
  settlementHref,
  settlementsHref,
  type RawSearchParams,
} from "@/lib/wallet/query"
import { getSettlement, getWalletContext, listSettlementOrders, walletMode } from "@/lib/wallet/service"
import type { SettlementOrdersQuery } from "@/lib/wallet/types"
import type { ZoneAndLocale } from "@/lib/orders/format"

export const metadata: Metadata = {
  title: "Settlement",
}

export default function SettlementDetailPage({ params, searchParams }: PageProps<"/wallet/settlements/[settlementId]">) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<SettlementDetailSkeleton />}>
        <SettlementDetailView params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function SettlementDetailView({
  params,
  searchParams,
}: {
  params: Promise<{ settlementId: string }>
  searchParams: Promise<RawSearchParams>
}) {
  const { settlementId } = await params
  const rawParams = await searchParams
  // The list page arrives in the URL, so "back" returns to the same page.
  const listPage = parseSettlementListQuery(rawParams).page

  const back = (
    <Link
      href={settlementsHref(listPage)}
      className="inline-flex w-fit items-center gap-2 rounded-full text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span aria-hidden className="grid size-8 place-items-center rounded-full bg-card shadow-[0_8px_30px_rgb(31_26_23/6%)]"><ArrowLeft className="size-4" /></span>
      All settlements
    </Link>
  )

  // A malformed percent-encoding can't name a settlement. The ID is only ever an opaque value for the API:
  // it never decides which restaurant's data is shown.
  let id: string
  try {
    id = decodeURIComponent(settlementId)
  } catch {
    notFound()
  }

  let loaded
  try {
    const [context, settlement] = await Promise.all([getWalletContext(), getSettlement(id, rawParams.preview)])
    loaded = { context, settlement }
  } catch (error) {
    return (
      <>
        {back}
        <WalletLoadFailure error={error} retryHref={settlementHref(id, listPage)} what="this settlement" />
      </>
    )
  }
  const settlement = loaded.settlement
  if (!settlement) notFound()
  const context: ZoneAndLocale = { timeZone: loaded.context.timeZone, locale: loaded.context.locale }
  const ordersQuery = parseSettlementOrdersQuery(rawParams)

  return (
    <>
      {back}
      {walletMode() === "preview" ? <PreviewNotice detail="Sample amounts are made up and are not real earnings or payouts." /> : null}
      <header>
        <SettlementHeading settlement={settlement} locale={context.locale} />
        <p className="mt-1 text-sm text-muted-foreground">Period as supplied by Foodi, in your restaurant&apos;s dates</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <SettlementOverview settlement={settlement} context={context} />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section aria-labelledby="settlement-lines-heading" className="flex flex-col gap-3">
            <h2 id="settlement-lines-heading" className="text-base font-semibold">
              Commission, fees, tax and adjustments
            </h2>
            <SettlementLines settlement={settlement} context={context} />
          </section>
          <section aria-labelledby="settlement-orders-heading" className="flex flex-col gap-3">
            <h2 id="settlement-orders-heading" className="text-base font-semibold">
              Orders in this settlement
            </h2>
            {/* Loads and fails on its own, so a failure here never hides the settlement. */}
            <Suspense key={ordersQuery.page} fallback={<WalletSkeleton label="Loading orders" />}>
              <SettlementOrdersSection
                settlementId={id}
                listPage={listPage}
                ordersQuery={ordersQuery}
                context={context}
                preview={rawParams.preview}
              />
            </Suspense>
          </section>
        </div>
      </div>
    </>
  )
}

async function SettlementOrdersSection({
  settlementId,
  listPage,
  ordersQuery,
  context,
  preview,
}: {
  settlementId: string
  listPage: number
  ordersQuery: SettlementOrdersQuery
  context: ZoneAndLocale
  preview: unknown
}) {
  const retryHref = settlementHref(settlementId, listPage, ordersQuery.page)
  let result
  try {
    result = await listSettlementOrders(settlementId, ordersQuery, preview)
  } catch (error) {
    return <WalletLoadFailure error={error} retryHref={retryHref} what="the order breakdown" />
  }
  if (!result) return <WalletError retryHref={retryHref} what="the order breakdown" />

  if (result.items.length === 0 && result.page === 1) {
    return (
      <EmptyState
        icon={Inbox}
        title="No orders listed"
        description="No order breakdown was provided for this settlement."
        className="min-h-40 rounded-3xl border-border bg-card"
      />
    )
  }
  if (result.items.length === 0) {
    return <SettlementsPastEnd firstPageHref={settlementHref(settlementId, listPage, 1)} />
  }

  return (
    <>
      <SettlementOrders orders={result.items} context={context} />
      <WalletPagination
        label="Order breakdown pagination"
        noun="order"
        nounPlural="orders"
        page={result}
        itemCount={result.items.length}
        hrefFor={(page) => settlementHref(settlementId, listPage, page)}
      />
    </>
  )
}
