"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { AlertTriangle, Loader2, Shuffle } from "lucide-react"

import { readMealPeriods } from "@/app/(dashboard)/menu/actions"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { customDraftFromMealPeriods, mealPeriodLines, type MealPeriod } from "@/lib/menu/meal-periods"
import {
  enabledChannels,
  MAX_MEAL_PERIOD_REFS,
  schedulePaths,
  type MealPeriodRef,
  type ScheduleDraft,
  type ScheduleOwner,
} from "@/lib/menu/schedule"
import type { ChannelSettings } from "@/lib/menu/types"
import { fieldId, type FieldErrors } from "@/lib/menu/validation"

import { FieldError } from "./item-options-editors"
import { OrderTypePicker } from "./schedule-editor"

type MealPeriodsDraft = Extract<ScheduleDraft, { mode: "meal_periods" }>
type CustomDraft = Extract<ScheduleDraft, { mode: "custom" }>

/** A period whose definition differs from what the editor loaded. */
type Change = { name: string; before: string[]; after: string[] | null }

/**
 * Meal periods for an item or category schedule (B3b, H1). Each chosen
 * period gets its own order types, within the owner's. Only active periods
 * can be newly chosen; a saved reference to an archived or unknown period is
 * shown so it can be removed, never dropped silently.
 */
