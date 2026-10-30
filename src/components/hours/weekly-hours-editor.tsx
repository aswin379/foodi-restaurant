"use client"

import { useId, useRef, useState } from "react"
import { AlertTriangle, CalendarClock, Copy, Loader2 } from "lucide-react"

import { ActionResultMessage } from "@/components/shared/action-result-message"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ORDER_TYPES, orderTypeLabels, type OrderType } from "@/lib/domain/order-types"
import type { WeeklyHours } from "@/lib/hours/types"
import {
  copyDayTo,
  hoursDraftFrom,
  hoursFieldId,
  hoursFromDraft,
  hoursLines,
  hoursPaths,
  hoursWarnings,
  sameAs,
  validateHoursDraft,
  type DayDraft,
  type HoursDraft,
} from "@/lib/hours/weekly-hours"
import { nextWeekday, WEEKDAYS, weekdayLabels, type Weekday } from "@/lib/time/weekly"

import { FieldError, TimeWindowsFields, type FieldErrors } from "./time-windows-fields"
import { useHoursCommand } from "./use-hours-command"

const newKey = () => `new-${crypto.randomUUID().slice(0, 8)}`
const isBlank = (window: { start: string; end: string }) => window.start === "" && window.end === ""

/** Error paths in the order they appear, for the summary. */
function summaryOrder(draft: HoursDraft) {
  return ORDER_TYPES.flatMap((type) =>
    WEEKDAYS.flatMap((day) => [
      hoursPaths.day(type, day),
      ...draft[type][day].windows.flatMap((window) => [
        hoursPaths.start(type, day, window.key),
        hoursPaths.end(type, day, window.key),
        hoursPaths.window(type, day, window.key),
      ]),
    ])
  )
}

const typeOfPath = (path: string) => ORDER_TYPES.find((type) => path.startsWith(`hours.${type}.`)) ?? "delivery"

/**
 * Weekly opening hours per order type (PRD §3.3, H2, H8). Validated here and
 * again on the server; in preview mode the save is simulated and labelled.
 */
