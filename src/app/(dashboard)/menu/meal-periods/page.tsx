import { Suspense } from "react"
import type { Metadata } from "next"
import { CalendarClock, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { MealPeriodDialog } from "@/components/menu/meal-period-dialog"
import { MealPeriodsList } from "@/components/menu/meal-periods-list"
import { MenuListSkeleton, MenuLoadFailure } from "@/components/menu/menu-states"
import { PreviewMenuControls } from "@/components/menu/preview-menu-controls"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { getMenuContext, listMealPeriods, menuMode } from "@/lib/menu/service"

export const metadata: Metadata = {
  title: "Meal periods",
}

export default function MealPeriodsPage({ searchParams }: PageProps<"/menu/meal-periods">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="hero"
        title="Meal periods"
        description="Name the times you serve, like Lunch or Dinner, and use them in item and category schedules. Changing a meal period changes it everywhere it's used."
      />
      <Suspense fallback={<MenuListSkeleton label="Loading meal periods" />}>
        <MealPeriodsView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function MealPeriodsView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { preview } = await searchParams

  let loaded
  try {
    const [context, periods] = await Promise.all([getMenuContext(), listMealPeriods(preview)])
    loaded = { context, periods }
  } catch (error) {
    // No fallback data: a failed request is shown as a failure.
    return <MenuLoadFailure error={error} retryHref="/menu/meal-periods" what="meal_periods" />
  }
  const { context, periods } = loaded

  // The add button sits in this streamed section, since it needs the restaurant's zone.
  const add = (
    <MealPeriodDialog
      timeZone={context.timeZone}
      trigger={
        <Button className="w-fit">
          <Plus aria-hidden />
          Add meal period
        </Button>
      }
    />
  )

  return (
    <div className="flex flex-col gap-4">
      {menuMode() === "preview" ? (
        <>
          <PreviewNotice detail="Sample meal periods have ids starting prv-. A real restaurant starts with none." />
          <PreviewMenuControls />
        </>
      ) : null}
      {add}
      {periods.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No meal periods yet"
          description="There are no ready-made meal periods. Add your own with Add meal period, then choose them in an item's or category's schedule."
          className="min-h-72 rounded-3xl border-border bg-card"
        />
      ) : (
        <MealPeriodsList periods={periods} timeZone={context.timeZone} />
      )}
    </div>
  )
}
