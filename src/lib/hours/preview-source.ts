import "server-only"

import { ServiceError } from "@/lib/data-source/errors"
import { getPreviewCollection } from "@/lib/data-source/preview-store"
import { PREVIEW_RESTAURANT } from "@/lib/restaurant/context"
import { localClock } from "@/lib/time/calendar"

import type { HoursAdapter } from "./adapter"
import { buildFixtureHours } from "./fixtures/hours"
import { applyHoursCommand, expirePause, withEditable, type HoursCommandResult, type HoursState } from "./rules"
import { estimateStatus } from "./status-estimate"
import { emptyHoursDraft, hoursFromDraft } from "./weekly-hours"

// PREVIEW ADAPTER (development only). Hours, special dates and pause live as
// one record in the in-memory preview store, so each command is applied
// atomically. Nothing reaches Foodi, everything resets when the server
// restarts, and the store refuses to run in production. Its "server" clock
// and zone are the preview restaurant's.

/** `?preview=empty|error|slow` shows those states without a backend. */
export function parsePreviewScenario(value: unknown) {
  return value === "empty" || value === "error" || value === "slow" ? value : null
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function applyScenario(value: unknown) {
  const scenario = parsePreviewScenario(value)
  await delay(scenario === "slow" ? 2500 : 50)
  if (scenario === "error") throw new ServiceError("unavailable", "Preview scenario: error")
  return scenario
}

type StoredHours = HoursState & { id: "hours" }
const HOURS_ID = "hours"
const TIME_ZONE = PREVIEW_RESTAURANT.timeZone
const ACTOR = { kind: "staff", staff: { id: "prv-staff", name: "Preview staff" } } as const

const store = () => getPreviewCollection<StoredHours>("hours", () => [{ id: HOURS_ID, ...buildFixtureHours(Date.now()) }])
// Results of commands already applied, by idempotency key.
const processed = () =>
  getPreviewCollection<{ id: string; command: string; result: HoursCommandResult }>("hours.idempotency", () => [])

/** The stored state with any pause that has run out ended (recorded as an automatic resume). */
function current(now = new Date()): StoredHours {
  const stored = store().get(HOURS_ID)
  if (!stored) throw new ServiceError("unavailable", "Preview hours are missing.")
  const pause = expirePause(stored.pause, now)
  if (pause === stored.pause) return stored
  return store().update(HOURS_ID, (state) => ({ ...state, pause }))
}

const today = (now = new Date()) => localClock(now, TIME_ZONE).date

let sequence = 0
const newId = (kind: string) => `prv-${kind}-new-${Date.now().toString(36)}-${(sequence++).toString(36)}`

export function createPreviewHoursAdapter(): HoursAdapter {
  return {
    async context() {
      return { ...PREVIEW_RESTAURANT }
    },

    async getHours(previewScenario) {
      const scenario = await applyScenario(previewScenario)
      const { weekly } = current()
      return scenario === "empty" ? { ...weekly, byOrderType: hoursFromDraft(emptyHoursDraft()) } : weekly
    },

    async listSpecialDates(previewScenario) {
      const scenario = await applyScenario(previewScenario)
      return scenario === "empty" ? [] : withEditable(current().specialDates, today())
    },

    async getPause(previewScenario) {
      await applyScenario(previewScenario)
      return current().pause
    },

    async getStatus(previewScenario) {
      await applyScenario(previewScenario)
      const now = new Date()
      return estimateStatus(current(now), now, TIME_ZONE)
    },

    async act(command, idempotencyKey) {
      await delay(150)
      const fingerprint = JSON.stringify(command)
      const replay = processed().get(idempotencyKey)
      if (replay) {
        if (replay.command !== fingerprint) {
          throw new ServiceError("conflict", "This request key was already used for a different change.")
        }
        return replay.result
      }
      const now = new Date()
      current(now)
      let result: HoursCommandResult | undefined
      store().update(HOURS_ID, (state) => {
        const applied = applyHoursCommand(state, command, { now, actor: ACTOR, timeZone: TIME_ZONE, newId })
        result = applied.result
        return { ...applied.state, id: HOURS_ID }
      })
      processed().insert({ id: idempotencyKey, command: fingerprint, result: result! })
      return result!
    },
  }
}

/** Preview control: restores the starting sample hours. */
export function resetPreviewHours() {
  store().reset()
  processed().reset()
}
