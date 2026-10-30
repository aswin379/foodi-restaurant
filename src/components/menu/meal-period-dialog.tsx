"use client"

import { useId, useState } from "react"
import { CalendarClock, Info, Loader2 } from "lucide-react"

import { FieldError, TimeWindowsFields } from "@/components/hours/time-windows-fields"
import { ActionResultMessage } from "@/components/shared/action-result-message"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { hoursFieldId, type DayDraft } from "@/lib/hours/weekly-hours"
import {
  activeUsage,
  MEAL_PERIOD_NAME_MAX,
  mealPeriodDraftFrom,
  mealPeriodLines,
  mealPeriodPaths,
  usageText,
  validateMealPeriodDraft,
  weeklyFromDraft,
  type MealPeriod,
  type MealPeriodDraft,
} from "@/lib/menu/meal-periods"
import { nextWeekday, WEEKDAYS, weekdayLabels, type Weekday } from "@/lib/time/weekly"

import { useMenuCommand } from "./use-menu-command"

const newKey = () => `new-${crypto.randomUUID().slice(0, 8)}`
const isBlank = (window: { start: string; end: string }) => window.start === "" && window.end === ""

/** Error paths in the order they appear. */
function summaryOrder(draft: MealPeriodDraft) {
  return [
    mealPeriodPaths.name,
    mealPeriodPaths.days,
    ...WEEKDAYS.flatMap((day) => [
      mealPeriodPaths.day(day),
      ...draft.days[day].windows.flatMap((window) => [
        mealPeriodPaths.start(day, window.key),
        mealPeriodPaths.end(day, window.key),
        mealPeriodPaths.window(day, window.key),
      ]),
    ]),
  ]
}

/**
 * Add or edit a meal period (B3b, H6): a name and weekly times in the
 * restaurant's zone, with no order types (H1). Editing changes the shared
 * definition for everything that uses it, so the dialog lists those first.
 * Validated here and again on the server; in preview mode the save is
 * simulated and labelled.
 */
