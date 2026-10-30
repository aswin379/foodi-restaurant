import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/dashboard/page-header"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { SettlementsList } from "@/components/wallet/settlements-list"
import { SettlementsEmpty, WalletLoadFailure, WalletSkeleton } from "@/components/wallet/wallet-states"
import { WalletSummary } from "@/components/wallet/wallet-summary"
import { SETTLEMENTS_PATH, WALLET_OVERVIEW_SETTLEMENTS, WALLET_PATH, type RawSearchParams } from "@/lib/wallet/query"
import { getWalletContext, getWalletSummary, listSettlements, walletMode } from "@/lib/wallet/service"

export const metadata: Metadata = {
  title: "Wallet & settlements",
}

export default function WalletPage({ searchParams }: PageProps<"/wallet">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="hero"
        title="Wallet & settlements"
        description="Your earnings and settlements, as reported by Foodi. Figures are shown as provided and are not calculated here."
      />
      <Suspense fallback={<WalletSkeleton />}>
        <WalletView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function WalletView({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { preview } = await searchParams
  const isPreview = walletMode() === "preview"

  // The balances and the recent settlements load together but fail on their own: a failed settlements
  // list never hides the balances. A missing service is said once, by the balances.
  const [context, summary, settlements] = await Promise.allSettled([
    getWalletContext(),
    getWalletSummary(preview),
    listSettlements({ page: 1, pageSize: WALLET_OVERVIEW_SETTLEMENTS }, preview),
  ])

  if (context.status === "rejected" || summary.status === "rejected") {
    const error = context.status === "rejected" ? context.reason : (summary as PromiseRejectedResult).reason
    // No fallback data: a failed request is shown as a failure.
    return <WalletLoadFailure error={error} retryHref={WALLET_PATH} />
  }
  const zone = { timeZone: context.value.timeZone, locale: context.value.locale }

  return (
    <div className="flex flex-col gap-6">
      {isPreview ? <PreviewNotice detail="Sample amounts are made up and are not real earnings or payouts." /> : null}
      <WalletSummary summary={summary.value} context={zone} />
      <section aria-labelledby="wallet-recent-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="wallet-recent-heading" className="text-base font-semibold">
            Recent settlements
          </h2>
          <Link
            href={SETTLEMENTS_PATH}
            className="rounded-sm text-sm font-medium text-primary-text underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            View all settlements
          </Link>
        </div>
        {settlements.status === "rejected" ? (
          <WalletLoadFailure error={settlements.reason} retryHref={WALLET_PATH} what="settlements" />
        ) : settlements.value.items.length === 0 ? (
          <SettlementsEmpty />
        ) : (
          <SettlementsList settlements={settlements.value.items} listPage={1} context={zone} />
        )}
      </section>
    </div>
  )
}
