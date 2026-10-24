import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/dashboard/page-header"
import { OrdersList } from "@/components/orders/orders-list"
import { OrdersPagination } from "@/components/orders/orders-pagination"
import {
  OrdersEmpty,
  OrdersListSkeleton,
  OrdersLoadFailure,
  OrdersNoResults,
} from "@/components/orders/orders-states"
import { OrdersSubnav } from "@/components/orders/orders-subnav"
import { OrdersToolbar } from "@/components/orders/orders-toolbar"
import { PreviewNotice } from "@/components/shared/preview-notice"
import {
  hasActiveFilters,
  ORDER_HISTORY_PATH,
  ordersHref,
  parseOrderListQuery,
  type RawSearchParams,
} from "@/lib/orders/query"
import { getOrdersContext, listOrders, ordersMode } from "@/lib/orders/service"
import type { OrderListQuery } from "@/lib/orders/types"

export const metadata: Metadata = {
  title: "Order history",
}

export default function OrderHistoryPage({ searchParams }: PageProps<"/orders/history">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Order history"
        description="Find any order by its reference, filter by status or date, and open it for the full details."
      />
      <OrdersSubnav current="history" />
      <Suspense fallback={<OrdersListSkeleton />}>
        <HistoryView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function HistoryView({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = await searchParams
  const query = parseOrderListQuery(params)

  return (
    <div className="flex flex-col gap-4">
      {ordersMode() === "preview" ? <PreviewNotice detail="Sample orders use PRV- references." /> : null}
      <OrdersToolbar query={query} />
      {/* Keyed so a new filter shows the loading state instead of stale rows. */}
      <Suspense key={ordersHref(query)} fallback={<OrdersListSkeleton />}>
        <HistoryResults query={query} preview={params.preview} />
      </Suspense>
    </div>
  )
}

async function HistoryResults({ query, preview }: { query: OrderListQuery; preview: unknown }) {
  let loaded
  try {
    const [context, result] = await Promise.all([getOrdersContext(), listOrders(query, preview)])
    loaded = { context, result }
  } catch (error) {
    return <OrdersLoadFailure error={error} retryHref={ordersHref(query)} />
  }
  const { context, result } = loaded

  if (result.totalItems === 0) {
    const filtered = query.status !== "all" || hasActiveFilters(query)
    return filtered ? <OrdersNoResults clearHref={ORDER_HISTORY_PATH} /> : <OrdersEmpty />
  }

  return (
    <div className="flex flex-col gap-4">
      <OrdersList orders={result.items} context={{ timeZone: context.timeZone, locale: context.locale }} />
      <OrdersPagination query={query} result={result} />
    </div>
  )
}
