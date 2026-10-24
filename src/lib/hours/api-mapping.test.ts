// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ApiRequest } from "@/lib/api/transport"

import { statusFromApi, weeklyHoursFromApi } from "./api-mapping"
import { apiHoursAdapter } from "./api-source"
import { emptyHoursDraft } from "./weekly-hours"

// The backend's names aren't decided (PRD §9.1). Pretend it calls takeaway
// "pickup", to prove every order type goes through the mapping layer.
vi.mock("@/lib/api/mapping", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api/mapping")>()
  const { ServiceError } = await import("@/lib/data-source/errors")
  return {
    ...original,
    toApiOrderType: (value: string) => (value === "takeaway" ? "pickup" : value),
    fromApiOrderType: (value: string) => {
      if (value === "pickup") return "takeaway"
      if (value === "delivery" || value === "dine_in") return value
      throw new ServiceError("unavailable", `Unknown order type from API: ${value}`)
    },
  }
})

const requests: ApiRequest[] = []
let response: unknown
vi.mock("@/lib/api/transport", () => ({
  getApiTransport: () => ({
    request: async (request: ApiRequest) => {
      requests.push(request)
      return response
    },
  }),
}))

beforeEach(() => {
  requests.length = 0
})

const staff = { kind: "staff", staff: { id: "stf_1", name: "Owner" } }
const apiHours = {
  timeZone: "Asia/Kolkata",
  version: "h-12",
  byOrderType: {
    delivery: [{ days: ["fri"], allDay: false, windows: [{ start: "18:00", end: "02:00" }] }],
    pickup: [{ days: ["sat", "sun"], allDay: true, windows: [] }],
    dine_in: [],
  },
  updatedAt: "2026-10-24T05:00:00Z",
  updatedBy: staff,
}
const refused = expect.objectContaining({ kind: "unavailable" })

