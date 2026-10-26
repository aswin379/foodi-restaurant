"use client"

import { useState } from "react"
import Link from "next/link"
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Loader2, Pencil, Trash2 } from "lucide-react"

import { ActionResultMessage } from "@/components/shared/action-result-message"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { ORDER_TYPES, orderTypeLabels } from "@/lib/domain/order-types"
import { mealPeriodLabels } from "@/lib/menu/meal-periods"
import { scheduleLines } from "@/lib/menu/schedule"
import type { MenuCategory } from "@/lib/menu/types"

import { CategoryDialog, type CategoryScheduleSupport } from "./category-dialog"
import { useMenuCommand } from "./use-menu-command"

const itemsHref = (category: MenuCategory) => `/menu?category=${encodeURIComponent(category.id)}`

/**
 * Categories in menu order, with a keyboard-friendly priority list (Move up /
 * Move down), plus archive, restore and delete. The menu rules on the server
 * decide what's allowed; refusals are shown next to the category.
 */
export function CategoriesList({
  categories,
  scheduleSupport = null,
}: {
  categories: MenuCategory[]
  scheduleSupport?: CategoryScheduleSupport
}) {
  const active = categories.filter((category) => !category.archived).sort((a, b) => a.position - b.position)
  const archived = categories.filter((category) => category.archived)

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="active-categories" className="flex flex-col gap-3">
        <h2 id="active-categories" className="text-sm font-semibold">
          Menu order <span className="font-normal text-muted-foreground">({active.length})</span>
        </h2>
        <ol className="flex flex-col gap-2">
          {active.map((category, index) => (
            <CategoryRow
              key={category.id}
              category={category}
              scheduleSupport={scheduleSupport}
              index={index}
              isFirst={index === 0}
              isLast={index === active.length - 1}
            />
          ))}
        </ol>
      </section>

      {archived.length > 0 ? (
        <section aria-labelledby="archived-categories" className="flex flex-col gap-3">
          <h2 id="archived-categories" className="text-sm font-semibold">
            Archived <span className="font-normal text-muted-foreground">({archived.length})</span>
          </h2>
          <ul className="flex flex-col gap-2">
            {archived.map((category) => (
              <CategoryRow key={category.id} category={category} scheduleSupport={scheduleSupport} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

type Dialog = "archive" | "delete" | null

function CategoryRow({
  category,
  scheduleSupport,
  index,
  isFirst = false,
  isLast = false,
}: {
  category: MenuCategory
  scheduleSupport: CategoryScheduleSupport
  index?: number
  isFirst?: boolean
  isLast?: boolean
}) {
  const command = useMenuCommand()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [direct, setDirect] = useState<string | null>(null)
  const offFor = ORDER_TYPES.filter((type) => !category.channels[type])

  const runDirect = (key: string, run: () => void) => {
    if (command.pending) return
    command.begin()
    setDirect(key)
    run()
  }
  const open = (next: Dialog) => {
    command.begin()
    setDirect(null)
    setDialog(next)
  }
  const close = (next: boolean) => {
    if (!next) setDialog(null)
  }
  const busy = (key: string) => command.pending && direct === key

  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {index !== undefined ? (
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold tabular-nums">
            {index + 1}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {category.name}
            {!category.active && !category.archived ? (
              <span className="rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
                Off
              </span>
            ) : null}
          </p>
          {category.description ? <p className="text-xs text-muted-foreground">{category.description}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {category.archived ? (
              "Archived · not on your menu"
            ) : (
              <Link
                href={itemsHref(category)}
                className="rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {category.itemCount} {category.itemCount === 1 ? "item" : "items"}
                <span className="sr-only"> in {category.name}</span>
              </Link>
            )}
            {offFor.length > 0 ? ` · Not for ${offFor.map((type) => orderTypeLabels[type].toLowerCase()).join(", ")}` : null}
          </p>
          <CategorySchedule category={category} scheduleSupport={scheduleSupport} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {category.archived ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              runDirect("restore", () =>
                command.run({ type: "restore_category", categoryId: category.id }, `${category.name} restored`)
              )
            }
          >
            {busy("restore") ? <Loader2 aria-hidden className="animate-spin" /> : <ArchiveRestore aria-hidden />}
            Restore<span className="sr-only"> {category.name}</span>
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${category.name} up`}
              aria-disabled={isFirst || undefined}
              onClick={() =>
                !isFirst &&
                runDirect("up", () =>
                  command.run({ type: "move_category", categoryId: category.id, direction: "up" }, `${category.name} moved up`)
                )
              }
              className={isFirst ? "opacity-40" : undefined}
            >
              {busy("up") ? <Loader2 aria-hidden className="animate-spin" /> : <ArrowUp aria-hidden />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${category.name} down`}
              aria-disabled={isLast || undefined}
              onClick={() =>
                !isLast &&
                runDirect("down", () =>
                  command.run({ type: "move_category", categoryId: category.id, direction: "down" }, `${category.name} moved down`)
                )
              }
              className={isLast ? "opacity-40" : undefined}
            >
              {busy("down") ? <Loader2 aria-hidden className="animate-spin" /> : <ArrowDown aria-hidden />}
            </Button>
            <CategoryDialog
              category={category}
              scheduleSupport={scheduleSupport}
              trigger={
                <Button variant="ghost" size="sm">
                  <Pencil aria-hidden />
                  Edit<span className="sr-only"> {category.name}</span>
                </Button>
              }
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => open("archive")}>
              <Archive aria-hidden />
              Archive<span className="sr-only"> {category.name}</span>
            </Button>
          </>
        )}
        {!category.usedOnOrders ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => open("delete")}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 aria-hidden />
            Delete<span className="sr-only"> {category.name}</span>
          </Button>
        ) : null}
      </div>

      {direct && command.result && !command.result.ok ? (
        <ActionResultMessage result={command.result} successText="" className="sm:max-w-64" />
      ) : null}

      {dialog === "archive" ? (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={`Archive ${category.name}?`}
          description="It leaves your menu but keeps its history. A category can only be archived once its items are moved or archived."
          confirmLabel="Archive category"
          pending={command.pending}
          onConfirm={() =>
            command.run({ type: "archive_category", categoryId: category.id }, `${category.name} archived`, () =>
              setDialog(null)
            )
          }
        >
          {command.result && !command.result.ok ? <ActionResultMessage result={command.result} successText="" /> : null}
        </ConfirmDialog>
      ) : null}
      {dialog === "delete" ? (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={`Delete ${category.name}?`}
          description="It has no order history, so it can be deleted for good. This can't be undone."
          confirmLabel="Delete category"
          destructive
          pending={command.pending}
          onConfirm={() =>
            command.run({ type: "delete_category", categoryId: category.id }, `${category.name} deleted`, () =>
              setDialog(null)
            )
          }
        >
          {command.result && !command.result.ok ? <ActionResultMessage result={command.result} successText="" /> : null}
        </ConfirmDialog>
      ) : null}
    </li>
  )
}

/** The category's schedule, if it has one (B3b). Meal-period names need the loaded periods. */
function CategorySchedule({ category, scheduleSupport }: { category: MenuCategory; scheduleSupport: CategoryScheduleSupport }) {
  const { schedule } = category
  if (schedule.mode === "always") return null
  const periods = scheduleSupport?.mealPeriods
  const lines =
    schedule.mode === "meal_periods" && !periods
      ? ["Meal periods (names couldn't be loaded)"]
      : scheduleLines(schedule, category.channels, periods ? mealPeriodLabels(periods) : undefined)
  const zone = schedule.mode === "custom" && scheduleSupport && schedule.timeZone !== scheduleSupport.timeZone ? schedule.timeZone : null
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{schedule.mode === "meal_periods" ? "During: " : "Only: "}</span>
      {lines.join(" · ")}
      {zone ? ` (times in ${zone})` : null}
    </p>
  )
}
