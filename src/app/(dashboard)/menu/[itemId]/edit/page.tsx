import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/dashboard/page-header"
import { MenuItemForm } from "@/components/menu/menu-item-form"
import { BackToMenuLink, MenuFormSkeleton } from "@/components/menu/menu-page-parts"
import { MenuLoadFailure } from "@/components/menu/menu-states"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { loadScheduleSupport } from "@/lib/menu/schedule-support"
import { getMenuContext, getMenuItem, listMenuCategories, menuMode } from "@/lib/menu/service"

export const metadata: Metadata = {
  title: "Edit menu item",
}

export default function EditMenuItemPage({ params, searchParams }: PageProps<"/menu/[itemId]/edit">) {
  return (
    <div className="flex flex-col gap-6">
      <BackToMenuLink />
      <Suspense fallback={<MenuFormSkeleton />}>
        <EditItemView params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function EditItemView({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { itemId } = await params
  const { preview } = await searchParams

  let loaded
  try {
    const [context, item, categories, support] = await Promise.all([
      getMenuContext(),
      getMenuItem(decodeURIComponent(itemId), preview),
      listMenuCategories(),
      loadScheduleSupport(),
    ])
    loaded = { context, item, categories, support }
  } catch (error) {
    return <MenuLoadFailure error={error} retryHref={`/menu/${itemId}/edit`} what="item" />
  }
  const { item } = loaded
  // Archived items are restored from the list before they can be edited.
  if (!item || item.archived) notFound()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Edit ${item.name}`} description="Update the item's details, price, sizes, options and availability." />
      {menuMode() === "preview" ? <PreviewNotice /> : null}
      <MenuItemForm
        mode="edit"
        item={item}
        categories={loaded.categories}
        context={{ timeZone: loaded.context.timeZone, locale: loaded.context.locale }}
        mealPeriods={loaded.support.mealPeriods}
        hours={loaded.support.hours}
      />
    </div>
  )
}
