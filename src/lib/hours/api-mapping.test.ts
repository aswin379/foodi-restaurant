// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ApiRequest } from "@/lib/api/transport"

import { statusFromApi, weeklyHoursFromApi } from "./api-mapping"
import { apiHoursAdapter } from "./api-source"
import { emptyHoursDraft } from "./weekly-hours"

// The real server contract: four order types (delivery split into foodi_delivery and seller_delivery),
// full weekday names, snake_case engine results. The page folds delivery into one tab.

const requests: ApiRequest[] = []
let responder: (request: ApiRequest) => unknown
vi.mock("@/lib/api/transport", () => ({
  getApiTransport: () => ({
    request: async (request: ApiRequest) => {
      requests.push(request)
      return responder(request)
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
  enabledTypes: { foodi_delivery: false, seller_delivery: true, takeaway: true, dine_in: false },
  byOrderType: {
    foodi_delivery: [],
    seller_delivery: [{ days: ["friday"], allDay: false, windows: [{ start: "18:00", end: "02:00" }] }],
    takeaway: [{ days: ["saturday", "sunday"], allDay: true, windows: [] }],
    dine_in: [],
  },
  updatedAt: "2026-10-24T05:00:00Z",
  updatedBy: staff,
}
const refused = expect.objectContaining({ kind: "unavailable" })
const engine = (status: string, reason_code: string, extra: Record<string, unknown> = {}) => ({
  status,
  reason_code,
  closes_at: null,
  next_opens_at: null,
  resumes_at: null,
  accepts_scheduled: true,
  ...extra,
})

describe("hours API mapping", () => {
  it("folds the enabled delivery mode into the Delivery tab and short weekdays", () => {
    const hours = weeklyHoursFromApi(apiHours)
    expect(hours.byOrderType.delivery).toEqual([{ days: ["fri"], allDay: false, windows: [{ start: "18:00", end: "02:00" }] }])
    expect(hours.byOrderType.takeaway[0].days).toEqual(["sat", "sun"])
    expect(hours.enabledTypes).toEqual({ delivery: true, takeaway: true, dine_in: false })
  })

  it("refuses missing order types, bad days and bad times instead of guessing", () => {
    expect(() => weeklyHoursFromApi({ ...apiHours, byOrderType: { foodi_delivery: [], seller_delivery: [], dine_in: [] } })).toThrow(refused)
    expect(() => weeklyHoursFromApi({ ...apiHours, byOrderType: { ...apiHours.byOrderType, takeaway: [{ days: ["funday"], allDay: false, windows: [] }] } })).toThrow(refused)
    expect(() =>
      weeklyHoursFromApi({ ...apiHours, byOrderType: { ...apiHours.byOrderType, takeaway: [{ days: ["friday"], allDay: false, windows: [{ start: "25:00", end: "02:00" }] }] } })
    ).toThrow(refused)
  })

  it("maps special-date delivery modes to the Delivery tab and refuses unknown types", async () => {
    const apiDate = {
      id: "spd_9",
      date: "2026-11-08",
      orderTypes: ["foodi_delivery", "seller_delivery", "takeaway"],
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
    responder = () => [apiDate]
    const [specialDate] = await apiHoursAdapter.listSpecialDates()
    expect(specialDate).toMatchObject({ orderTypes: ["delivery", "takeaway"], updatedBy: { kind: "system" } })
    responder = () => [{ ...apiDate, orderTypes: ["curbside"] }]
    await expect(apiHoursAdapter.listSpecialDates()).rejects.toMatchObject({ kind: "unavailable" })
  })

  it("maps engine statuses, per-tab pauses and a missing scheduled flag", () => {
    const notPaused = { paused: false as const, lastResumedAt: null, lastResumedBy: null }
    const status = statusFromApi(
      {
        asOf: "2026-10-24T13:05:00Z",
        timeZone: "Asia/Kolkata",
        source: "server",
        pause: notPaused,
        byOrderType: {
          foodi_delivery: engine("UNAVAILABLE", "TYPE_DISABLED"),
          seller_delivery: engine("CLOSING_SOON", "OPEN_WEEKLY", { closes_at: "2026-10-24T13:20:00Z" }),
          takeaway: engine("CLOSED", "SPECIAL_DATE_CLOSED", { next_opens_at: "2026-10-25T03:30:00Z", accepts_scheduled: undefined }),
          dine_in: engine("PAUSED", "PAUSED", { resumes_at: "2026-10-24T14:00:00Z" }),
        },
      },
      { takeaway: notPaused }
    )
    expect(status.source).toBe("server")
    expect(status.byOrderType.delivery).toMatchObject({ immediate: { state: "open", until: "2026-10-24T13:20:00Z" }, scheduled: { accepting: true } })
    expect(status.byOrderType.takeaway).toMatchObject({ immediate: { state: "closed", reason: "special_date" }, scheduled: null })
    expect(status.byOrderType.dine_in.immediate).toMatchObject({ state: "paused", until: "2026-10-24T14:00:00Z" })
    expect(status.pauseByType).toEqual({ takeaway: notPaused })
    expect(() => statusFromApi({ ...status, byOrderType: { foodi_delivery: engine("BROKEN", "X"), takeaway: {}, dine_in: {} } })).toThrow(refused)
  })

  it("saves one tab: delivery hours go to every enabled delivery mode, other tabs are left out", async () => {
    responder = (request) => (request.method === "GET" ? apiHours : apiHours)
    const draft = emptyHoursDraft()
    draft.delivery.fri = { enabled: true, allDay: true, windows: [] }
    await apiHoursAdapter.act({ type: "save_hours", scope: "delivery", version: "h-12", draft }, "key-1")
    const put = requests.find((request) => request.method === "PUT")
    expect(put).toMatchObject({
      path: "/seller/hours",
      ifMatch: "h-12",
      idempotencyKey: "key-1",
      body: { byOrderType: { seller_delivery: [{ days: ["friday"], allDay: true, windows: [] }] } },
    })
    expect(Object.keys((put!.body as { byOrderType: object }).byOrderType)).toEqual(["seller_delivery"])
  })

  it("says plainly that someone else changed the hours on a stale save", async () => {
    const { ServiceError } = await import("@/lib/data-source/errors")
    responder = (request) => {
      if (request.method === "PUT") throw new ServiceError("conflict", "version_conflict")
      return apiHours
    }
    await expect(
      apiHoursAdapter.act({ type: "save_hours", scope: "takeaway", version: "old", draft: emptyHoursDraft() }, "key-2")
    ).rejects.toMatchObject({ kind: "conflict", userMessage: expect.stringContaining("Someone else changed") })
  })

  it("pauses and resumes one tab by its scope", async () => {
    const pausedAll = { paused: true, scope: "all", duration: "until_resumed", since: "x", until: null, untilLocal: null, timeZone: "Asia/Kolkata", reason: null, by: staff }
    responder = () => pausedAll
    await apiHoursAdapter.act({ type: "pause", duration: "30m", reason: "Busy", scope: "takeaway" }, "key-3")
    expect(requests[0]).toMatchObject({ method: "POST", path: "/seller/pause", body: { duration: "30m", reason: "Busy", orderType: "takeaway" } })

    requests.length = 0
    await apiHoursAdapter.act({ type: "resume", scope: "takeaway" }, "key-4")
    // A wider pause is ended as the server reports it, not as the tab names it.
    expect(requests[1]).toMatchObject({ method: "DELETE", path: "/seller/pause?orderType=all" })
  })

  it("sends special-date Delivery to the enabled delivery modes", async () => {
    responder = (request) => request.method === "GET" ? apiHours : ({ id: "a", date: "2026-11-08", orderTypes: ["foodi_delivery"], kind: "closed", allDay: false, windows: [], note: null, editable: true, version: "a-1", createdAt: "", createdBy: staff, updatedAt: "", updatedBy: staff })
    await apiHoursAdapter.act(
      { type: "add_special_date", draft: { date: "2026-11-08", orderTypes: ["delivery"], kind: "closed", allDay: false, windows: [], note: "" } },
      "key-5"
    )
    expect(requests[0]).toMatchObject({ method: "POST", path: "/seller/hours/special-dates", body: { orderTypes: ["seller_delivery"] } })
  })
})
