import { Suspense } from "react"
import type { Metadata } from "next"
import { Plus, Tags } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { CategoriesList } from "@/components/menu/categories-list"
import { CategoryDialog } from "@/components/menu/category-dialog"
import { MenuPreviewNotice } from "@/components/menu/menu-notices"
import { MenuError, MenuListSkeleton, MenuNotConnected } from "@/components/menu/menu-states"
import { MenuServiceError } from "@/lib/menu/errors"
import { listMenuCategories, menuDataSource } from "@/lib/menu/service"

export const metadata: Metadata = {
  title: "Menu categories",
}

export default function MenuCategoriesPage({ searchParams }: PageProps<"/menu/categories">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Categories"
        description="Group your menu into sections, like Starters or Drinks, and see how many items each one holds."
        actions={
          <CategoryDialog
            trigger={
              <Button>
                <Plus aria-hidden />
                Add category
              </Button>
            }
          />
        }
      />
      <Suspense fallback={<MenuListSkeleton label="Loading categories" />}>
        <CategoriesView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function CategoriesView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { preview } = await searchParams
  const notice = menuDataSource() === "fixtures" ? <MenuPreviewNotice /> : null

  let categories
  try {
    categories = await listMenuCategories(preview)
  } catch (error) {
    if (error instanceof MenuServiceError && error.kind === "not_configured") {
      return <MenuNotConnected what="categories" />
    }
    return <MenuError retryHref="/menu/categories" what="categories" />
  }

  return (
    <div className="flex flex-col gap-4">
      {notice}
      {categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No categories yet"
          description="Add a category to start grouping your menu items. Use Add category above."
          className="min-h-72 bg-card"
        />
      ) : (
        <CategoriesList categories={categories} />
      )}
    </div>
  )
}
