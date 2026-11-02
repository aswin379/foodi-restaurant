import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/dashboard/page-header"
import { MealPeriodsLiveView } from "@/components/menu/meal-periods-live-view"
import { MenuListSkeleton } from "@/components/menu/menu-states"
import { getMenuContext, listMealPeriods, menuMode } from "@/lib/menu/service"
import type { MealPeriod } from "@/lib/menu/meal-periods"

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

  let timeZone = "Asia/Kolkata"
  let periods: MealPeriod[] | null = null

  try {
    const context = await getMenuContext()
    timeZone = context.timeZone
  } catch {
    // Default restaurant timezone
  }

  try {
    periods = await listMealPeriods(preview)
  } catch {
    // When in live API mode without pre-synced cookies during initial SSR,
    // let MealPeriodsLiveView seamlessly fetch on the client with the in-memory bearer token!
    periods = null
  }

  return (
    <MealPeriodsLiveView
      initialPeriods={periods}
      timeZone={timeZone}
      isPreview={menuMode() === "preview"}
    />
  )
}
