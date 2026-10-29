import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/dashboard/page-header"
import { OrdersBoard } from "@/components/orders/orders-board"
import { OrdersBoardSkeleton, OrdersLoadFailure } from "@/components/orders/orders-states"
import { OrdersSubnav } from "@/components/orders/orders-subnav"
import { PreviewOrderControls } from "@/components/orders/preview-order-controls"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { getOrderBoard, getOrdersContext, listRiders, ordersMode } from "@/lib/orders/service"
import type { Rider } from "@/lib/orders/types"

export const metadata: Metadata = {
  title: "Orders",
}

export default function OrdersBoardPage({ searchParams }: PageProps<"/orders">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="hero"
        title="Orders"
        description="New and in-progress orders for your restaurant. Accept new orders, mark them ready and hand them over."
        actions={<OrdersSubnav current="board" />}
      />
      <Suspense fallback={<OrdersBoardSkeleton />}>
        <BoardView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function BoardView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { preview } = await searchParams

  let loaded
  try {
    const [context, orders] = await Promise.all([getOrdersContext(), getOrderBoard(preview)])
    loaded = { context, orders }
  } catch (error) {
    // No fallback data: a failed request is shown as a failure.
    return <OrdersLoadFailure error={error} retryHref="/orders" />
  }

  // Riders are only needed for Dispatch; the dialog explains when they're missing.
  let riders: Rider[] = []
  try {
    riders = await listRiders()
  } catch {
    riders = []
  }

  const isPreview = ordersMode() === "preview"
  return (
    <div className="flex flex-col gap-5">
      {isPreview ? (
        <>
          <PreviewNotice detail="Sample orders use PRV- references." />
          <PreviewOrderControls />
        </>
      ) : null}
      <OrdersBoard
        orders={loaded.orders}
        riders={riders}
        context={{ timeZone: loaded.context.timeZone, locale: loaded.context.locale }}
      />
    </div>
  )
}
