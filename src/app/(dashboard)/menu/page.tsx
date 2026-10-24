import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { Plus, Tags } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/dashboard/page-header"
import { MenuItemsList } from "@/components/menu/menu-items-list"
import { MenuPreviewNotice } from "@/components/menu/menu-notices"
import { MenuPagination } from "@/components/menu/menu-pagination"
import {
  MenuEmpty,
  MenuError,
  MenuListSkeleton,
  MenuNoResults,
  MenuNotConnected,
} from "@/components/menu/menu-states"
import { MenuToolbar } from "@/components/menu/menu-toolbar"
import { MenuServiceError } from "@/lib/menu/errors"
import {
  hasActiveMenuFilters,
  menuHref,
  parseMenuItemListQuery,
  type RawSearchParams,
} from "@/lib/menu/query"
import { listMenuCategories, listMenuItems, menuDataSource } from "@/lib/menu/service"
import type { MenuCategory, MenuItemListQuery } from "@/lib/menu/types"

export const metadata: Metadata = {
  title: "Menu",
}

export default function MenuPage({ searchParams }: PageProps<"/menu">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Menu"
        description="Manage the dishes and drinks on your menu, their prices and whether they can be ordered."
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

  // The category filter is optional: if categories fail, the list still works.
  let categories: MenuCategory[] | null = null
  try {
    categories = await listMenuCategories()
  } catch {
    categories = null
  }

  return (
    <div className="flex flex-col gap-4">
      {menuDataSource() === "fixtures" ? <MenuPreviewNotice /> : null}
      <MenuToolbar query={query} categories={categories} />
      {/* Keyed so a new filter shows the loading state instead of stale rows. */}
      <Suspense key={menuHref(query)} fallback={<MenuListSkeleton />}>
        <MenuResults query={query} preview={params.preview} />
      </Suspense>
    </div>
  )
}

async function MenuResults({ query, preview }: { query: MenuItemListQuery; preview: unknown }) {
  let result
  try {
    result = await listMenuItems(query, preview)
  } catch (error) {
    if (error instanceof MenuServiceError && error.kind === "not_configured") {
      return <MenuNotConnected />
    }
    // No fallback data: a failed request is shown as a failure.
    return <MenuError retryHref={menuHref(query)} />
  }

  if (result.totalItems === 0) {
    const filtered = query.availability !== "all" || hasActiveMenuFilters(query)
    return filtered ? <MenuNoResults clearHref="/menu" /> : <MenuEmpty />
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {result.totalItems} {result.totalItems === 1 ? "item" : "items"}
        {result.totalPages > 1
          ? ` · showing ${(result.page - 1) * result.pageSize + 1}–${(result.page - 1) * result.pageSize + result.items.length}`
          : null}
      </p>
      <MenuItemsList items={result.items} />
      <MenuPagination query={query} result={result} />
    </div>
  )
}