export function MealPeriodsFields({
  value,
  onChange,
  onConverted,
  errors,
  timeZone,
  ownerChannels,
  owner,
  mealPeriods,
  newKey,
}: {
  value: MealPeriodsDraft
  onChange: (value: ScheduleDraft) => void
  /** Called with the converted periods' names and the custom draft. */
  onConverted: (names: string[], draft: CustomDraft) => void
  errors: FieldErrors
  timeZone: string
  ownerChannels: ChannelSettings
  owner: ScheduleOwner
  /** Null when meal periods couldn't be loaded. */
  mealPeriods: MealPeriod[] | null
  newKey: () => string
}) {
  // Re-read definitions replace the loaded ones once the user has seen the change.
  const [periods, setPeriods] = useState(mealPeriods)
  const [checking, startCheck] = useTransition()
  const [convertError, setConvertError] = useState<string | null>(null)
  const [pendingConvert, setPendingConvert] = useState<{ changes: Change[]; current: MealPeriod[] } | null>(null)

  const refs = value.periods
  const chosen = new Map(refs.map((ref) => [ref.periodId, ref]))
  const set = (next: MealPeriodRef[]) => {
    setConvertError(null)
    onChange({ mode: "meal_periods", periods: next })
  }

  if (!periods) {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-md border border-warning-line bg-warning-soft px-3 py-2 text-xs text-warning-foreground">
        <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0" />
        <span>
          Meal periods couldn&apos;t be loaded, so this schedule can&apos;t be shown or changed right now. Saving keeps
          it as it is. {refs.length ? `It uses ${refs.length} meal ${refs.length === 1 ? "period" : "periods"}.` : null}
        </span>
      </div>
    )
  }

  const active = periods.filter((period) => period.status === "active")
  // References the list can't offer: archived or unknown periods.
  const stranded = refs.filter((ref) => !active.some((period) => period.id === ref.periodId))
  const nameOf = (periodId: string) => periods.find((period) => period.id === periodId)?.name

  function toggle(period: MealPeriod, checked: boolean) {
    if (checked) set([...refs, { periodId: period.id, channels: enabledChannels(ownerChannels) }])
    else set(refs.filter((ref) => ref.periodId !== period.id))
  }

  function convertWith(current: MealPeriod[]) {
    const result = customDraftFromMealPeriods(refs, current, newKey)
    if (!result.ok) {
      setConvertError("A meal period this schedule uses no longer exists, so it can't be converted. Remove it first.")
      return
    }
    setPeriods(current)
    onConverted(refs.map((ref) => nameOf(ref.periodId) ?? "a meal period"), result.draft)
  }

  function startConvert() {
    setConvertError(null)
    startCheck(async () => {
      // Check the shared definitions again, so the copy matches what's saved now.
      const fresh = await readMealPeriods()
      if (!fresh.ok) {
        setConvertError("Couldn't check the meal periods for changes, so nothing was converted. Try again.")
        return
      }
      const changes: Change[] = []
      for (const ref of refs) {
        const loaded = periods?.find((period) => period.id === ref.periodId)
        const now = fresh.data.find((period) => period.id === ref.periodId)
        if (!loaded) continue
        if (!now || now.version !== loaded.version) {
          changes.push({ name: loaded.name, before: mealPeriodLines(loaded.weekly), after: now ? mealPeriodLines(now.weekly) : null })
        }
      }
      if (changes.some((change) => change.after === null)) {
        setPeriods(fresh.data)
        setConvertError("A meal period this schedule uses was deleted since you opened this page, so nothing was converted.")
        return
      }
      if (changes.length) setPendingConvert({ changes, current: fresh.data })
      else convertWith(fresh.data)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Meal periods</legend>
        <p className="text-xs text-muted-foreground">
          Times are in the restaurant&apos;s time zone, <span className="font-medium text-foreground">{timeZone}</span>.
          Choose the meal periods and, for each, which of this {owner}&apos;s order types use it.
        </p>
        {active.length === 0 && stranded.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
            No meal periods yet.{" "}
            <Link href="/menu/meal-periods" className="font-medium text-primary-text underline-offset-4 hover:underline">
              Add meal periods
            </Link>{" "}
            first, or choose set times instead.
          </p>
        ) : null}
        <ul className="flex flex-col gap-2" aria-label="Meal periods to choose from">
          {active.map((period) => {
            const ref = chosen.get(period.id)
            const id = fieldId(schedulePaths.period(period.id))
            const full = !ref && refs.length >= MAX_MEAL_PERIOD_REFS
            return (
              <li key={period.id} id={id} tabIndex={-1} className="flex flex-col gap-2 rounded-lg border bg-background p-3 outline-none">
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id={`${id}-toggle`}
                    checked={Boolean(ref)}
                    disabled={full}
                    aria-describedby={`${id}-times`}
                    onCheckedChange={(checked) => toggle(period, checked === true)}
                    className="mt-0.5"
                  />
                  <div className="grid gap-0.5">
                    <Label htmlFor={`${id}-toggle`}>{period.name}</Label>
                    <span id={`${id}-times`} className="text-xs text-muted-foreground">
                      {mealPeriodLines(period.weekly).join("; ")}
                    </span>
                  </div>
                </div>
                <FieldError path={schedulePaths.period(period.id)} errors={errors} />
                {ref ? (
                  <OrderTypePicker
                    path={schedulePaths.periodChannels(period.id)}
                    name={period.name}
                    value={ref.channels}
                    itemChannels={ownerChannels}
                    owner={owner}
                    errors={errors}
                    onChange={(channels) => set(refs.map((candidate) => (candidate.periodId === period.id ? { ...candidate, channels } : candidate)))}
                  />
                ) : null}
              </li>
            )
          })}
          {stranded.map((ref) => {
            const id = fieldId(schedulePaths.period(ref.periodId))
            const period = periods.find((candidate) => candidate.id === ref.periodId)
            return (
              <li key={ref.periodId} id={id} tabIndex={-1} className="flex flex-col gap-2 rounded-lg border border-warning-line bg-warning-soft p-3 text-warning-foreground outline-none">
                <p className="text-sm font-medium">{period ? `${period.name} (archived)` : "Unknown meal period"}</p>
                <p className="text-xs">
                  {period
                    ? "This meal period is archived. Remove it here, or restore it under Meal periods."
                    : "This meal period wasn't found. Remove it here."}
                </p>
                <FieldError path={schedulePaths.period(ref.periodId)} errors={errors} />
                <Button type="button" variant="outline" size="sm" className="w-fit bg-background" onClick={() => set(refs.filter((candidate) => candidate.periodId !== ref.periodId))}>
                  Remove<span className="sr-only"> {period?.name ?? "unknown meal period"}</span>
                </Button>
              </li>
            )
          })}
        </ul>
      </fieldset>

      {refs.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Button type="button" variant="outline" size="sm" className="w-fit" aria-disabled={checking || undefined} onClick={() => !checking && startConvert()}>
            {checking ? <Loader2 aria-hidden className="animate-spin" /> : <Shuffle aria-hidden />}
            Convert to custom times
          </Button>
          <p className="text-xs text-muted-foreground">
            Copies the chosen meal periods&apos; times into this {owner}&apos;s own schedule, so they no longer follow changes to
            the meal periods. The meal periods themselves aren&apos;t changed.
          </p>
          {convertError ? (
            <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
              {convertError}
            </p>
          ) : null}
        </div>
      ) : null}

      {pendingConvert ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingConvert(null)}
          title="Meal periods changed since you opened this page"
          description={
            <div className="flex flex-col gap-2">
              <p>Converting copies the times as they are now:</p>
              <ul className="flex flex-col gap-1.5">
                {pendingConvert.changes.map((change) => (
                  <li key={change.name}>
                    <span className="font-medium text-foreground">{change.name}</span>: now {change.after?.join("; ")}
                    <span className="block text-xs">This page showed {change.before.join("; ")}.</span>
                  </li>
                ))}
              </ul>
            </div>
          }
          confirmLabel="Convert with current times"
          onConfirm={() => {
            const { current } = pendingConvert
            setPendingConvert(null)
            convertWith(current)
          }}
        />
      ) : null}
    </div>
  )
}
