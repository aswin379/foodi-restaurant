import Link from "next/link"
import { CalendarClock } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatMoney, type ZoneAndLocale } from "@/lib/orders/format"
import { mealPeriodLabels, type MealPeriod } from "@/lib/menu/meal-periods"
import { displayPrice, itemStatus } from "@/lib/menu/rules"
import { scheduleLines, type MealPeriodLabel } from "@/lib/menu/schedule"
import type { MenuCategory, MenuItem } from "@/lib/menu/types"

import { DietaryMark, ItemStatusBadge } from "./item-status-badge"
import { ItemThumbnail } from "./item-thumbnail"
import { MenuItemActions } from "./menu-item-actions"

const editHref = (item: MenuItem) => `/menu/${encodeURIComponent(item.id)}/edit`

function OptionSummary({ item }: { item: MenuItem }) {
  const parts = [
    item.sizes.length ? `${item.sizes.length} size${item.sizes.length > 1 ? "s" : ""}` : null,
    item.optionGroups.length
      ? `${item.optionGroups.length} option group${item.optionGroups.length > 1 ? "s" : ""}`
      : null,
  ].filter(Boolean)
  return parts.length ? <span className="text-xs text-muted-foreground">{parts.join(" · ")}</span> : null
}

/** Lines shown before "+N more"; the editor has the full schedule. */
const SCHEDULE_LINES_SHOWN = 2

/**
 * Custom and meal-period schedules only; "always" is the default and isn't
 * repeated on every row. Order types appear only where a window narrows the
 * item's own. Meal-period names come from `periods`; if they couldn't be
 * loaded, the row says so rather than guessing.
 */
function ScheduleSummary({
  item,
  context,
  periods,
}: {
  item: MenuItem
  context: ZoneAndLocale
  periods: ReadonlyMap<string, MealPeriodLabel> | null
}) {
  const { schedule } = item
  if (schedule.mode === "always") return null
  const lines =
    schedule.mode === "meal_periods" && !periods
      ? ["Meal periods (names couldn't be loaded)"]
      : scheduleLines(schedule, item.channels, periods ?? undefined)
  const hidden = lines.length - SCHEDULE_LINES_SHOWN
  // Times are shown in the zone they were saved in; say so if it isn't the restaurant's current zone.
  const zone = schedule.mode !== "custom" || schedule.timeZone === context.timeZone ? null : schedule.timeZone
  return (
    <span className="flex max-w-md items-start gap-1 text-xs whitespace-normal text-muted-foreground">
      <CalendarClock aria-hidden className="mt-px size-3.5 shrink-0" />
      <span className="flex min-w-0 flex-col">
        <span className="sr-only">{schedule.mode === "meal_periods" ? "Available only during: " : "Available only: "}</span>
        {lines.slice(0, SCHEDULE_LINES_SHOWN).map((line) => (
          <span key={line}>{line}</span>
        ))}
        {hidden > 0 ? <span>+{hidden} more</span> : null}
        {zone ? <span>Times in {zone}</span> : null}
      </span>
    </span>
  )
}

function ItemName({ item }: { item: MenuItem }) {
  return item.archived ? (
    <span className="font-medium">{item.name}</span>
  ) : (
    <Link
      href={editHref(item)}
      className="w-fit rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {item.name}
    </Link>
  )
}

function Price({ item, context }: { item: MenuItem; context: ZoneAndLocale }) {
  const { from, price } = displayPrice(item)
  return (
    <>
      {from ? <span className="font-normal text-muted-foreground">From </span> : null}
      {formatMoney(price, context.locale)}
    </>
  )
}

/** Table from md up, cards below. */
export function MenuItemsList({
  items,
  categories,
  mealPeriods = null,
  context,
}: {
  items: MenuItem[]
  categories: MenuCategory[]
  /** Null when meal periods couldn't be loaded. */
  mealPeriods?: MealPeriod[] | null
  context: ZoneAndLocale
}) {
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const periods = mealPeriods ? mealPeriodLabels(mealPeriods) : null
  const rows = items.map((item) => ({ item, status: itemStatus(item, categoryById.get(item.categoryId) ?? null) }))

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4 text-right">Available · actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ item, status }) => (
              <TableRow key={item.id}>
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <ItemThumbnail imageUrl={item.imageUrl} />
                    <div className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2">
                        <DietaryMark dietary={item.dietary} />
                        <ItemName item={item} />
                      </span>
                      <OptionSummary item={item} />
                      <ScheduleSummary item={item} context={context} periods={periods} />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{item.categoryName}</TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                  <Price item={item} context={context} />
                </TableCell>
                <TableCell className="whitespace-normal">
                  <ItemStatusBadge status={status} context={context} />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <MenuItemActions item={item} status={status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul aria-label="Menu items" className="flex flex-col gap-3 md:hidden">
        {rows.map(({ item, status }) => (
          <li key={item.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <ItemThumbnail imageUrl={item.imageUrl} className="size-12" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-2">
                  <DietaryMark dietary={item.dietary} />
                  <ItemName item={item} />
                </span>
                <span className="text-xs text-muted-foreground">{item.categoryName}</span>
                <OptionSummary item={item} />
                <ScheduleSummary item={item} context={context} periods={periods} />
                <span className="text-sm font-semibold tabular-nums">
                  <Price item={item} context={context} />
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <ItemStatusBadge status={status} context={context} />
              <MenuItemActions item={item} status={status} />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
