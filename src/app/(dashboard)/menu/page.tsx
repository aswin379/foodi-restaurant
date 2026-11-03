import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { CalendarClock, Plus, Tags } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/dashboard/page-header"
import { MenuExportImportButtons } from "@/components/menu/menu-export-import"
import { MenuItemsList } from "@/components/menu/menu-items-list"
import { MenuPagination } from "@/components/menu/menu-pagination"
import { MenuEmpty, MenuListSkeleton, MenuLoadFailure, MenuNoResults } from "@/components/menu/menu-states"
import { MenuToolbar } from "@/components/menu/menu-toolbar"
import { PreviewMenuControls } from "@/components/menu/preview-menu-controls"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { hasActiveMenuFilters, menuHref, parseMenuItemListQuery, type RawSearchParams } from "@/lib/menu/query"
import type { MealPeriod } from "@/lib/menu/meal-periods"
import { getMenuContext, listMealPeriods, listMenuCategories, listMenuItems, menuMode } from "@/lib/menu/service"
import type { MenuCategory, MenuItemListQuery } from "@/lib/menu/types"

export const metadata: Metadata = {
  title: "Menu",
}

export default function MenuPage({ searchParams }: PageProps<"/menu">) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {/* Top Header: Title and Horizontal Description */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Menu
            </h1>
            <span className="text-sm text-muted-foreground sm:text-base font-normal">
              · Manage the dishes and drinks on your menu, their prices and options, and whether they can be ordered.
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button asChild>
              <Link href="/menu/new">
                <Plus aria-hidden className="mr-1 size-4" />
                Add item
              </Link>
            </Button>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-soft bg-card/60 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <MenuExportImportButtons />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/menu/categories">
                <Tags aria-hidden className="mr-1.5 size-3.5" />
                Categories
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/menu/meal-periods">
                <CalendarClock aria-hidden className="mr-1.5 size-3.5" />
                Meal periods
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Suspense fallback={<MenuListSkeleton />}>
        <MenuView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function MenuView({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = await searchParams
  const query = parseMenuItemListQuery(params)

  let categories: MenuCategory[] | null = null
  try {
    categories = await listMenuCategories()
  } catch {
    categories = null
  }
  let mealPeriods: MealPeriod[] | null = null
  try {
    mealPeriods = await listMealPeriods()
  } catch {
    mealPeriods = null
  }

  const isPreview = menuMode() === "preview"
  return (
    <div className="flex flex-col gap-4">
      {isPreview ? <PreviewNotice detail="Sample items have ids starting prv-." /> : null}
      <MenuToolbar query={query} categories={categories} />
      <Suspense key={menuHref(query)} fallback={<MenuListSkeleton />}>
        <MenuResults
          query={query}
          preview={params.preview}
          categories={categories ?? []}
          mealPeriods={mealPeriods}
          isPreview={isPreview}
        />
      </Suspense>
    </div>
  )
}

async function MenuResults({
  query,
  preview,
  categories,
  mealPeriods,
  isPreview,
}: {
  query: MenuItemListQuery
  preview: unknown
  categories: MenuCategory[]
  mealPeriods: MealPeriod[] | null
  isPreview: boolean
}) {
  let loaded
  try {
    const [context, result] = await Promise.all([getMenuContext(), listMenuItems(query, preview)])
    loaded = { context, result }
  } catch (error) {
    return <MenuLoadFailure error={error} retryHref={menuHref(query)} />
  }
  const { context, result } = loaded

  const tools = isPreview ? <PreviewMenuControls /> : null
  if (result.totalItems === 0) {
    const filtered = query.filter !== "all" || hasActiveMenuFilters(query)
    return (
      <div className="flex flex-col gap-4">
        {tools}
        {filtered ? <MenuNoResults clearHref="/menu" /> : <MenuEmpty />}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {tools}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {result.totalItems} {result.totalItems === 1 ? "item" : "items"}
        {result.totalPages > 1
          ? ` · showing ${(result.page - 1) * result.pageSize + 1}–${(result.page - 1) * result.pageSize + result.items.length}`
          : null}
      </p>
      <MenuItemsList
        items={result.items}
        categories={categories}
        mealPeriods={mealPeriods}
        context={{ timeZone: context.timeZone, locale: context.locale }}
      />
      <MenuPagination query={query} result={result} />
    </div>
  )
}
