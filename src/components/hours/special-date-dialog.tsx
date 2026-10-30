"use client"

import { useId, useState } from "react"
import { Clock3, Info, Loader2 } from "lucide-react"

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ORDER_TYPES, orderTypeLabels } from "@/lib/domain/order-types"
import {
  NOTE_MAX,
  overnightIntoDate,
  specialDateDraftFrom,
  specialDatePaths,
  validateSpecialDateDraft,
  type SpecialDateDraft,
} from "@/lib/hours/special-dates"
import type { SpecialDate, WeeklyHours } from "@/lib/hours/types"
import { formatTimes, hoursFieldId } from "@/lib/hours/weekly-hours"
import { addDays, formatCalendarDate, isCalendarDate, localDayHours, weekdayOf } from "@/lib/time/calendar"
import { weekdayLabels } from "@/lib/time/weekly"

import { FieldError, TimeWindowsFields, type FieldErrors } from "./time-windows-fields"
import { useHoursCommand } from "./use-hours-command"

const newKey = () => `new-${crypto.randomUUID().slice(0, 8)}`

/**
 * Add or edit a special date (H3): closed or special hours for the chosen
 * order types on one date. Checked here and again on the server, which also
 * decides what "today" is.
 */
export function SpecialDateDialog({
  specialDate,
  specialDates,
  weekly,
  today,
  locale,
  trigger,
}: {
  specialDate?: SpecialDate
  /** All special dates, for the duplicate check and the overnight note. */
  specialDates: SpecialDate[]
  weekly: WeeklyHours
  /** The restaurant-local date, from the server. */
  today: string
  locale: string
  trigger: React.ReactNode
}) {
  const id = useId()
  const command = useHoursCommand()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<SpecialDateDraft>(() => specialDateDraftFrom(specialDate ?? null, today))
  const [localErrors, setLocalErrors] = useState<FieldErrors>({})
  const others = specialDates.filter((candidate) => candidate.id !== specialDate?.id)
  const errors: FieldErrors = { ...command.fieldErrors, ...localErrors }
  const validate = (next: SpecialDateDraft) => validateSpecialDateDraft(next, { today, others })

  function update(patch: Partial<SpecialDateDraft>) {
    const next = { ...draft, ...patch }
    setDraft(next)
    if (Object.keys(localErrors).length) setLocalErrors(validate(next))
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validate(draft)
    setLocalErrors(nextErrors)
    const first = Object.keys(nextErrors)[0]
    if (first) {
      document.getElementById(hoursFieldId(first))?.focus()
      return
    }
    const when = formatCalendarDate(draft.date, locale, "short")
    command.run(
      specialDate
        ? { type: "update_special_date", id: specialDate.id, version: specialDate.version, draft }
        : { type: "add_special_date", draft },
      specialDate ? `Special date on ${when} updated` : `Special date added for ${when}`,
      () => setOpen(false)
    )
  }

  const crossing = overnightIntoDate(draft.date, draft.orderTypes, weekly, others)
  const dayHours = isCalendarDate(draft.date) ? localDayHours(draft.date, weekly.timeZone) : 24
  const generalFailure = command.result && !command.result.ok && !command.result.fieldErrors ? command.result : null
  const title = specialDate ? `Edit special date: ${formatCalendarDate(specialDate.date, locale)}` : "Add special date"

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (command.pending) return
        if (next) {
          setDraft(specialDateDraftFrom(specialDate ?? null, today))
          setLocalErrors({})
          command.begin()
        }
        setOpen(next)
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Replaces the weekly hours on this date for the order types you choose. Other order types keep their weekly hours.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor={hoursFieldId(specialDatePaths.date)}>Date</Label>
            <Input
              id={hoursFieldId(specialDatePaths.date)}
              type="date"
              min={today}
              value={draft.date}
              onChange={(event) => update({ date: event.target.value })}
              aria-invalid={errors[specialDatePaths.date] ? true : undefined}
              aria-describedby={[`${id}-date-help`, errors[specialDatePaths.date] ? `${hoursFieldId(specialDatePaths.date)}-error` : null].filter(Boolean).join(" ")}
              className="h-10 w-full sm:w-56"
            />
            <p id={`${id}-date-help`} className="text-xs text-muted-foreground">
              {isCalendarDate(draft.date) ? `${weekdayLabels[weekdayOf(draft.date)]}, in ${weekly.timeZone}.` : `In ${weekly.timeZone}.`}
            </p>
            <FieldError path={specialDatePaths.date} errors={errors} />
            {dayHours !== 24 ? (
              <p className="flex items-start gap-1.5 text-xs text-warning-foreground">
                <Clock3 aria-hidden className="mt-px size-3.5 shrink-0" />
                Clocks change on this date in {weekly.timeZone}: the day is {dayHours} hours long. Foodi applies its
                clock-change rules to these hours.
              </p>
            ) : null}
          </div>

          <fieldset
            id={hoursFieldId(specialDatePaths.orderTypes)}
            tabIndex={-1}
            className="grid gap-2 outline-none"
            aria-describedby={errors[specialDatePaths.orderTypes] ? `${hoursFieldId(specialDatePaths.orderTypes)}-error` : undefined}
          >
            <legend className="mb-1 text-sm font-medium">Order types affected</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {ORDER_TYPES.map((type) => (
                <div key={type} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`${id}-type-${type}`}
                    checked={draft.orderTypes.includes(type)}
                    onCheckedChange={(checked) =>
                      update({
                        orderTypes: ORDER_TYPES.filter((candidate) =>
                          candidate === type ? checked === true : draft.orderTypes.includes(candidate)
                        ),
                      })
                    }
                  />
                  <Label htmlFor={`${id}-type-${type}`} className="font-normal">
                    {orderTypeLabels[type]}
                  </Label>
                </div>
              ))}
            </div>
            <FieldError path={specialDatePaths.orderTypes} errors={errors} />
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">On this date</legend>
            <RadioGroup
              value={draft.kind}
              onValueChange={(kind) =>
                update(
                  kind === "special_hours"
                    ? { kind, windows: draft.windows.length || draft.allDay ? draft.windows : [{ key: newKey(), start: "", end: "" }] }
                    : { kind: "closed" }
                )
              }
              className="gap-2"
            >
              <div className="flex items-center gap-2.5">
                <RadioGroupItem value="closed" id={`${id}-closed`} />
                <Label htmlFor={`${id}-closed`} className="font-normal">
                  Closed
                </Label>
              </div>
              <div className="flex items-center gap-2.5">
                <RadioGroupItem value="special_hours" id={`${id}-special`} />
                <Label htmlFor={`${id}-special`} className="font-normal">
                  Special hours
                </Label>
              </div>
            </RadioGroup>
          </fieldset>

          {draft.kind === "special_hours" ? (
            <div id={hoursFieldId(specialDatePaths.hours)} tabIndex={-1} className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-4 outline-none">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id={`${id}-all-day`}
                  checked={draft.allDay}
                  onCheckedChange={(checked) =>
                    update(
                      checked === true
                        ? { allDay: true, windows: draft.windows.filter((window) => window.start || window.end) }
                        : { allDay: false, windows: draft.windows.length ? draft.windows : [{ key: newKey(), start: "", end: "" }] }
                    )
                  }
                />
                <Label htmlFor={`${id}-all-day`} className="font-normal">
                  All day (midnight to midnight)
                </Label>
              </div>
              <FieldError path={specialDatePaths.hours} errors={errors} />
              {!draft.allDay || draft.windows.length ? (
                <TimeWindowsFields
                  windows={draft.windows}
                  name="Special hours"
                  nextDayLabel={isCalendarDate(draft.date) ? weekdayLabels[weekdayOf(addDays(draft.date, 1))] : "the next day"}
                  paths={specialDatePaths}
                  errors={errors}
                  newKey={newKey}
                  onChange={(windows) => update({ windows })}
                />
              ) : null}
            </div>
          ) : null}

          {crossing.length ? (
            // H4 is unconfirmed: state the overlap, never how it's resolved.
            <div role="note" className="flex items-start gap-2 rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
              <Info aria-hidden className="mt-px size-3.5 shrink-0" />
              <div className="flex flex-col gap-1">
                {crossing.map(({ type, window }) => (
                  <p key={`${type}-${window.start}-${window.end}`}>
                    {orderTypeLabels[type]}: the {weekdayLabels[weekdayOf(addDays(draft.date, -1))]} window {formatTimes(window)} crosses into
                    this date.
                  </p>
                ))}
                <p>How an overnight window combines with a special date is being confirmed with Foodi.</p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor={hoursFieldId(specialDatePaths.note)} className="gap-2">
              Note
              <span className="text-xs font-normal text-muted-foreground">Optional, e.g. Diwali</span>
            </Label>
            <Input
              id={hoursFieldId(specialDatePaths.note)}
              value={draft.note}
              maxLength={NOTE_MAX + 20}
              onChange={(event) => update({ note: event.target.value })}
              aria-invalid={errors[specialDatePaths.note] ? true : undefined}
              aria-describedby={errors[specialDatePaths.note] ? `${hoursFieldId(specialDatePaths.note)}-error` : undefined}
              className="h-10"
            />
            <FieldError path={specialDatePaths.note} errors={errors} />
          </div>

          {generalFailure ? <ActionResultMessage result={generalFailure} successText="" /> : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" aria-disabled={command.pending || undefined}>
              {command.pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {specialDate ? "Save changes" : "Add special date"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
