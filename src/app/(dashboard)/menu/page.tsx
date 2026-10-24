import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { Plus, Tags } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/dashboard/page-header"
import { MenuItemsList } from "@/components/menu/menu-items-list"
import { MenuPagination } from "@/components/menu/menu-pagination"
import { MenuEmpty, MenuListSkeleton, MenuLoadFailure, MenuNoResults } from "@/components/menu/menu-states"
import { MenuToolbar } from "@/components/menu/menu-toolbar"
import { PreviewMenuControls } from "@/components/menu/preview-menu-controls"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { hasActiveMenuFilters, menuHref, parseMenuItemListQuery, type RawSearchParams } from "@/lib/menu/query"
import { getMenuContext, listMenuCategories, listMenuItems, menuMode } from "@/lib/menu/service"
import type { MenuCategory, MenuItemListQuery } from "@/lib/menu/types"

export const metadata: Metadata = {
  title: "Menu",
}

export default function MenuPage({ searchParams }: PageProps<"/menu">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Menu"
        description="Manage the dishes and drinks on your menu, their prices and options, and whether they can be ordered."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/menu/categories">
                <Tags aria-hidden />
                Categories
              </Link>
            </Button>
            <Button asChild>
              <Link href="/menu/new">
                <Plus aria-hidden />
                Add item
              </Link>
            </Button>
          </>
        }
      />
      <Suspense fallback={<MenuListSkeleton />}>
        <MenuView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function MenuView({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = await searchParams
  const query = parseMenuItemListQuery(params)

  // The category filter is optional: if categories fail, the list still loads.
  let categories: MenuCategory[] | null = null
  try {
    categories = await listMenuCategories()
  } catch {
    categories = null
  }

  const isPreview = menuMode() === "preview"
  return (
    <div className="flex flex-col gap-4">
      {isPreview ? <PreviewNotice detail="Sample items have ids starting prv-." /> : null}
      <MenuToolbar query={query} categories={categories} />
      {/* Keyed so a new filter shows the loading state instead of stale rows. */}
      <Suspense key={menuHref(query)} fallback={<MenuListSkeleton />}>
        <MenuResults query={query} preview={params.preview} categories={categories ?? []} isPreview={isPreview} />
      </Suspense>
    </div>
  )
}

async function MenuResults({
  query,
  preview,
  categories,
  isPreview,
}: {
  query: MenuItemListQuery
  preview: unknown
  categories: MenuCategory[]
  isPreview: boolean
}) {
  let loaded
  try {
    const [context, result] = await Promise.all([getMenuContext(), listMenuItems(query, preview)])
    loaded = { context, result }
  } catch (error) {
    // No fallback data: a failed request is shown as a failure.
    return <MenuLoadFailure error={error} retryHref={menuHref(query)} />
  }
  const { context, result } = loaded

  // Preview tools sit inside this streamed section, so their dialog can't
  // open (and hide the page) before the list has hydrated.
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
        context={{ timeZone: context.timeZone, locale: context.locale }}
      />
      <MenuPagination query={query} result={result} />
    </div>
  )
}