export function MealPeriodDialog({
  period,
  timeZone,
  trigger,
}: {
  period?: MealPeriod
  timeZone: string
  trigger: React.ReactNode
}) {
  const id = useId()
  const command = useMenuCommand()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<MealPeriodDraft>(() => mealPeriodDraftFrom(period))
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})
  const errors = { ...command.fieldErrors, ...localErrors }
  const editing = Boolean(period)
  const used = period ? activeUsage(period) : null
  const usedText = used ? usageText(used) : null

  function onOpenChange(next: boolean) {
    if (command.pending) return
    if (next) {
      setDraft(mealPeriodDraftFrom(period))
      setLocalErrors({})
      command.begin()
    }
    setOpen(next)
  }

  function update(next: MealPeriodDraft) {
    setDraft(next)
    if (Object.keys(localErrors).length) setLocalErrors(validateMealPeriodDraft(next))
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateMealPeriodDraft(draft)
    setLocalErrors(nextErrors)
    const first = summaryOrder(draft).find((path) => nextErrors[path])
    if (first) {
      document.getElementById(first === mealPeriodPaths.name ? `${id}-name` : hoursFieldId(first))?.focus()
      return
    }
    const name = draft.name.trim()
    command.run(
      { type: "save_meal_period", periodId: period?.id ?? null, version: period?.version ?? null, draft },
      editing ? `${name} updated` : `${name} added`,
      () => setOpen(false)
    )
  }

  const valid = Object.keys(validateMealPeriodDraft(draft)).length === 0
  const saves = valid ? mealPeriodLines(weeklyFromDraft(draft.days)) : null
  const generalFailure = command.result && !command.result.ok && !command.result.fieldErrors ? command.result : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${period?.name}` : "Add meal period"}</DialogTitle>
            <DialogDescription>
              A named set of times, like Lunch, that items and categories can use. Each item or category chooses which of
              its order types use it.
            </DialogDescription>
          </DialogHeader>

          {editing && used ? (
            <div role="note" className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
              <Info aria-hidden className="mt-px size-3.5 shrink-0" />
              {usedText ? (
                <div>
                  <p>
                    Changing the times changes them for the {usedText} that use {period?.name}. Their order types stay as
                    they are.
                  </p>
                  <UsageNames usage={used} />
                </div>
              ) : (
                <p>No items or categories use {period?.name} at the moment.</p>
              )}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-name`} className="gap-2">
              Name
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Required</span>
            </Label>
            <Input
              id={`${id}-name`}
              value={draft.name}
              onChange={(event) => update({ ...draft, name: event.target.value })}
              maxLength={MEAL_PERIOD_NAME_MAX + 20}
              autoComplete="off"
              aria-required="true"
              aria-invalid={errors[mealPeriodPaths.name] ? true : undefined}
              aria-describedby={errors[mealPeriodPaths.name] ? `${hoursFieldId(mealPeriodPaths.name)}-error` : undefined}
              className="h-10"
            />
            <FieldError path={mealPeriodPaths.name} errors={errors} />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend id={hoursFieldId(mealPeriodPaths.days)} tabIndex={-1} className="mb-1 text-sm font-medium outline-none">
              Days and times
            </legend>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <CalendarClock aria-hidden className="mt-px size-3.5 shrink-0" />
              <span>
                Times are in the restaurant&apos;s time zone, <span className="font-medium text-foreground">{timeZone}</span>.
                An end before the start runs past midnight. Restaurant hours still apply on top.
              </span>
            </p>
            <FieldError path={mealPeriodPaths.days} errors={errors} />
            <ul className="flex flex-col gap-2" aria-label="Days">
              {WEEKDAYS.map((day) => (
                <DayRow
                  key={day}
                  day={day}
                  value={draft.days[day]}
                  errors={errors}
                  onChange={(next) => update({ ...draft, days: { ...draft.days, [day]: next } })}
                />
              ))}
            </ul>
          </fieldset>

          {saves ? (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs" aria-label="Saves as">
              <p className="font-medium">Saves as</p>
              <p className="mt-1 text-muted-foreground">{saves.join(" · ")}</p>
            </div>
          ) : null}

          {generalFailure ? <ActionResultMessage result={generalFailure} successText="" /> : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" aria-disabled={command.pending || undefined}>
              {command.pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {editing ? "Save changes" : "Add meal period"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function UsageNames({ usage }: { usage: { items: { id: string; name: string }[]; categories: { id: string; name: string }[] } }) {
  return (
    <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4">
      {usage.categories.map((ref) => (
        <li key={`category-${ref.id}`}>Category: {ref.name}</li>
      ))}
      {usage.items.map((ref) => (
        <li key={`item-${ref.id}`}>{ref.name}</li>
      ))}
    </ul>
  )
}

function DayRow({
  day,
  value,
  errors,
  onChange,
}: {
  day: Weekday
  value: DayDraft
  errors: Record<string, string>
  onChange: (next: DayDraft) => void
}) {
  const dayPath = mealPeriodPaths.day(day)
  const label = weekdayLabels[day]
  const allDayId = `${hoursFieldId(dayPath)}-all-day`
  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-background p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2.5">
          <Checkbox
            id={hoursFieldId(dayPath)}
            checked={value.enabled}
            aria-describedby={errors[dayPath] ? `${hoursFieldId(dayPath)}-error` : undefined}
            onCheckedChange={(checked) =>
              onChange(
                checked === true
                  ? {
                      ...value,
                      enabled: true,
                      windows: value.windows.length || value.allDay ? value.windows : [{ key: newKey(), start: "", end: "" }],
                    }
                  : { ...value, enabled: false }
              )
            }
          />
          <Label htmlFor={hoursFieldId(dayPath)}>{label}</Label>
        </div>
        {value.enabled ? (
          <div className="flex items-center gap-2">
            <Checkbox
              id={allDayId}
              checked={value.allDay}
              onCheckedChange={(checked) =>
                onChange(
                  checked === true
                    ? { ...value, allDay: true, windows: value.windows.filter((window) => !isBlank(window)) }
                    : { ...value, allDay: false, windows: value.windows.length ? value.windows : [{ key: newKey(), start: "", end: "" }] }
                )
              }
            />
            <Label htmlFor={allDayId} className="font-normal">
              All day<span className="sr-only"> on {label}</span>
            </Label>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Not included</span>
        )}
      </div>
      <FieldError path={dayPath} errors={errors} />
      {value.enabled && value.allDay ? <p className="text-xs text-muted-foreground">All day: midnight to midnight.</p> : null}
      {value.enabled && (!value.allDay || value.windows.length > 0) ? (
        <TimeWindowsFields
          windows={value.windows}
          name={label}
          nextDayLabel={weekdayLabels[nextWeekday(day)]}
          paths={{
            window: (key) => mealPeriodPaths.window(day, key),
            start: (key) => mealPeriodPaths.start(day, key),
            end: (key) => mealPeriodPaths.end(day, key),
          }}
          errors={errors}
          newKey={newKey}
          onChange={(windows) => onChange({ ...value, windows })}
        />
      ) : null}
    </li>
  )
}