describe("hours API mapping", () => {
  it("reads order types as record keys in product names", async () => {
    response = apiHours
    const hours = await apiHoursAdapter.getHours()
    expect(hours.byOrderType.takeaway).toEqual([{ days: ["sat", "sun"], allDay: true, windows: [] }])
    expect(requests[0]).toMatchObject({ method: "GET", path: "/seller/hours" })
  })

  it("refuses unknown or missing order types, bad days and bad times instead of guessing", () => {
    expect(() => weeklyHoursFromApi({ ...apiHours, byOrderType: { ...apiHours.byOrderType, curbside: [] } })).toThrow(refused)
    expect(() => weeklyHoursFromApi({ ...apiHours, byOrderType: { delivery: [], dine_in: [] } })).toThrow(refused)
    expect(() => weeklyHoursFromApi({ ...apiHours, byOrderType: { ...apiHours.byOrderType, delivery: [{ days: ["funday"], allDay: false, windows: [] }] } })).toThrow(refused)
    expect(() =>
      weeklyHoursFromApi({ ...apiHours, byOrderType: { ...apiHours.byOrderType, delivery: [{ days: ["fri"], allDay: false, windows: [{ start: "25:00", end: "02:00" }] }] } })
    ).toThrow(refused)
  })

  it("maps special-date order types as values, and refuses unknown ones", async () => {
    const apiDate = {
      id: "spd_9",
      date: "2026-11-08",
      orderTypes: ["pickup", "delivery"],
      kind: "special_hours",
      allDay: false,
      windows: [{ start: "17:00", end: "01:00" }],
      note: "Diwali",
      editable: true,
      version: "spd_9-1",
      createdAt: "2026-10-24T05:10:00Z",
      createdBy: staff,
      updatedAt: "2026-10-24T05:10:00Z",
      updatedBy: { kind: "system" },
    }
    response = [apiDate]
    const [specialDate] = await apiHoursAdapter.listSpecialDates()
    expect(specialDate).toMatchObject({ orderTypes: ["delivery", "takeaway"], updatedBy: { kind: "system" } })
    response = [{ ...apiDate, orderTypes: ["takeaway"] }]
    await expect(apiHoursAdapter.listSpecialDates()).rejects.toMatchObject({ kind: "unavailable" })
    response = { not: "a list" }
    await expect(apiHoursAdapter.listSpecialDates()).rejects.toMatchObject({ kind: "unavailable" })
  })

  it("treats status as the server's, and keeps 'no statement' about scheduled orders as null (P-2)", () => {
    const status = statusFromApi({
      asOf: "2026-10-24T13:05:00Z",
      timeZone: "Asia/Kolkata",
      source: "preview_estimate",
      pause: { paused: false, lastResumedAt: null, lastResumedBy: null },
      byOrderType: {
        delivery: { immediate: { state: "open", reason: "weekly_hours", until: null, nextOpening: null }, scheduled: { accepting: true } },
        pickup: { immediate: { state: "closed", reason: "special_date", until: null, nextOpening: "2026-10-25T03:30:00Z" } },
        dine_in: { immediate: { state: "paused", reason: "paused", until: null, nextOpening: null }, scheduled: null },
      },
    })
    expect(status.source).toBe("server")
    expect(status.byOrderType.takeaway).toMatchObject({ immediate: { state: "closed" }, scheduled: null })
    expect(status.byOrderType.delivery.scheduled).toEqual({ accepting: true })
    // "Unresolved" is a preview-only value; the API can't send it.
    expect(() =>
      statusFromApi({ ...status, byOrderType: { delivery: { immediate: { state: "unresolved", reason: "weekly_hours" } }, pickup: {}, dine_in: {} } })
    ).toThrow(refused)
  })

  it("sends commands to the proposed paths with API names, If-Match and the idempotency key", async () => {
    response = apiHours
    const draft = emptyHoursDraft()
    draft.takeaway.sat = { enabled: true, allDay: true, windows: [] }
    await apiHoursAdapter.act({ type: "save_hours", version: "h-12", draft }, "key-1")
    expect(requests[0]).toMatchObject({
      method: "PUT",
      path: "/seller/hours",
      ifMatch: "h-12",
      idempotencyKey: "key-1",
      body: { byOrderType: { delivery: [], pickup: [{ days: ["sat"], allDay: true, windows: [] }], dine_in: [] } },
    })

    response = { paused: true, duration: "rest_of_today", since: "x", until: "y", untilLocal: "2026-10-25T00:00+05:30", timeZone: "Asia/Kolkata", reason: null, by: staff }
    await apiHoursAdapter.act({ type: "pause", duration: "rest_of_today", reason: "" }, "key-2")
    expect(requests[1]).toMatchObject({ method: "POST", path: "/seller/pause", body: { duration: "rest_of_today", reason: null } })

    await apiHoursAdapter.act({ type: "delete_special_date", id: "spd 9", version: "v3" }, "key-3")
    expect(requests[2]).toMatchObject({ method: "DELETE", path: "/seller/hours/special-dates/spd%209", ifMatch: "v3" })

    response = { paused: false, lastResumedAt: "z", lastResumedBy: staff }
    await apiHoursAdapter.act({ type: "resume" }, "key-4")
    expect(requests[3]).toMatchObject({ method: "DELETE", path: "/seller/pause" })
  })

  it("sends special-date order types in API names", async () => {
    response = { id: "a", date: "2026-11-08", orderTypes: ["pickup"], kind: "closed", allDay: false, windows: [], note: null, editable: true, version: "a-1", createdAt: "", createdBy: staff, updatedAt: "", updatedBy: staff }
    await apiHoursAdapter.act(
      { type: "add_special_date", draft: { date: "2026-11-08", orderTypes: ["takeaway"], kind: "closed", allDay: false, windows: [], note: "" } },
      "key-5"
    )
    expect(requests[0]).toMatchObject({ method: "POST", path: "/seller/hours/special-dates", body: { orderTypes: ["pickup"] } })
  })
})
