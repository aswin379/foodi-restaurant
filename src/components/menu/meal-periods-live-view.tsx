"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarClock, Plus } from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"
import { MealPeriodDialog } from "@/components/menu/meal-period-dialog"
import { MealPeriodsList } from "@/components/menu/meal-periods-list"
import { MenuListSkeleton, MenuError } from "@/components/menu/menu-states"
import { PreviewMenuControls } from "@/components/menu/preview-menu-controls"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api-client"
import { mealPeriodListFromApi } from "@/lib/menu/meal-periods-api"
import type { MealPeriod } from "@/lib/menu/meal-periods"

interface MealPeriodsLiveViewProps {
  initialPeriods: MealPeriod[] | null
  timeZone: string
  isPreview: boolean
}

export function MealPeriodsLiveView({
  initialPeriods,
  timeZone,
  isPreview,
}: MealPeriodsLiveViewProps) {
  const [periods, setPeriods] = useState<MealPeriod[] | null>(initialPeriods)
  const [loading, setLoading] = useState(initialPeriods === null)
  const [error, setError] = useState<string | null>(null)

  const loadClientSide = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const raw = await api<unknown>("/seller/menu/meal-periods", {
        restaurantScoped: true,
      })
      let list = raw
      if (raw && typeof raw === "object" && "periods" in raw) {
        list = (raw as { periods: unknown }).periods
      }
      setPeriods(mealPeriodListFromApi(list))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load meal periods")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialPeriods === null) {
      loadClientSide()
    }
  }, [initialPeriods, loadClientSide])

  if (loading) {
    return <MenuListSkeleton label="Loading meal periods" />
  }

  if (error && periods === null) {
    return <MenuError retryHref="/menu/meal-periods" what="meal periods" />
  }

  const currentPeriods = periods ?? []

  const add = (
    <MealPeriodDialog
      timeZone={timeZone}
      onSaved={loadClientSide}
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
      {isPreview ? (
        <>
          <PreviewNotice detail="Sample meal periods have ids starting prv-. A real restaurant starts with none." />
          <PreviewMenuControls />
        </>
      ) : null}
      {add}
      {currentPeriods.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No meal periods yet"
          description="There are no ready-made meal periods. Add your own with Add meal period, then choose them in an item's or category's schedule."
          className="min-h-72 rounded-3xl border-border bg-card"
        />
      ) : (
        <MealPeriodsList periods={currentPeriods} timeZone={timeZone} onRefresh={loadClientSide} />
      )}
    </div>
  )
}