export function WeeklyHoursEditor({ hours }: { hours: WeeklyHours }) {
  const command = useHoursCommand()
  const [draft, setDraft] = useState<HoursDraft>(() => hoursDraftFrom(hours))
  const [active, setActive] = useState<OrderType>("delivery")
  const [localErrors, setLocalErrors] = useState<FieldErrors>({})
  const [confirmSameAs, setConfirmSameAs] = useState<OrderType | null>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const errors: FieldErrors = { ...command.fieldErrors, ...localErrors }

  function update(next: HoursDraft) {
    setDraft(next)
    if (Object.keys(localErrors).length) setLocalErrors(validateHoursDraft(next))
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateHoursDraft(draft)
    setLocalErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => summaryRef.current?.focus())
      return
    }
    // A failed attempt keeps its key, so retrying can't apply the change twice.
    command.run({ type: "save_hours", version: hours.version, draft }, "Opening hours updated")
  }

  function focusError(path: string) {
    setActive(typeOfPath(path))
    requestAnimationFrame(() => document.getElementById(hoursFieldId(path))?.focus())
  }

  const order = summaryOrder(draft)
  const errorPaths = order.filter((path) => errors[path])
  const errorCount = (type: OrderType) => errorPaths.filter((path) => typeOfPath(path) === type).length
  const valid = Object.keys(validateHoursDraft(draft)).length === 0
  const saves = valid ? hoursFromDraft(draft) : null
  const warnings = hoursWarnings(draft)
  const generalFailure = command.result && !command.result.ok && !command.result.fieldErrors ? command.result : null

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {errorPaths.length ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby="hours-error-summary-title"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-destructive/30"
        >
          <p id="hours-error-summary-title" className="font-medium text-destructive">
            Check {errorPaths.length === 1 ? "1 thing" : `${errorPaths.length} things`} before saving
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
            {errorPaths.map((path) => (
              <li key={path}>
                <a
                  href={`#${hoursFieldId(path)}`}
                  className="underline underline-offset-4"
                  onClick={(event) => {
                    event.preventDefault()
                    focusError(path)
                  }}
                >
                  {orderTypeLabels[typeOfPath(path)]}: {errors[path]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <CalendarClock aria-hidden className="mt-px size-3.5 shrink-0" />
        <span>
          Times are in the restaurant&apos;s time zone, <span className="font-medium text-foreground">{hours.timeZone}</span>.
          All day means midnight to midnight there. A day that&apos;s switched off is closed for that order type.
        </span>
      </p>

      <Tabs value={active} onValueChange={(value) => setActive(value as OrderType)}>
        <TabsList aria-label="Order type">
          {ORDER_TYPES.map((type) => (
            <TabsTrigger key={type} value={type}>
              {orderTypeLabels[type]}
              {errorCount(type) ? (
                <span className="ml-1 rounded-full bg-destructive px-1.5 text-[10px] text-white">
                  {errorCount(type)}
                  <span className="sr-only"> {errorCount(type) === 1 ? "error" : "errors"}</span>
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
        {ORDER_TYPES.map((type) => (
          <TabsContent key={type} value={type} className="mt-4 flex flex-col gap-3">
            {type !== "delivery" ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmSameAs(type)}>
                  <Copy aria-hidden />
                  Same as delivery<span className="sr-only"> for {orderTypeLabels[type]}</span>
                </Button>
              </div>
            ) : null}
            <ul className="flex flex-col gap-2" aria-label={`${orderTypeLabels[type]} days`}>
              {WEEKDAYS.map((day) => (
                <DayRow
                  key={day}
                  type={type}
                  day={day}
                  value={draft[type][day]}
                  errors={errors}
                  onChange={(next) => update({ ...draft, [type]: { ...draft[type], [day]: next } })}
                  onCopy={(targets) => update(copyDayTo(draft, type, day, targets, newKey))}
                />
              ))}
            </ul>
          </TabsContent>
        ))}
      </Tabs>

      {warnings.length ? (
        <ul className="flex flex-col gap-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          {warnings.map((warning) => (
            <li key={warning} className="flex items-center gap-1.5">
              <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}

      {saves ? (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs" aria-label="Saves as">
          <p className="font-medium">Saves as</p>
          <dl className="mt-1 grid gap-1 text-muted-foreground sm:grid-cols-[auto_1fr] sm:gap-x-3">
            {ORDER_TYPES.map((type) => (
              <div key={type} className="contents">
                <dt className="font-medium text-foreground">{orderTypeLabels[type]}</dt>
                <dd>{saves[type].length ? hoursLines(saves[type]).join(" · ") : "Closed every day"}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {generalFailure ? <ActionResultMessage result={generalFailure} successText="" /> : null}

      <div className="flex justify-end border-t pt-4">
        <Button type="submit" className="sm:min-w-36" aria-disabled={command.pending || undefined}>
          {command.pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
          Save hours
        </Button>
      </div>

      <ConfirmDialog
        open={confirmSameAs !== null}
        onOpenChange={(open) => !open && setConfirmSameAs(null)}
        title={`Use delivery hours for ${confirmSameAs ? orderTypeLabels[confirmSameAs].toLowerCase() : ""}?`}
        description={`${confirmSameAs ? orderTypeLabels[confirmSameAs] : ""}'s current hours are replaced with a copy of the delivery hours. Nothing is saved until you choose Save hours.`}
        confirmLabel="Use delivery hours"
        onConfirm={() => {
          if (confirmSameAs) update(sameAs(draft, confirmSameAs, "delivery", newKey))
          setConfirmSameAs(null)
        }}
      />
    </form>
  )
}

function DayRow({
  type,
  day,
  value,
  errors,
  onChange,
  onCopy,
}: {
  type: OrderType
  day: Weekday
  value: DayDraft
  errors: FieldErrors
  onChange: (next: DayDraft) => void
  onCopy: (targets: Weekday[]) => void
}) {
  const dayPath = hoursPaths.day(type, day)
  const label = weekdayLabels[day]
  const name = `${orderTypeLabels[type]} ${label}`
  const allDayId = `${hoursFieldId(dayPath)}-all-day`

  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
                        // A newly opened day starts with one empty window to fill in.
                        windows: value.windows.length || value.allDay ? value.windows : [{ key: newKey(), start: "", end: "" }],
                      }
                    : { ...value, enabled: false }
                )
              }
            />
            <Label htmlFor={hoursFieldId(dayPath)}>
              {label}
              <span className="sr-only"> ({orderTypeLabels[type]})</span>
            </Label>
          </div>
          {value.enabled ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id={allDayId}
                checked={value.allDay}
                onCheckedChange={(checked) =>
                  onChange(
                    checked === true
                      ? // Untouched empty rows go; windows with times stay and are flagged.
                        { ...value, allDay: true, windows: value.windows.filter((window) => !isBlank(window)) }
                      : { ...value, allDay: false, windows: value.windows.length ? value.windows : [{ key: newKey(), start: "", end: "" }] }
                  )
                }
              />
              <Label htmlFor={allDayId} className="font-normal">
                All day<span className="sr-only"> for {name}</span>
              </Label>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Closed</span>
          )}
        </div>
        {value.enabled ? <CopyDay day={day} name={name} onCopy={onCopy} /> : null}
      </div>
      <FieldError path={dayPath} errors={errors} />
      {value.enabled && value.allDay ? (
        <p className="text-xs text-muted-foreground">Open all day: midnight to midnight.</p>
      ) : null}
      {value.enabled && (!value.allDay || value.windows.length > 0) ? (
        <TimeWindowsFields
          windows={value.windows}
          name={name}
          nextDayLabel={weekdayLabels[nextWeekday(day)]}
          paths={{
            window: (key) => hoursPaths.window(type, day, key),
            start: (key) => hoursPaths.start(type, day, key),
            end: (key) => hoursPaths.end(type, day, key),
          }}
          errors={errors}
          newKey={newKey}
          onChange={(windows) => onChange({ ...value, windows })}
        />
      ) : null}
    </li>
  )
}

/** "Copy {day} to…": replaces the chosen days' hours for this order type; "All other days" copies to the whole week. */
function CopyDay({ day, name, onCopy }: { day: Weekday; name: string; onCopy: (targets: Weekday[]) => void }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [targets, setTargets] = useState<Weekday[]>([])
  const others = WEEKDAYS.filter((candidate) => candidate !== day)
  const label = weekdayLabels[day]

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
          Copy {label} to…<span className="sr-only"> ({name})</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Copy {label}&apos;s hours to</legend>
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
          <Button type="button" variant="ghost" size="sm" onClick={() => setTargets(targets.length === others.length ? [] : others)}>
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
            Copy hours
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Replaces the hours on the days you choose. Nothing is saved until you choose Save hours.</p>
      </PopoverContent>
    </Popover>
  )
}
