import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/dashboard/page-header"
import { HoursNav } from "@/components/hours/hours-nav"
import { HoursLoadFailure, HoursSkeleton } from "@/components/hours/hours-states"
import { PreviewHoursControls } from "@/components/hours/preview-hours-controls"
import { StatusCard } from "@/components/hours/status-card"
import { WeeklyHoursEditor } from "@/components/hours/weekly-hours-editor"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { ORDER_TYPES, type OrderType } from "@/lib/domain/order-types"
import type { PauseState } from "@/lib/hours/types"
import { getAvailabilityStatus, getHoursContext, getWeeklyHours, hoursMode } from "@/lib/hours/service"

export const metadata: Metadata = {
  title: "Availability & hours",
}

export default function HoursPage({ searchParams }: PageProps<"/hours">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="hero"
        title="Availability & hours"
        description="When customers can order, and pausing new orders when you need to."
        actions={<HoursNav current="/hours" />}
      />
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

  const pauseByType = Object.fromEntries(
    ORDER_TYPES.map((type) => [type, status.pauseByType?.[type] ?? status.pause])
  ) as Record<OrderType, PauseState>

  const enabledTypes = ORDER_TYPES.filter((type) => hours.enabledTypes?.[type] ?? true)

  return (
    <div className="flex flex-col gap-5">
      {isPreview ? <PreviewNotice detail="Sample hours and special dates are marked (preview)." /> : null}
      {isPreview ? <PreviewHoursControls /> : null}
      {/* The live status comes first in reading order, so on a phone it sits above the editor; on wide screens it is the right-hand column. */}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <StatusCard status={status} locale={context.locale} types={enabledTypes} className="lg:col-start-3 lg:row-start-1" />
        <section aria-label="Hours and pause" className="rounded-3xl bg-card p-5 shadow-[0_8px_30px_rgb(31_26_23/6%)] sm:p-6 lg:col-span-2 lg:row-start-1">
          <WeeklyHoursEditor hours={hours} pauseByType={pauseByType} locale={context.locale} />
        </section>
      </div>
    </div>
  )
}
