"use client"

import { useId, useState } from "react"
import { CircleCheck, Copy, Loader2 } from "lucide-react"

import { ActionResultMessage } from "@/components/shared/action-result-message"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/features/auth/auth-context"
import { canPauseOrders } from "@/features/staff/access"
import { useHoursCommand } from "@/hooks/use-hours-command"
import { ORDER_TYPES, orderTypeLabels, type OrderType } from "@/lib/domain/order-types"
import type { PauseState, WeeklyHours } from "@/lib/hours/types"
import {
  copyDayTo,
  emptyHoursDraft,
  hoursDraftFrom,
  hoursFieldId,
  hoursPaths,
  validateTypes,
  type DayDraft,
  type HoursDraft,
} from "@/lib/hours/weekly-hours"
import { cn } from "@/lib/utils"
import { nextWeekday, WEEKDAYS, weekdayLabels, type Weekday } from "@/lib/time/weekly"

import { PauseControl } from "./pause-control"
import { FieldError, TimeWindowsFields, type FieldErrors } from "./time-windows-fields"

const newKey = () => `new-${crypto.randomUUID().slice(0, 8)}`
const defaultWindow = () => ({ key: newKey(), start: "11:00", end: "23:00" })

/** Error paths of one tab, in the order they appear on the page. */
const orderedPaths = (draft: HoursDraft, type: OrderType) =>
  WEEKDAYS.flatMap((day) => [
    hoursPaths.day(type, day),
    ...draft[type][day].windows.flatMap((window) => [
      hoursPaths.start(type, day, window.key),
      hoursPaths.end(type, day, window.key),
      hoursPaths.window(type, day, window.key),
    ]),
  ])

/**
 * Hours and pause, one tab per order type the restaurant has switched on. Each tab has its own weekly
 * hours, its own Save and its own pause. Validated here and again on the server, which stays the only
 * place that works out availability.
 */
