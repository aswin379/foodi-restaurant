import { Suspense } from "react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/dashboard/page-header"
import { MenuItemForm } from "@/components/menu/menu-item-form"
import { BackToMenuLink, MenuFormSkeleton } from "@/components/menu/menu-page-parts"
import { BackendPendingNotice, MenuPreviewNotice } from "@/components/menu/menu-notices"
import { listMenuCategories, menuDataSource } from "@/lib/menu/service"
import type { MenuCategory } from "@/lib/menu/types"

export const metadata: Metadata = {
  title: "Add menu item",
}

export default function NewMenuItemPage() {
  return (
    <div className="flex flex-col gap-6">
      <BackToMenuLink />
      <PageHeader
        title="Add menu item"
        description="Describe the item, set its price and choose where it appears on your menu."
      />
      <Suspense fallback={<MenuFormSkeleton />}>
        <NewItemForm />
      </Suspense>
    </div>
  )
}

async function NewItemForm() {
  let categories: MenuCategory[] | null = null
  try {
    categories = await listMenuCategories()
  } catch {
    // The form still works without categories; the field explains why it's empty.
    categories = null
  }
  return (
    <div className="flex flex-col gap-6">
      {menuDataSource() === "fixtures" ? <MenuPreviewNotice /> : null}
      <BackendPendingNotice>
        You can fill in and check this form, but saving isn&apos;t available yet.
        Backend integration pending.
      </BackendPendingNotice>
      <MenuItemForm mode="create" categories={categories} />
    </div>
  )
}
