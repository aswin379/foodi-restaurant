import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/dashboard/page-header"
import { MenuListSkeleton, MenuLoadFailure } from "@/components/menu/menu-states"
import { PosWorkspace } from "@/components/pos/pos-workspace"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { getMenuContext, listMenuCategories, listMenuItems, menuMode } from "@/lib/menu/service"
import type { MenuItem } from "@/lib/menu/types"
import { getOrderBoard } from "@/lib/orders/service"
import type { OrderDetail } from "@/lib/orders/types"

export const metadata: Metadata = {
  title: "POS",
}

export default function PosPage({ searchParams }: PageProps<"/pos">) {
  return (
    <div className="flex flex-col gap-6 pb-20 lg:pb-0">
      <PageHeader
        variant="hero"
        title="POS"
        description="Take counter orders: choose items, set the order type and see the order. Sending orders and payments aren't connected yet."
      />
      <Suspense fallback={<MenuListSkeleton label="Loading the menu" />}>
        <PosView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function PosView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { preview } = await searchParams
  let loaded
  try {
    const [context, categories, firstPage] = await Promise.all([
      getMenuContext(),
      listMenuCategories(preview),
      listMenuItems({ filter: "all", search: "", categoryId: null, page: 1, pageSize: 100 }, preview),
    ])
    // The catalogue is every active item, across pages.
    const items: MenuItem[] = [...firstPage.items]
    for (let page = 2; page <= Math.min(firstPage.totalPages, 5); page += 1) {
      items.push(...(await listMenuItems({ filter: "all", search: "", categoryId: null, page, pageSize: 100 }, preview)).items)
    }
    loaded = { context, categories, items }
  } catch (error) {
    // No fallback data: a failed request is shown as a failure, and a missing API as not connected.
    return <MenuLoadFailure error={error} retryHref="/pos" />
  }

  let active: OrderDetail[] | null = null
  try {
    active = await getOrderBoard(preview)
  } catch {
    active = null
  }

  return (
    <div className="flex flex-col gap-5">
      {menuMode() === "preview" ? <PreviewNotice detail="Sample items have ids starting prv-. Nothing you do here is saved." /> : null}
      <PosWorkspace items={loaded.items} categories={loaded.categories} activeOrders={active} locale={loaded.context.locale} />
    </div>
  )
}
