import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/dashboard/page-header"
import { MenuItemForm } from "@/components/menu/menu-item-form"
import { BackendPendingNotice, MenuPreviewNotice } from "@/components/menu/menu-notices"
import { BackToMenuLink, MenuFormSkeleton } from "@/components/menu/menu-page-parts"
import { MenuError, MenuNotConnected } from "@/components/menu/menu-states"
import { MenuServiceError } from "@/lib/menu/errors"
import { getMenuItem, listMenuCategories, menuDataSource } from "@/lib/menu/service"
import type { MenuCategory, MenuItem } from "@/lib/menu/types"

export const metadata: Metadata = {
  title: "Edit menu item",
}

export default function EditMenuItemPage({
  params,
  searchParams,
}: PageProps<"/menu/[itemId]/edit">) {
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

  let item: MenuItem | null
  try {
    item = await getMenuItem(decodeURIComponent(itemId), preview)
  } catch (error) {
    if (error instanceof MenuServiceError && error.kind === "not_configured") {
      return <MenuNotConnected />
    }
    return <MenuError retryHref={`/menu/${itemId}/edit`} what="this item" />
  }
  if (!item) notFound()

  let categories: MenuCategory[] | null = null
  try {
    categories = await listMenuCategories()
  } catch {
    categories = null
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Edit ${item.name}`} description="Update the item's details, price, options and availability." />
      {menuDataSource() === "fixtures" ? <MenuPreviewNotice /> : null}
      <BackendPendingNotice>
        Changes on this page can&apos;t be saved yet. Backend integration pending.
      </BackendPendingNotice>
      <MenuItemForm mode="edit" item={item} categories={categories} />
    </div>
  )
}
