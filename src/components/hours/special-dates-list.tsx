"use client"

import { useState } from "react"
import { CalendarPlus, Lock, Pencil, Trash2 } from "lucide-react"

import { ActionResultMessage } from "@/components/shared/action-result-message"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { orderTypeLabels } from "@/lib/domain/order-types"
import { actorLabel } from "@/lib/hours/labels"
import { specialDateSummary } from "@/lib/hours/special-dates"
import type { SpecialDate, WeeklyHours } from "@/lib/hours/types"
import { formatCalendarDate } from "@/lib/time/calendar"

import { SpecialDateDialog } from "./special-date-dialog"
import { useHoursCommand } from "./use-hours-command"

/** Upcoming special dates (editable) and recent past ones (read-only). */
export function SpecialDatesList({
  specialDates,
  weekly,
  today,
  locale,
}: {
  specialDates: SpecialDate[]
  weekly: WeeklyHours
  today: string
  locale: string
}) {
  const upcoming = specialDates.filter((specialDate) => specialDate.editable)
  const past = specialDates.filter((specialDate) => !specialDate.editable)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Dates in {weekly.timeZone}. One special date per date and order type.
        </p>
        <SpecialDateDialog
          specialDates={specialDates}
          weekly={weekly}
          today={today}
          locale={locale}
          trigger={
            <Button type="button">
              <CalendarPlus aria-hidden />
              Add special date
            </Button>
          }
        />
      </div>

      <section aria-labelledby="upcoming-dates-title" className="flex flex-col gap-3">
        <h2 id="upcoming-dates-title" className="text-lg font-semibold">
          Upcoming
        </h2>
        {upcoming.length ? (
          <ul className="flex flex-col gap-2" aria-label="Upcoming special dates">
            {upcoming.map((specialDate) => (
              <SpecialDateRow
                key={specialDate.id}
                specialDate={specialDate}
                specialDates={specialDates}
                weekly={weekly}
                today={today}
                locale={locale}
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-3xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            No special dates coming up. Add holidays and special hours here.
          </p>
        )}
      </section>

      {past.length ? (
        <section aria-labelledby="past-dates-title" className="flex flex-col gap-3">
          <h2 id="past-dates-title" className="text-lg font-semibold">
            Past
          </h2>
          <p className="text-xs text-muted-foreground">Past special dates are kept for reference and can&apos;t be changed.</p>
          <ul className="flex flex-col gap-2" aria-label="Past special dates">
            {past.map((specialDate) => (
              <SpecialDateRow
                key={specialDate.id}
                specialDate={specialDate}
                specialDates={specialDates}
                weekly={weekly}
                today={today}
                locale={locale}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function SpecialDateRow({
  specialDate,
  specialDates,
  weekly,
  today,
  locale,
}: {
  specialDate: SpecialDate
  specialDates: SpecialDate[]
  weekly: WeeklyHours
  today: string
  locale: string
}) {
  const command = useHoursCommand()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const when = formatCalendarDate(specialDate.date, locale)
  const failure = command.result && !command.result.ok ? command.result : null

  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-[0_8px_30px_rgb(31_26_23/6%)] sm:flex-row sm:items-start sm:justify-between sm:px-5">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-base font-semibold">
          {when}
          {specialDate.note ? <span className="font-normal text-muted-foreground"> · {specialDate.note}</span> : null}
        </p>
        <p className="text-sm">{specialDateSummary(specialDate)}</p>
        <ul className="flex flex-wrap gap-1.5" aria-label={`Order types affected on ${when}`}>
          {specialDate.orderTypes.map((type) => (
            <li key={type} className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary-text">
              {orderTypeLabels[type]}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Last changed by {actorLabel(specialDate.updatedBy)}</p>
      </div>
      {specialDate.editable ? (
        <div className="flex shrink-0 gap-1">
          <SpecialDateDialog
            specialDate={specialDate}
            specialDates={specialDates}
            weekly={weekly}
            today={today}
            locale={locale}
            trigger={
              <Button type="button" variant="ghost" size="sm">
                <Pencil aria-hidden />
                Edit<span className="sr-only"> special date {when}</span>
              </Button>
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              command.begin()
              setConfirmDelete(true)
            }}
          >
            <Trash2 aria-hidden />
            Remove<span className="sr-only"> special date {when}</span>
          </Button>
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title={`Remove the special date on ${when}?`}
            description="The weekly hours apply on this date again for the affected order types."
            confirmLabel="Remove special date"
            destructive
            pending={command.pending}
            onConfirm={() =>
              command.run(
                { type: "delete_special_date", id: specialDate.id, version: specialDate.version },
                `Special date on ${formatCalendarDate(specialDate.date, locale, "short")} removed`,
                () => setConfirmDelete(false)
              )
            }
          >
            {failure ? <ActionResultMessage result={failure} successText="" /> : null}
          </ConfirmDialog>
        </div>
      ) : (
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Lock aria-hidden className="size-3.5" />
          Read-only
        </span>
      )}
    </li>
  )
}
