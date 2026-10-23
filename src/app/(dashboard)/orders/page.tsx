import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/dashboard/page-header"
import { OrdersList } from "@/components/orders/orders-list"
import { OrdersPagination } from "@/components/orders/orders-pagination"
import {
  OrdersEmpty,
  OrdersError,
  OrdersListSkeleton,
  OrdersNoResults,
  OrdersNotConnected,
} from "@/components/orders/orders-states"
import { OrdersToolbar } from "@/components/orders/orders-toolbar"
import { PreviewDataNotice } from "@/components/orders/preview-data-notice"
import { OrdersServiceError } from "@/lib/orders/errors"
import {
  hasActiveFilters,
  ordersHref,
  parseOrderListQuery,
  type RawSearchParams,
} from "@/lib/orders/query"
import { listOrders, ordersDataSource } from "@/lib/orders/service"
import type { OrderListQuery } from "@/lib/orders/types"

export const metadata: Metadata = {
  title: "Orders",
}

export default function OrdersPage({ searchParams }: PageProps<"/orders">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Orders"
        description="Track incoming and past orders for your restaurant. Find an order by its reference, filter by status or date, and open it for the full details."
      />
      <Suspense fallback={<OrdersListSkeleton />}>
        <OrdersView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function OrdersView({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const params = await searchParams
  const query = parseOrderListQuery(params)

  return (
    <div className="flex flex-col gap-4">
      {ordersDataSource() === "fixtures" ? <PreviewDataNotice /> : null}
      <OrdersToolbar query={query} />
      {/* Keyed so a new filter shows the loading state instead of stale rows. */}
      <Suspense key={ordersHref(query)} fallback={<OrdersListSkeleton />}>
        <OrdersResults query={query} preview={params.preview} />
      </Suspense>
    </div>
  )
}

async function OrdersResults({
  query,
  preview,
}: {
  query: OrderListQuery
  preview: unknown
}) {
  let result
  try {
    result = await listOrders(query, preview)
  } catch (error) {
    if (error instanceof OrdersServiceError && error.kind === "not_configured") {
      return <OrdersNotConnected />
    }
    // No fallback data: a failed request is shown as a failure.
    return <OrdersError retryHref={ordersHref(query)} />
  }

  if (result.totalItems === 0) {
    const filtered = query.status !== "all" || hasActiveFilters(query)
    return filtered ? <OrdersNoResults clearHref="/orders" /> : <OrdersEmpty />
  }

  return (
    <div className="flex flex-col gap-4">
      <OrdersList orders={result.items} />
      <OrdersPagination query={query} result={result} />
    </div>
  )
}
