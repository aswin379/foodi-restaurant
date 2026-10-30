"use client"

import { useId, useState } from "react"
import { CalendarClock, Copy, Moon, Plus, Sun, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ORDER_TYPES, orderTypeLabels, type OrderType } from "@/lib/domain/order-types"
import {
  emptyDays,
  enabledChannels,
  formatWindow,
  listOrderTypes,
  MAX_WINDOWS_PER_DAY,
  mergeDayWindows,
  scheduleFromDraft,
  scheduleLines,
  schedulePaths,
  validateScheduleDraft,
  WEEKDAYS,
  weekdayLabels,
  type DayDraft,
  type ScheduleDraft,
  type ScheduleOwner,
  type Weekday,
  type WindowDraft,
} from "@/lib/menu/schedule"
import type { MealPeriod } from "@/lib/menu/meal-periods"
import type { ChannelSettings } from "@/lib/menu/types"
import { fieldId, type FieldErrors } from "@/lib/menu/validation"
import { isOvernight, validateWindow } from "@/lib/time/windows"

import { FieldError } from "./item-options-editors"
import { MealPeriodsFields } from "./meal-period-picker"

const emptyWindow = (key: string, channels: OrderType[]): WindowDraft => ({ key, start: "", end: "", channels })
const isBlank = (window: WindowDraft) => window.start === "" && window.end === ""
const windowSignature = (window: { start: string; end: string; channels: OrderType[] }) =>
  `${window.start}-${window.end}-${window.channels.join(",")}`

/**
 * Item schedule (PRD §3.4 with Q12 and Q13): always, or set days in the
 * restaurant's time zone. Each day is All day and/or has time windows, and
 * each of those names its order types, within the item's own order types.
 * An end before the start runs into the next day (§3.2). Overlapping windows
 * are merged on save and the editor shows the result. The schedule only
 * narrows availability; the server decides what's orderable.
 *
 * B3b: also used for category schedules (`owner`), and offers reusable meal
 * periods as a third option when `mealPeriods` is passed. A schedule never
 * mixes meal periods with custom times.
 */
