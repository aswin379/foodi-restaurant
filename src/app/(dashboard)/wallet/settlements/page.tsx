import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { SettlementsList } from "@/components/wallet/settlements-list"
import { SettlementsEmpty, SettlementsPastEnd, WalletLoadFailure, WalletSkeleton } from "@/components/wallet/wallet-states"
import { WalletPagination } from "@/components/wallet/wallet-pagination"
import {
  parseSettlementListQuery,
  settlementsHref,
  WALLET_PATH,
  type RawSearchParams,
} from "@/lib/wallet/query"
import { getWalletContext, listSettlements, walletMode } from "@/lib/wallet/service"
import type { SettlementListQuery } from "@/lib/wallet/types"

export const metadata: Metadata = {
  title: "Settlements",
}

export default function SettlementsPage({ searchParams }: PageProps<"/wallet/settlements">) {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href={WALLET_PATH}
        className="inline-flex w-fit items-center gap-2 rounded-full text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span aria-hidden className="grid size-8 place-items-center rounded-full bg-card shadow-[0_8px_30px_rgb(31_26_23/6%)]"><ArrowLeft className="size-4" /></span>
        Wallet
      </Link>
      <PageHeader
        variant="hero"
        title="Settlements"
        description="Each settlement's period, status and amounts, as reported by Foodi."
      />
      <Suspense fallback={<WalletSkeleton label="Loading settlements" />}>
        <SettlementsView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function SettlementsView({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = await searchParams
  const query = parseSettlementListQuery(params)
  const preview = walletMode() === "preview"

  return (
    <div className="flex flex-col gap-4">
      {preview ? <PreviewNotice detail="Sample amounts are made up and are not real earnings or payouts." /> : null}
      {/* Keyed so a new page shows the loading state instead of stale rows. */}
      <Suspense key={query.page} fallback={<WalletSkeleton label="Loading settlements" />}>
        <SettlementsResults query={query} preview={params.preview} />
      </Suspense>
    </div>
  )
}

async function SettlementsResults({ query, preview }: { query: SettlementListQuery; preview: unknown }) {
  let loaded
  try {
    const [context, result] = await Promise.all([getWalletContext(), listSettlements(query, preview)])
    loaded = { context, result }
  } catch (error) {
    // No fallback data: a failed request is shown as a failure.
    return <WalletLoadFailure error={error} retryHref={settlementsHref(query.page)} what="settlements" />
  }
  const { context, result } = loaded

  if (result.items.length === 0 && result.page === 1) return <SettlementsEmpty />
  if (result.items.length === 0) return <SettlementsPastEnd firstPageHref={settlementsHref(1)} />

  return (
    <>
      {/* The page may have been clamped (an out-of-range ?page=), so links use the page actually shown. */}
      <SettlementsList
        settlements={result.items}
        listPage={result.page}
        context={{ timeZone: context.timeZone, locale: context.locale }}
      />
      <WalletPagination
        label="Settlements pagination"
        noun="settlement"
        nounPlural="settlements"
        page={result}
        itemCount={result.items.length}
        hrefFor={settlementsHref}
      />
    </>
  )
}
