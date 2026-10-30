import Link from "next/link"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { hasActiveMenuFilters, menuHref } from "@/lib/menu/query"
import { listFilterLabels } from "@/lib/menu/labels"
import { MENU_LIST_FILTERS, type MenuCategory, type MenuItemListQuery } from "@/lib/menu/types"
import { cn } from "@/lib/utils"

const filterTabs = MENU_LIST_FILTERS.map((value) => ({ value, label: listFilterLabels[value] }))

/** Links and a GET form, so filters work before hydration and are shareable. */
export function MenuToolbar({
  query,
  categories,
}: {
  query: MenuItemListQuery
  /** Null when categories couldn't be loaded; the filter is then hidden. */
  categories: MenuCategory[] | null
}) {
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Filter items by status">
        <ul className="flex w-fit max-w-full flex-wrap gap-1 rounded-3xl bg-card p-1 shadow-[0_4px_14px_rgb(31_26_23/8%)]">
          {filterTabs.map((tab) => {
            const active = query.filter === tab.value
            return (
              <li key={tab.value}>
                <Link
                  href={menuHref(query, { filter: tab.value, page: 1 })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    active
                      ? "bg-primary text-primary-foreground shadow-[0_6px_14px_rgb(214_63_8/25%)]"
                      : "text-muted-foreground hover:bg-primary-faint hover:text-foreground"
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <form
        action="/menu"
        method="get"
        role="search"
        aria-label="Search and filter menu items"
        className="grid gap-4 rounded-3xl bg-card p-5 shadow-[0_8px_30px_rgb(31_26_23/6%)] sm:grid-cols-2 sm:p-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] lg:items-end"
      >
        {query.filter !== "all" ? <input type="hidden" name="filter" value={query.filter} /> : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="menu-search">Item name</Label>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="menu-search"
              name="q"
              type="search"
              defaultValue={query.search}
              placeholder="Search by item name"
              autoComplete="off"
              maxLength={80}
              className="h-10 bg-background pl-9"
            />
          </div>
        </div>
        {categories ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="menu-category">Category</Label>
            <NativeSelect
              id="menu-category"
              name="category"
              defaultValue={query.categoryId ?? ""}
              className="h-10 bg-background"
            >
              <option value="">All categories</option>
              {categories.filter((category) => !category.archived).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <Button type="submit" className="h-10 flex-1 lg:flex-none">
            Apply
          </Button>
          {hasActiveMenuFilters(query) ? (
            <Button asChild variant="ghost" className="h-10">
              <Link href={menuHref({ ...query, search: "", categoryId: null, page: 1 })}>
                Clear filters
              </Link>
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  )
}
