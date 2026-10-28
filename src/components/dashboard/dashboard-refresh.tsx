"use client"

import { useVisibleRefresh } from "@/components/shared/use-visible-refresh"

/** Refreshes the dashboard's server data every 15 s while the tab is visible (B5a, B5-D5). */
export function DashboardRefresh() {
  useVisibleRefresh()
  return null
}
