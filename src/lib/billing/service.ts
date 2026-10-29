import "server-only"

import { connection } from "next/server"

import { selectAdapter, type DataSourceMode } from "@/lib/data-source/mode"
import type { RestaurantContext } from "@/lib/restaurant/context"

import type { BillingAdapter } from "./adapter"
import { apiBillingAdapter } from "./api-source"
import { createPreviewBillingAdapter } from "./preview-source"
import type { Plan } from "./types"

/**
 * Preview data is an explicit development opt-in
 * (FOODI_BILLING_DATA_SOURCE=preview) and is refused in production builds:
 * there it resolves to the API whatever the variable says. There is no
 * fallback: if the API fails, the UI shows an error.
 */
function billing(): { mode: DataSourceMode; adapter: BillingAdapter } {
  return selectAdapter({
    modeValue: process.env.FOODI_BILLING_DATA_SOURCE,
    api: apiBillingAdapter,
    preview: createPreviewBillingAdapter,
  })
}

export function billingMode(): DataSourceMode {
  return billing().mode
}

export async function getBillingContext(): Promise<RestaurantContext> {
  await connection()
  return billing().adapter.context()
}

/** Returns null when this restaurant has no plan. */
export async function getPlan(previewScenario?: unknown): Promise<Plan | null> {
  await connection()
  return billing().adapter.plan(previewScenario)
}
