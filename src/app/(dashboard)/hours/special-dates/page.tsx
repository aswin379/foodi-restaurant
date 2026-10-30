import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/dashboard/page-header"
import { HoursNav } from "@/components/hours/hours-nav"
import { HoursLoadFailure, HoursSkeleton } from "@/components/hours/hours-states"
import { PreviewHoursControls } from "@/components/hours/preview-hours-controls"
import { SpecialDatesList } from "@/components/hours/special-dates-list"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { getHoursContext, getWeeklyHours, hoursMode, listSpecialDates } from "@/lib/hours/service"
import { localClock } from "@/lib/time/calendar"

export const metadata: Metadata = {
  title: "Special dates",
}

export default function SpecialDatesPage({ searchParams }: PageProps<"/hours/special-dates">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="hero"
        title="Availability & hours"
        description="Holidays and special hours replace the weekly hours on a date, for the order types you choose."
        actions={<HoursNav current="/hours/special-dates" />}
      />
      <Suspense fallback={<HoursSkeleton label="Loading special dates" />}>
        <SpecialDatesView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function SpecialDatesView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { preview } = await searchParams
  let loaded
  try {
    const [context, weekly, specialDates] = await Promise.all([getHoursContext(), getWeeklyHours(preview), listSpecialDates(preview)])
    loaded = { context, weekly, specialDates }
  } catch (error) {
    return <HoursLoadFailure error={error} retryHref="/hours/special-dates" />
  }
  const { context, weekly, specialDates } = loaded
  const isPreview = hoursMode() === "preview"
  // The restaurant-local date, for the date picker and early checks. The data source decides finally.
  const today = localClock(new Date(), context.timeZone).date

  return (
    <div className="flex flex-col gap-5">
      {isPreview ? <PreviewNotice detail="Sample special dates are marked (preview)." /> : null}
      {isPreview ? <PreviewHoursControls /> : null}
      <SpecialDatesList specialDates={specialDates} weekly={weekly} today={today} locale={context.locale} />
    </div>
  )
}
