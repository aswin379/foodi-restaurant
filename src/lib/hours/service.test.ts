// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearPreviewCollections } from "@/lib/data-source/preview-store"

import {
  getAvailabilityStatus,
  getHoursContext,
  getPauseState,
  getWeeklyHours,
  hoursMode,
  listSpecialDates,
  performHoursCommand,
  resetHoursPreview,
} from "./service"

vi.mock("next/server", () => ({ connection: async () => {} }))

const KEY = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"
const OTHER_KEY = "2c9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"

beforeEach(() => {
  vi.stubEnv("FOODI_HOURS_DATA_SOURCE", "")
  clearPreviewCollections()
})
afterEach(() => clearPreviewCollections())

describe("hours data source", () => {
  it("refuses preview data and simulated changes in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    for (const value of ["fixtures", "preview"]) {
      vi.stubEnv("FOODI_HOURS_DATA_SOURCE", value)
      expect(hoursMode()).toBe("api")
      await expect(getWeeklyHours()).rejects.toMatchObject({ kind: "not_configured" })
      await expect(listSpecialDates()).rejects.toMatchObject({ kind: "not_configured" })
      await expect(getPauseState()).rejects.toMatchObject({ kind: "not_configured" })
      await expect(getAvailabilityStatus()).rejects.toMatchObject({ kind: "not_configured" })
      await expect(getHoursContext()).rejects.toMatchObject({ kind: "not_configured" })
      await expect(performHoursCommand({ type: "pause", duration: "15m", reason: "" }, KEY)).rejects.toMatchObject({
        kind: "not_configured",
      })
      await expect(resetHoursPreview()).rejects.toMatchObject({ kind: "forbidden" })
    }
  })

  it("doesn't fall back to preview data when the API isn't available", async () => {
    vi.stubEnv("NODE_ENV", "development")
    await expect(getWeeklyHours()).rejects.toMatchObject({ kind: "not_configured" })
    await expect(getAvailabilityStatus()).rejects.toMatchObject({ kind: "not_configured" })
  })

  it("keeps simulated changes in preview until reset, and labels status as an estimate", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("FOODI_HOURS_DATA_SOURCE", "preview")
    expect((await getAvailabilityStatus()).source).toBe("preview_estimate")
    const paused = await performHoursCommand({ type: "pause", duration: "until_resumed", reason: "" }, KEY)
    expect(paused).toMatchObject({ kind: "pause", pause: { paused: true, until: null } })
    expect((await getPauseState()).paused).toBe(true)
    expect((await getAvailabilityStatus()).byOrderType.delivery.immediate.state).toBe("paused")
    await resetHoursPreview()
    expect((await getPauseState()).paused).toBe(false)
  })

  it("applies a repeated key once, and refuses the key for a different change", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("FOODI_HOURS_DATA_SOURCE", "preview")
    const first = await performHoursCommand({ type: "pause", duration: "30m", reason: "" }, KEY)
    // The same key again replays the stored result instead of failing as "already paused".
    expect(await performHoursCommand({ type: "pause", duration: "30m", reason: "" }, KEY)).toEqual(first)
    await expect(performHoursCommand({ type: "pause", duration: "1h", reason: "" }, KEY)).rejects.toMatchObject({ kind: "conflict" })
    await expect(performHoursCommand({ type: "pause", duration: "1h", reason: "" }, OTHER_KEY)).rejects.toMatchObject({
      kind: "conflict",
    })
  })

  it("lists past preview special dates as read-only", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("FOODI_HOURS_DATA_SOURCE", "preview")
    const specialDates = await listSpecialDates()
    expect(specialDates.find((item) => item.id === "prv-spd-past")?.editable).toBe(false)
    expect(specialDates.filter((item) => item.editable).length).toBeGreaterThan(0)
    expect(specialDates.every((item) => item.note?.includes("(preview)"))).toBe(true)
  })
})
