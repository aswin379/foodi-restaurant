import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/dashboard/page-header"
import { KitchenDisplay } from "@/components/kitchen/kitchen-display"
import { OrdersBoardSkeleton, OrdersLoadFailure } from "@/components/orders/orders-states"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { getOrderBoard, getOrdersContext, listOrders, listRiders, ordersMode } from "@/lib/orders/service"
import type { Rider } from "@/lib/orders/types"

export const metadata: Metadata = {
  title: "Kitchen display",
}

export default function KitchenPage({ searchParams }: PageProps<"/kitchen">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="hero"
        title="Kitchen display"
        description="New orders, orders being prepared and orders ready to go, for the kitchen screen. It refreshes about every 15 seconds."
      />
      <Suspense fallback={<OrdersBoardSkeleton />}>
        <KitchenView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function KitchenView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { preview } = await searchParams
  let loaded
  try {
    const [context, orders, completed] = await Promise.all([
      getOrdersContext(),
      getOrderBoard(preview),
      listOrders({ status: "completed", search: "", from: null, to: null, page: 1, pageSize: 8 }, preview),
    ])
    loaded = { context, orders, completed }
  } catch (error) {
    return <OrdersLoadFailure error={error} retryHref="/kitchen" />
  }
  let riders: Rider[] = []
  try {
    riders = await listRiders()
  } catch {
    riders = []
  }
  return (
    <div className="flex flex-col gap-5">
      {ordersMode() === "preview" ? <PreviewNotice detail="Sample orders use PRV- references." /> : null}
      <KitchenDisplay
        orders={loaded.orders}
        riders={riders}
        context={{ timeZone: loaded.context.timeZone, locale: loaded.context.locale }}
        recentlyCompleted={loaded.completed.items.map(({ id, reference, orderType, placedAt }) => ({ id, reference, orderType, placedAt }))}
      />
    </div>
  )
}
