import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/dashboard/page-header"
import { HoursNav } from "@/components/hours/hours-nav"
import { HoursLoadFailure, HoursSkeleton } from "@/components/hours/hours-states"
import { PauseControl } from "@/components/hours/pause-control"
import { PreviewHoursControls } from "@/components/hours/preview-hours-controls"
import { StatusCard } from "@/components/hours/status-card"
import { WeeklyHoursEditor } from "@/components/hours/weekly-hours-editor"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { getAvailabilityStatus, getHoursContext, getWeeklyHours, hoursMode } from "@/lib/hours/service"

export const metadata: Metadata = {
  title: "Availability & hours",
}

export default function HoursPage({ searchParams }: PageProps<"/hours">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Availability & hours"
        description="When customers can order from your restaurant, for delivery, takeaway and dine-in, and pausing new orders when you need to."
      />
      <HoursNav current="/hours" />
      <Suspense fallback={<HoursSkeleton />}>
        <HoursView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function HoursView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { preview } = await searchParams
  let loaded
  try {
    const [context, hours, status] = await Promise.all([getHoursContext(), getWeeklyHours(preview), getAvailabilityStatus(preview)])
    loaded = { context, hours, status }
  } catch (error) {
    // No fallback data: a failed request is shown as a failure.
    return <HoursLoadFailure error={error} retryHref="/hours" />
  }
  const { context, hours, status } = loaded
  const isPreview = hoursMode() === "preview"

  return (
    <div className="flex flex-col gap-5">
      {isPreview ? <PreviewNotice detail="Sample hours and special dates are marked (preview)." /> : null}
      {isPreview ? <PreviewHoursControls /> : null}
      <PauseControl pause={status.pause} timeZone={context.timeZone} locale={context.locale} />
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <section aria-labelledby="weekly-hours-title" className="flex flex-col gap-4 rounded-xl border bg-card p-4 lg:col-span-2">
          <div className="flex flex-col gap-1">
            <h2 id="weekly-hours-title" className="text-base font-semibold">
              Weekly hours
            </h2>
            <p className="text-xs text-muted-foreground">
              {hours.updatedAt && hours.updatedBy?.kind === "staff"
                ? `Last changed by ${hours.updatedBy.staff.name}.`
                : "Set when each order type is open."}
            </p>
          </div>
          {/* Keyed by version so a save (or someone else's change) reloads the editor. */}
          <WeeklyHoursEditor key={hours.version} hours={hours} />
        </section>
        <StatusCard status={status} locale={context.locale} />
      </div>
    </div>
  )
}
