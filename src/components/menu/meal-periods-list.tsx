"use client"

import { useState } from "react"
import { Archive, ArchiveRestore, Loader2, Pencil, Trash2 } from "lucide-react"

import { ActionResultMessage } from "@/components/shared/action-result-message"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { activeUsage, mealPeriodLines, usageText, type MealPeriod } from "@/lib/menu/meal-periods"

import { MealPeriodDialog, UsageNames } from "./meal-period-dialog"
import { useMenuCommand } from "./use-menu-command"

/**
 * Meal periods with what uses each (B3b, H6). Active periods can be edited or
 * archived once nothing active uses them; a period is deleted only if it was
 * never used. The menu rules on the server decide; refusals are shown next
 * to the period.
 */
export function MealPeriodsList({ periods, timeZone }: { periods: MealPeriod[]; timeZone: string }) {
  const active = periods.filter((period) => period.status === "active")
  const archived = periods.filter((period) => period.status === "archived")
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="active-meal-periods" className="flex flex-col gap-3">
        <h2 id="active-meal-periods" className="text-lg font-semibold">
          Meal periods <span className="font-normal text-muted-foreground">({active.length})</span>
        </h2>
        {active.length ? (
          <ul aria-labelledby="active-meal-periods" className="flex flex-col gap-2">
            {active.map((period) => (
              <MealPeriodRow key={period.id} period={period} timeZone={timeZone} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No active meal periods.</p>
        )}
      </section>
      {archived.length ? (
        <section aria-labelledby="archived-meal-periods" className="flex flex-col gap-3">
          <h2 id="archived-meal-periods" className="text-lg font-semibold">
            Archived <span className="font-normal text-muted-foreground">({archived.length})</span>
          </h2>
          <ul aria-labelledby="archived-meal-periods" className="flex flex-col gap-2">
            {archived.map((period) => (
              <MealPeriodRow key={period.id} period={period} timeZone={timeZone} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

type Dialog = "archive" | "delete" | null

function MealPeriodRow({ period, timeZone }: { period: MealPeriod; timeZone: string }) {
  const command = useMenuCommand()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [restoring, setRestoring] = useState(false)
  const isArchived = period.status === "archived"
  const used = activeUsage(period)
  const usedText = usageText(used)
  const allText = usageText(period.usage)
  // Anything that still points at it (archived items too) or order history means archive, not delete.
  const deletable = !period.usedOnOrders && !allText

  const open = (next: Dialog) => {
    command.begin()
    setRestoring(false)
    setDialog(next)
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-[0_8px_30px_rgb(31_26_23/6%)] sm:flex-row sm:items-start sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {period.name}
          {isArchived ? (
            <span className="rounded-full border border-neutral-line bg-neutral-soft px-2.5 py-0.5 text-xs font-semibold text-neutral-foreground">
              Archived
            </span>
          ) : null}
        </p>
        <p className="text-sm text-muted-foreground">{mealPeriodLines(period.weekly).join(" · ")}</p>
        <div className="mt-1 text-xs text-muted-foreground">
          {allText ? (
            <details>
              <summary className="w-fit cursor-pointer rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                Used by {allText}
                <span className="sr-only"> ({period.name})</span>
              </summary>
              <UsageNames
                usage={{
                  items: period.usage.items.map((ref) => ({ ...ref, name: ref.archived ? `${ref.name} (archived)` : ref.name })),
                  categories: period.usage.categories.map((ref) => ({ ...ref, name: ref.archived ? `${ref.name} (archived)` : ref.name })),
                }}
              />
            </details>
          ) : (
            <span>Not used by any item or category</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {isArchived ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (command.pending) return
              command.begin()
              setRestoring(true)
              command.run({ type: "restore_meal_period", periodId: period.id }, `${period.name} restored`)
            }}
          >
            {command.pending && restoring ? <Loader2 aria-hidden className="animate-spin" /> : <ArchiveRestore aria-hidden />}
            Restore<span className="sr-only"> {period.name}</span>
          </Button>
        ) : (
          <>
            <MealPeriodDialog
              period={period}
              timeZone={timeZone}
              trigger={
                <Button variant="ghost" size="sm">
                  <Pencil aria-hidden />
                  Edit<span className="sr-only"> {period.name}</span>
                </Button>
              }
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => open("archive")}>
              <Archive aria-hidden />
              Archive<span className="sr-only"> {period.name}</span>
            </Button>
          </>
        )}
        {deletable ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => open("delete")}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 aria-hidden />
            Delete<span className="sr-only"> {period.name}</span>
          </Button>
        ) : null}
      </div>

      {restoring && command.result && !command.result.ok ? (
        <ActionResultMessage result={command.result} successText="" className="sm:max-w-64" />
      ) : null}

      {dialog === "archive" ? (
        <ConfirmDialog
          open
          onOpenChange={(next) => !next && setDialog(null)}
          title={`Archive ${period.name}?`}
          description={
            usedText
              ? `${period.name} is used by ${usedText}. Change their schedules first; archiving is refused while anything active uses it.`
              : "It can no longer be chosen for items or categories. Archived meal periods can be restored."
          }
          confirmLabel="Archive meal period"
          pending={command.pending}
          onConfirm={() =>
            command.run({ type: "archive_meal_period", periodId: period.id }, `${period.name} archived`, () => setDialog(null))
          }
        >
          {usedText ? (
            <div className="text-sm text-muted-foreground">
              <UsageNames usage={used} />
            </div>
          ) : null}
          {command.result && !command.result.ok ? <ActionResultMessage result={command.result} successText="" /> : null}
        </ConfirmDialog>
      ) : null}
      {dialog === "delete" ? (
        <ConfirmDialog
          open
          onOpenChange={(next) => !next && setDialog(null)}
          title={`Delete ${period.name}?`}
          description="Nothing has used it, so it can be deleted for good. This can't be undone."
          confirmLabel="Delete meal period"
          destructive
          pending={command.pending}
          onConfirm={() =>
            command.run({ type: "delete_meal_period", periodId: period.id }, `${period.name} deleted`, () => setDialog(null))
          }
        >
          {command.result && !command.result.ok ? <ActionResultMessage result={command.result} successText="" /> : null}
        </ConfirmDialog>
      ) : null}
    </li>
  )
}
