import { connection } from "next/server"

import { loadOpsPreview, opsMode } from "@/lib/ops-preview"

export const REPORT_RANGES = ["today", "7d", "30d"] as const
export type ReportRange = (typeof REPORT_RANGES)[number]
export const rangeLabels: Record<ReportRange, string> = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days" }

/** Amounts are in minor units (paise), like the rest of the panel. */
export type ReportSlice = { label: string; value: number }

export type RangeReport = {
  salesMinor: number
  orders: number
  /** The trend: hourly for today, daily otherwise. */
  trend: ReportSlice[]
  trendUnit: "hour" | "day"
  bestSellers: { name: string; quantity: number; salesMinor: number }[]
  categories: ReportSlice[]
  orderTypes: ReportSlice[]
  payments: ReportSlice[]
  cancelledOrders: number
  refundedMinor: number
  settlement: { pendingMinor: number; paidOutMinor: number }
}

/**
 * PROPOSED shape for a reports API. There isn't one yet, so these screens show labelled preview data only;
 * production reports "not connected" and no figure is worked out in the browser.
 */
export type ReportsData = Record<ReportRange, RangeReport>

export const reportsMode = () => opsMode(process.env.FOODI_REPORTS_DATA_SOURCE)

export async function getReports(scenario?: unknown): Promise<ReportsData | null> {
  await connection()
  return loadOpsPreview<ReportsData | null>(process.env.FOODI_REPORTS_DATA_SOURCE, scenario, null, async () => (await import("./fixtures")).PREVIEW_REPORTS)
}
