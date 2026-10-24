import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/dashboard/page-header"
import { MenuItemForm } from "@/components/menu/menu-item-form"
import { BackToMenuLink, MenuFormSkeleton } from "@/components/menu/menu-page-parts"
import { MenuLoadFailure } from "@/components/menu/menu-states"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { getMenuContext, listMenuCategories, menuMode } from "@/lib/menu/service"

export const metadata: Metadata = {
  title: "Add menu item",
}

export default function NewMenuItemPage() {
  return (
    <div className="flex flex-col gap-6">
      <BackToMenuLink />
      <PageHeader
        title="Add menu item"
        description="Describe the item, set its price, sizes and options, and choose its category."
      />
      <Suspense fallback={<MenuFormSkeleton />}>
        <NewItemForm />
      </Suspense>
    </div>
  )
}

async function NewItemForm() {
  let loaded
  try {
    const [context, categories] = await Promise.all([getMenuContext(), listMenuCategories()])
    loaded = { context, categories }
  } catch (error) {
    // Every item needs a category (D7), so the form can't work without them.
    return <MenuLoadFailure error={error} retryHref="/menu/new" what="categories" />
  }
  return (
    <div className="flex flex-col gap-6">
      {menuMode() === "preview" ? <PreviewNotice /> : null}
      <MenuItemForm
        mode="create"
        categories={loaded.categories}
        context={{ timeZone: loaded.context.timeZone, locale: loaded.context.locale }}
      />
    </div>
  )
}
