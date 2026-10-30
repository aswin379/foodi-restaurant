import { Suspense } from "react"
import type { Metadata } from "next"
import { Plus, Tags } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { CategoriesList } from "@/components/menu/categories-list"
import { CategoryDialog } from "@/components/menu/category-dialog"
import { MenuListSkeleton, MenuLoadFailure } from "@/components/menu/menu-states"
import { PreviewMenuControls } from "@/components/menu/preview-menu-controls"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { loadCategoryScheduleSupport } from "@/lib/menu/schedule-support"
import { listMenuCategories, menuMode } from "@/lib/menu/service"

export const metadata: Metadata = {
  title: "Menu categories",
}

export default function MenuCategoriesPage({ searchParams }: PageProps<"/menu/categories">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="hero"
        title="Categories"
        description="Group your menu into sections, like Starters or Drinks, set their order, and switch them on or off."
        actions={
          <Suspense fallback={<AddCategoryButton disabled />}>
            <AddCategory />
          </Suspense>
        }
      />
      <Suspense fallback={<MenuListSkeleton label="Loading categories" />}>
        <CategoriesView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

function AddCategoryButton({ disabled = false }: { disabled?: boolean }) {
  return (
    <Button disabled={disabled}>
      <Plus aria-hidden />
      Add category
    </Button>
  )
}

/** The add dialog needs the restaurant's zone and meal periods for a schedule (B3b). */
async function AddCategory() {
  const scheduleSupport = await loadCategoryScheduleSupport()
  return <CategoryDialog scheduleSupport={scheduleSupport} trigger={<AddCategoryButton />} />
}

async function CategoriesView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { preview } = await searchParams

  let categories
  const scheduleSupport = loadCategoryScheduleSupport()
  try {
    categories = await listMenuCategories(preview)
  } catch (error) {
    return <MenuLoadFailure error={error} retryHref="/menu/categories" what="categories" />
  }

  return (
    <div className="flex flex-col gap-4">
      {menuMode() === "preview" ? (
        <>
          <PreviewNotice />
          <PreviewMenuControls />
        </>
      ) : null}
      {categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No categories yet"
          description="Every menu item needs a category. Add one with Add category above."
          className="min-h-72 rounded-3xl border-border bg-card"
        />
      ) : (
        <CategoriesList categories={categories} scheduleSupport={await scheduleSupport} />
      )}
    </div>
  )
}
