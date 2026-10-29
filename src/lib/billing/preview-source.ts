import "server-only"

import { ServiceError } from "@/lib/data-source/errors"
import { PREVIEW_RESTAURANT } from "@/lib/restaurant/context"

import type { BillingAdapter } from "./adapter"
import { buildFixturePlan, type PreviewPlanVariant } from "./fixtures/billing"

// PREVIEW ADAPTER (development only). Read-only, obviously fictional sample
// data. It is only ever created by selectAdapter in preview mode, which is
// refused in production. None of it is evidence of how a real billing service
// behaves.

const SCENARIOS = ["empty", "error", "slow", "forbidden", "past_due", "trial", "minimal"] as const
type Scenario = (typeof SCENARIOS)[number]

/** `?preview=empty|error|slow|forbidden` shows those states; `past_due|trial|minimal` show plan variants. */
export function parsePreviewScenario(value: unknown): Scenario | null {
  return typeof value === "string" && (SCENARIOS as readonly string[]).includes(value) ? (value as Scenario) : null
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function applyScenario(value: unknown) {
  const scenario = parsePreviewScenario(value)
  await delay(scenario === "slow" ? 2500 : 80)
  if (scenario === "error") throw new ServiceError("unavailable", "Preview scenario: error")
  if (scenario === "forbidden") throw new ServiceError("forbidden", "Preview scenario: forbidden")
  return scenario
}

export function createPreviewBillingAdapter(): BillingAdapter {
  return {
    async context() {
      return { ...PREVIEW_RESTAURANT }
    },

    async plan(previewScenario) {
      const scenario = await applyScenario(previewScenario)
      if (scenario === "empty") return null
      const variant: PreviewPlanVariant = scenario === "past_due" || scenario === "trial" || scenario === "minimal" ? scenario : "default"
      return buildFixturePlan(Date.now(), variant)
    },
  }
}