export function ScheduleEditor({
  value,
  onChange,
  errors,
  timeZone,
  savedTimeZone,
  itemChannels,
  newKey,
  owner = "item",
  mealPeriods,
}: {
  value: ScheduleDraft
  onChange: (value: ScheduleDraft) => void
  errors: FieldErrors
  /** The restaurant's IANA zone; the server stores the schedule in it. */
  timeZone: string
  /** Zone of the stored schedule, when editing a custom one. */
  savedTimeZone?: string
  /** The owner's own order types; the schedule can only narrow them. */
  itemChannels: ChannelSettings
  newKey: () => string
  /** Whose schedule this is, for wording and ids. */
  owner?: ScheduleOwner
  /** Meal periods to choose from; null when they couldn't be loaded. Leave out to hide the option. */
  mealPeriods?: MealPeriod[] | null
}) {
  const custom = value.mode === "custom" ? value : null
  const [convertedFrom, setConvertedFrom] = useState<string[] | null>(null)
  const offerMealPeriods = mealPeriods !== undefined
  // Without loaded periods, the option can't be chosen anew, only kept.
  const mealPeriodsDisabled = mealPeriods === null && value.mode !== "meal_periods"

  // Show what will be saved once the schedule is valid.
  const saved =
    custom && Object.keys(validateScheduleDraft(value, itemChannels, owner)).length === 0
      ? scheduleLines(scheduleFromDraft(value, timeZone), itemChannels)
      : []

  function copyDay(from: Weekday, targets: Weekday[]) {
    if (!custom) return
    const source = custom.days[from]
    const days = { ...custom.days }
    for (const target of targets) {
      days[target] = {
        enabled: true,
        allDay: source.allDay ? { channels: [...source.allDay.channels] } : null,
        windows: source.windows
          .filter((window) => validateWindow(window) === null)
          .map((window) => ({ ...window, channels: [...window.channels], key: newKey() })),
      }
    }
    onChange({ ...custom, days })
  }

  function copyWindow(window: WindowDraft, targets: Weekday[]) {
    if (!custom) return
    const days = { ...custom.days }
    for (const target of targets) {
      const existing = days[target].enabled ? days[target].windows.filter((candidate) => !isBlank(candidate)) : []
      if (existing.some((candidate) => windowSignature(candidate) === windowSignature(window))) continue
      days[target] = {
        enabled: true,
        allDay: days[target].enabled ? days[target].allDay : null,
        windows: [...existing, { ...window, channels: [...window.channels], key: newKey() }].slice(0, MAX_WINDOWS_PER_DAY),
      }
    }
    onChange({ ...custom, days })
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="grid gap-2">
        <legend id={fieldId(schedulePaths.root)} tabIndex={-1} className="mb-1 text-sm font-medium outline-none">
          Schedule
        </legend>
        <RadioGroup
          value={value.mode}
          onValueChange={(mode) => {
            setConvertedFrom(null)
            onChange(
              mode === "always"
                ? { mode: "always" }
                : mode === "meal_periods"
                  ? { mode: "meal_periods", periods: [] }
                  : { mode: "custom", days: custom?.days ?? emptyDays() }
            )
          }}
          className="gap-2"
        >
          <div className="flex items-start gap-2.5">
            <RadioGroupItem value="always" id={`${owner}-schedule-always`} className="mt-0.5" />
            <div className="grid gap-0.5">
              <Label htmlFor={`${owner}-schedule-always`} className="font-normal">
                Always available
              </Label>
              <span className="text-xs text-muted-foreground">
                {owner === "item" ? "Follows restaurant and category hours." : "Follows restaurant hours."}
              </span>
            </div>
          </div>
          {offerMealPeriods ? (
            <div className="flex items-start gap-2.5">
              <RadioGroupItem
                value="meal_periods"
                id={`${owner}-schedule-meal-periods`}
                disabled={mealPeriodsDisabled}
                aria-describedby={`${owner}-schedule-meal-periods-help`}
                className="mt-0.5"
              />
              <div className="grid gap-0.5">
                <Label htmlFor={`${owner}-schedule-meal-periods`} className="font-normal">
                  During meal periods
                </Label>
                <span id={`${owner}-schedule-meal-periods-help`} className="text-xs text-muted-foreground">
                  {mealPeriodsDisabled
                    ? "Meal periods couldn't be loaded, so they can't be chosen right now."
                    : "Use your restaurant's meal periods, like Lunch. Changing a meal period changes it everywhere it's used."}
                </span>
              </div>
            </div>
          ) : null}
          <div className="flex items-start gap-2.5">
            <RadioGroupItem value="custom" id={`${owner}-schedule-custom`} className="mt-0.5" />
            <div className="grid gap-0.5">
              <Label htmlFor={`${owner}-schedule-custom`} className="font-normal">
                Only at set times
              </Label>
              <span className="text-xs text-muted-foreground">Choose days, times and order types.</span>
            </div>
          </div>
        </RadioGroup>
        <FieldError path={schedulePaths.root} errors={errors} />
      </fieldset>

      {value.mode === "meal_periods" ? (
        <MealPeriodsFields
          value={value}
          onChange={onChange}
          onConverted={(names, draft) => {
            setConvertedFrom(names)
            onChange(draft)
          }}
          errors={errors}
          timeZone={timeZone}
          ownerChannels={itemChannels}
          owner={owner}
          mealPeriods={mealPeriods ?? null}
          newKey={newKey}
        />
      ) : null}

      {custom ? (
        <>
          {convertedFrom ? (
            <p role="status" className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
              Converted from {convertedFrom.join(", ")}. These times are now this {owner}&apos;s own; the meal{" "}
              {convertedFrom.length === 1 ? "period isn't" : "periods aren't"} changed. Nothing is saved until you save.
            </p>
          ) : null}
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <CalendarClock aria-hidden className="mt-px size-3.5 shrink-0" />
            <span>
              Times are in the restaurant&apos;s time zone, <span className="font-medium text-foreground">{timeZone}</span>.
              All day means midnight to midnight there.{" "}
              {owner === "item"
                ? "The schedule can only narrow when the item is available: restaurant hours, pauses, its category, its order types and stock still apply."
                : "The schedule can only narrow when the category's items are available: restaurant hours, pauses, its order types and each item's own settings still apply."}
            </span>
          </p>
          {savedTimeZone && savedTimeZone !== timeZone ? (
            <p className="rounded-md border border-warning-line bg-warning-soft px-3 py-2 text-xs text-warning-foreground">
              These times were saved for {savedTimeZone}. Saving keeps the same clock times but applies them in{" "}
              {timeZone}.
            </p>
          ) : null}
          <ul className="flex flex-col gap-2" aria-label="Days">
            {WEEKDAYS.map((day) => (
              <DayRow
                key={day}
                day={day}
                value={custom.days[day]}
                errors={errors}
                itemChannels={itemChannels}
                owner={owner}
                newKey={newKey}
                onChange={(next) => onChange({ ...custom, days: { ...custom.days, [day]: next } })}
                onCopyDay={(targets) => copyDay(day, targets)}
                onCopyWindow={copyWindow}
              />
            ))}
          </ul>
          {saved.length > 0 ? (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
              <p className="font-medium">Saves as</p>
              <ul className="mt-1 flex flex-col gap-0.5 text-muted-foreground">
                {saved.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="mt-1 text-muted-foreground">Order types are shown only where they narrow the {owner}&apos;s own.</p>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function DayRow({
  day,
  value,
  errors,
  itemChannels,
  owner,
  newKey,
  onChange,
  onCopyDay,
  onCopyWindow,
}: {
  day: Weekday
  value: DayDraft
  errors: FieldErrors
  itemChannels: ChannelSettings
  owner: ScheduleOwner
  newKey: () => string
  onChange: (next: DayDraft) => void
  onCopyDay: (targets: Weekday[]) => void
  onCopyWindow: (window: WindowDraft, targets: Weekday[]) => void
}) {
  const { enabled, allDay, windows } = value
  const label = weekdayLabels[day]
  const offered = enabledChannels(itemChannels)
  // Order types a new timed window starts with: those not already available all day.
  const forNewWindow = () => {
    const rest = offered.filter((type) => !allDay?.channels.includes(type))
    return rest.length ? rest : offered
  }
  const allDayCoversAll = allDay !== null && offered.every((type) => allDay.channels.includes(type))

  const validWindows = windows.filter((window) => validateWindow(window) === null && window.channels.length > 0)
  const merged = mergeDayWindows(validWindows)
  const enteredSignatures = new Set(validWindows.map((window) => windowSignature({ ...window, channels: [...window.channels].sort() })))
  const willMerge =
    validWindows.length > 1 &&
    (merged.length !== validWindows.length ||
      merged.some((window) => !enteredSignatures.has(windowSignature({ ...window, channels: [...window.channels].sort() }))))

  const allDayToggleId = `${fieldId(schedulePaths.allDay(day))}-toggle`

  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2.5">
            <Checkbox
              id={fieldId(schedulePaths.day(day))}
              checked={enabled}
              aria-describedby={errors[schedulePaths.day(day)] ? `${fieldId(schedulePaths.day(day))}-error` : undefined}
              onCheckedChange={(checked) =>
                onChange(
                  checked === true
                    ? {
                        enabled: true,
                        allDay,
                        // A newly switched-on day starts with one empty window to fill in.
                        windows: windows.length || allDay ? windows : [emptyWindow(newKey(), offered)],
                      }
                    : { ...value, enabled: false }
                )
              }
            />
            <Label htmlFor={fieldId(schedulePaths.day(day))}>{label}</Label>
          </div>
          {enabled ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id={allDayToggleId}
                checked={allDay !== null}
                onCheckedChange={(checked) => {
                  if (checked === true) {
                    // Untouched empty rows go; windows with times stay and must use other order types.
                    const kept = windows.filter((window) => !isBlank(window))
                    const used = new Set(kept.flatMap((window) => window.channels))
                    const rest = offered.filter((type) => !used.has(type))
                    onChange({ enabled, allDay: { channels: rest.length ? rest : offered }, windows: kept })
                  } else {
                    onChange({ enabled, allDay: null, windows: windows.length ? windows : [emptyWindow(newKey(), offered)] })
                  }
                }}
              />
              <Label htmlFor={allDayToggleId} className="font-normal">
                All day<span className="sr-only"> on {label}</span>
              </Label>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Not available</span>
          )}
        </div>
        {enabled && (allDay || validWindows.length > 0) ? (
          <CopyToDays
            day={day}
            triggerLabel={`Copy ${label} to…`}
            title={`Copy ${label}'s schedule to`}
            actionLabel="Copy"
            hint="Replaces the schedule on the days you choose."
            onCopy={onCopyDay}
          />
        ) : null}
      </div>
      <FieldError path={schedulePaths.day(day)} errors={errors} />

      {enabled && allDay ? (
        <div className="flex flex-col gap-2 rounded-md bg-muted/40 px-3 py-2">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Sun aria-hidden className="size-4 text-muted-foreground" />
            All day
            <span className="text-xs font-normal text-muted-foreground">midnight to midnight</span>
          </p>
          <OrderTypePicker
            path={schedulePaths.allDay(day)}
            name={`All day on ${label}`}
            value={allDay.channels}
            itemChannels={itemChannels}
            owner={owner}
            errors={errors}
            onChange={(channels) => onChange({ enabled, allDay: { channels }, windows })}
          />
        </div>
      ) : null}

      {enabled ? (
        <>
          {allDay && windows.length > 0 ? (
            <p className="text-xs text-muted-foreground">Set times, for order types that aren&apos;t available all day:</p>
          ) : null}
          {windows.length > 0 ? (
            <ul className="flex flex-col gap-3" aria-label={`${label} time windows`}>
              {windows.map((window, index) => (
                <WindowRow
                  key={window.key}
                  day={day}
                  index={index}
                  window={window}
                  errors={errors}
                  itemChannels={itemChannels}
                  owner={owner}
                  onChange={(next) =>
                    onChange({
                      enabled,
                      allDay,
                      windows: windows.map((candidate) => (candidate.key === window.key ? next : candidate)),
                    })
                  }
                  onRemove={() =>
                    onChange({ enabled, allDay, windows: windows.filter((candidate) => candidate.key !== window.key) })
                  }
                  onCopy={(targets) => onCopyWindow(window, targets)}
                />
              ))}
            </ul>
          ) : null}
          {willMerge ? (
            <p className="text-xs text-warning-foreground">
              Overlapping windows will be saved as {merged.map((window) => formatWindow(window, itemChannels)).join(", ")}.
            </p>
          ) : null}
          {allDayCoversAll && windows.length === 0 ? null : windows.length < MAX_WINDOWS_PER_DAY ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => onChange({ enabled, allDay, windows: [...windows, emptyWindow(newKey(), forNewWindow())] })}
            >
              <Plus aria-hidden />
              Add window<span className="sr-only"> on {label}</span>
            </Button>
          ) : null}
        </>
      ) : null}
    </li>
  )
}

function WindowRow({
  day,
  index,
  window,
  errors,
  itemChannels,
  owner,
  onChange,
  onRemove,
  onCopy,
}: {
  day: Weekday
  index: number
  window: WindowDraft
  errors: FieldErrors
  itemChannels: ChannelSettings
  owner: ScheduleOwner
  onChange: (window: WindowDraft) => void
  onRemove: () => void
  onCopy: (targets: Weekday[]) => void
}) {
  const label = weekdayLabels[day]
  const name = `${label} window ${index + 1}`
  const startPath = schedulePaths.start(day, window.key)
  const endPath = schedulePaths.end(day, window.key)
  const windowPath = schedulePaths.window(day, window.key)
  const overnight = isOvernight(window)
  const described = (path: string) =>
    [errors[path] ? `${fieldId(path)}-error` : null, errors[windowPath] ? `${fieldId(windowPath)}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined
  const valid = validateWindow(window) === null

  return (
    <li id={fieldId(windowPath)} tabIndex={-1} className="flex flex-col gap-2 outline-none">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
          <div className="grid min-w-0 gap-1">
            <Label htmlFor={fieldId(startPath)} className="text-xs">
              From<span className="sr-only">, {name}</span>
            </Label>
            <Input
              id={fieldId(startPath)}
              type="time"
              step={900}
              value={window.start}
              onChange={(event) => onChange({ ...window, start: event.target.value })}
              aria-invalid={errors[startPath] || errors[windowPath] ? true : undefined}
              aria-describedby={described(startPath)}
              className="h-9 w-full px-2 tabular-nums sm:w-32"
            />
          </div>
          <div className="grid min-w-0 gap-1">
            <Label htmlFor={fieldId(endPath)} className="text-xs">
              To<span className="sr-only">, {name}</span>
            </Label>
            <Input
              id={fieldId(endPath)}
              type="time"
              step={900}
              value={window.end}
              onChange={(event) => onChange({ ...window, end: event.target.value })}
              aria-invalid={errors[endPath] || errors[windowPath] ? true : undefined}
              aria-describedby={described(endPath)}
              className="h-9 w-full px-2 tabular-nums sm:w-32"
            />
          </div>
        </div>
        {valid && window.channels.length > 0 ? (
          <CopyToDays
            day={day}
            triggerLabel="Copy"
            triggerSrSuffix={` ${window.start}–${window.end} on ${label} to other days`}
            title={`Add ${window.start}–${window.end} (${listOrderTypes(window.channels)}) to`}
            actionLabel="Add window"
            hint="Adds this window, with its order types, to the days you choose."
            onCopy={onCopy}
          />
        ) : null}
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${name}`} onClick={onRemove}>
          <Trash2 aria-hidden />
        </Button>
      </div>
      {overnight && valid ? (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Moon aria-hidden className="size-3.5" />
          Runs past midnight into {weekdayLabels[WEEKDAYS[(WEEKDAYS.indexOf(day) + 1) % 7]]}, ending at {window.end}.
        </p>
      ) : null}
      <FieldError path={startPath} errors={errors} />
      <FieldError path={endPath} errors={errors} />
      <FieldError path={windowPath} errors={errors} />
      <OrderTypePicker
        path={schedulePaths.channels(day, window.key)}
        name={name}
        value={window.channels}
        itemChannels={itemChannels}
        owner={owner}
        errors={errors}
        onChange={(channels) => onChange({ ...window, channels })}
      />
    </li>
  )
}

/**
 * Order types for one window, All day entry or meal period (Q12, H1). Types
 * the owner itself isn't offered for can't be added; if one is already
 * ticked, validation says so rather than dropping it silently.
 */
export function OrderTypePicker({
  path,
  name,
  value,
  itemChannels,
  owner = "item",
  errors,
  onChange,
}: {
  path: string
  name: string
  value: OrderType[]
  itemChannels: ChannelSettings
  owner?: ScheduleOwner
  errors: FieldErrors
  onChange: (channels: OrderType[]) => void
}) {
  const id = fieldId(path)
  const off = ORDER_TYPES.filter((type) => !itemChannels[type])
  return (
    <fieldset
      id={id}
      tabIndex={-1}
      aria-describedby={errors[path] ? `${id}-error` : undefined}
      className="flex flex-col gap-1.5 outline-none"
    >
      <legend className="sr-only">Order types for {name}</legend>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span aria-hidden className="w-full text-xs text-muted-foreground sm:w-auto">
          Order types
        </span>
        {ORDER_TYPES.map((type) => {
          const checked = value.includes(type)
          return (
            <div key={type} className="flex items-center gap-2">
              <Checkbox
                id={`${id}-${type}`}
                checked={checked}
                disabled={!itemChannels[type] && !checked}
                onCheckedChange={(next) =>
                  onChange(ORDER_TYPES.filter((candidate) => (candidate === type ? next === true : value.includes(candidate))))
                }
              />
              <Label htmlFor={`${id}-${type}`} className="font-normal">
                {orderTypeLabels[type]}
              </Label>
            </div>
          )
        })}
      </div>
      {off.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {listOrderTypes(off)} {off.length === 1 ? "is" : "are"} off for this {owner}.
        </p>
      ) : null}
      <FieldError path={path} errors={errors} />
    </fieldset>
  )
}

/** Picks other days to copy to. */
function CopyToDays({
  day,
  triggerLabel,
  triggerSrSuffix,
  title,
  actionLabel,
  hint,
  onCopy,
}: {
  day: Weekday
  triggerLabel: string
  /** Extra screen-reader text after the visible label. */
  triggerSrSuffix?: string
  title: string
  actionLabel: string
  hint: string
  onCopy: (targets: Weekday[]) => void
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [targets, setTargets] = useState<Weekday[]>([])
  const others = WEEKDAYS.filter((candidate) => candidate !== day)

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setTargets([])
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Copy aria-hidden />
          {triggerLabel}
          {triggerSrSuffix ? <span className="sr-only">{triggerSrSuffix}</span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">{title}</legend>
          {others.map((candidate) => (
            <div key={candidate} className="flex items-center gap-2.5">
              <Checkbox
                id={`${id}-${candidate}`}
                checked={targets.includes(candidate)}
                onCheckedChange={(checked) =>
                  setTargets(checked === true ? [...targets, candidate] : targets.filter((target) => target !== candidate))
                }
              />
              <Label htmlFor={`${id}-${candidate}`} className="font-normal">
                {weekdayLabels[candidate]}
              </Label>
            </div>
          ))}
        </fieldset>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTargets(targets.length === others.length ? [] : others)}
          >
            {targets.length === others.length ? "Clear" : "All other days"}
          </Button>
          <Button
            type="button"
            size="sm"
            aria-disabled={targets.length === 0 || undefined}
            onClick={() => {
              if (targets.length === 0) return
              onCopy(targets)
              setOpen(false)
            }}
          >
            {actionLabel}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      </PopoverContent>
    </Popover>
  )
}