export function WeeklyHoursEditor({
  hours,
  pauseByType,
  locale,
}: {
  hours: WeeklyHours
  pauseByType: Record<OrderType, PauseState>
  locale: string
}) {
  const { user } = useAuth()
  const canPause = canPauseOrders(user)
  const visibleTypes = ORDER_TYPES.filter((type) => hours.enabledTypes?.[type] ?? true)
  const command = useHoursCommand()
  const [draft, setDraft] = useState<HoursDraft>(() => hoursDraftFrom(hours))
  const [active, setActive] = useState<OrderType>(visibleTypes[0] ?? "delivery")
  const [localErrors, setLocalErrors] = useState<FieldErrors>({})
  const [saved, setSaved] = useState<OrderType | null>(null)
  const errors: FieldErrors = { ...command.fieldErrors, ...localErrors }

  if (visibleTypes.length === 0) {
    return <p className="text-sm text-muted-foreground">No order types are switched on for this restaurant yet.</p>
  }

  function update(type: OrderType, next: HoursDraft) {
    setDraft(next)
    setSaved(null)
    if (Object.keys(localErrors).length) setLocalErrors(validateTypes(next, [type]))
  }

  function save(type: OrderType) {
    const nextErrors = validateTypes(draft, [type])
    setLocalErrors(nextErrors)
    const first = orderedPaths(draft, type).find((path) => nextErrors[path])
    if (first) {
      requestAnimationFrame(() => document.getElementById(hoursFieldId(first))?.focus())
      return
    }
    command.begin()
    // Only this tab's hours are sent. A failed attempt can be retried with the same key.
    command.run({ type: "save_hours", scope: type, version: hours.version, draft: { ...emptyHoursDraft(), [type]: draft[type] } }, "Opening hours updated", () =>
      setSaved(type)
    )
  }

  const failure = command.result && !command.result.ok && !command.result.fieldErrors ? command.result : null

  return (
    <Tabs value={active} onValueChange={(value) => setActive(value as OrderType)} className="flex flex-col gap-4">
      <TabsList aria-label="Order type" className="h-auto flex-wrap">
        {visibleTypes.map((type) => (
          <TabsTrigger key={type} value={type}>
            {orderTypeLabels[type]}
          </TabsTrigger>
        ))}
      </TabsList>

      {visibleTypes.map((type) => (
        <TabsContent key={type} value={type} className="flex flex-col gap-5">
          <PauseControl type={type} pause={pauseByType[type]} locale={locale} canPause={canPause} />

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-base font-semibold">Weekly hours</h3>
              <p className="text-xs text-muted-foreground">
                Times are in <span className="font-medium text-foreground">{hours.timeZone}</span>.
              </p>
            </div>
            <ul className="flex flex-col gap-2" aria-label={`${orderTypeLabels[type]} days`}>
              {WEEKDAYS.map((day) => (
                <DayRow
                  key={day}
                  type={type}
                  day={day}
                  value={draft[type][day]}
                  errors={errors}
                  onChange={(next) => update(type, { ...draft, [type]: { ...draft[type], [day]: next } })}
                  onCopy={(targets) => update(type, copyDayTo(draft, type, day, targets, newKey))}
                />
              ))}
            </ul>
          </div>

          {failure && active === type ? <ActionResultMessage result={failure} successText="" /> : null}

          <div className="flex items-center justify-end gap-3 border-t border-border-soft pt-4">
            {saved === type ? (
              <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-success-foreground">
                <CircleCheck aria-hidden className="size-4" />
                Saved
              </p>
            ) : null}
            <Button type="button" className="sm:min-w-36" aria-disabled={command.pending || undefined} onClick={() => !command.pending && save(type)}>
              {command.pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Save {orderTypeLabels[type].toLowerCase()} hours
            </Button>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  )
}

/** One day: Closed and All day switches, then either the opening times or a plain label. */
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
  const closedId = hoursFieldId(dayPath)
  const allDayId = `${closedId}-all-day`

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-4",
        value.enabled ? "border-success-line bg-success-soft/40" : "border-danger-line bg-danger-soft/40"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="w-24 text-sm font-semibold">{label}</span>
          <div className="flex items-center gap-2">
            <Switch
              id={closedId}
              className="data-[state=checked]:bg-success-foreground data-[state=unchecked]:bg-danger-foreground"
              checked={value.enabled}
              aria-describedby={errors[dayPath] ? `${closedId}-error` : undefined}
              onCheckedChange={(open) =>
                onChange(
                  open
                    ? { ...value, enabled: true, windows: value.windows.length || value.allDay ? value.windows : [defaultWindow()] }
                    : { ...value, enabled: false }
                )
              }
            />
            <Label
              htmlFor={closedId}
              className={cn("cursor-pointer text-xs font-semibold", value.enabled ? "text-success-foreground" : "text-danger-foreground")}
            >
              {value.enabled ? "Open" : "Closed"}<span className="sr-only"> on {name}</span>
            </Label>
          </div>
          {value.enabled ? (
            <div className="flex items-center gap-2">
              <Switch
                id={allDayId}
                checked={value.allDay}
                onCheckedChange={(allDay) =>
                  onChange(
                    allDay
                      ? { ...value, allDay: true, windows: [] }
                      : { ...value, allDay: false, windows: value.windows.length ? value.windows : [defaultWindow()] }
                  )
                }
              />
              <Label htmlFor={allDayId} className="cursor-pointer text-xs font-medium">
                All day<span className="sr-only"> for {name}</span>
              </Label>
            </div>
          ) : null}
        </div>
        {value.enabled ? <CopyDay day={day} name={name} onCopy={onCopy} /> : null}
      </div>
      <FieldError path={dayPath} errors={errors} />
      {!value.enabled ? <p className="text-sm font-semibold text-danger-foreground">Closed</p> : null}
      {value.enabled && value.allDay ? <p className="text-sm font-semibold text-success-foreground">All day</p> : null}
      {value.enabled && !value.allDay ? (
        <TimeWindowsFields
          windows={value.windows.length > 0 ? value.windows : [defaultWindow()]}
          name={name}
          nextDayLabel={weekdayLabels[nextWeekday(day)]}
          paths={{
            window: (key) => hoursPaths.window(type, day, key),
            start: (key) => hoursPaths.start(type, day, key),
            end: (key) => hoursPaths.end(type, day, key),
          }}
          errors={errors}
          newKey={newKey}
          addLabel="Add hours"
          keepOne
          onChange={(windows) => onChange({ ...value, windows })}
        />
      ) : null}
    </li>
  )
}

/** "Copy {day} to…": replaces the chosen days' hours for this tab; "All other days" copies to the whole week. */
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
          Copy to other days<span className="sr-only"> ({name})</span>
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
      </PopoverContent>
    </Popover>
  )
}
