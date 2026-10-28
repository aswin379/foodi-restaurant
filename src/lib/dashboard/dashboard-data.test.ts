// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearPreviewCollections } from "@/lib/data-source/preview-store"
import { getAvailabilityStatus, getWeeklyHours, performHoursCommand } from "@/lib/hours/service"
import { parseMenuItemListQuery } from "@/lib/menu/query"
import { listMenuItems } from "@/lib/menu/service"
import { getOrderBoard, getTodayOrdersSummary, listOrders } from "@/lib/orders/service"
import { totalOrders } from "@/lib/orders/summary"
import { PREVIEW_RESTAURANT } from "@/lib/restaurant/context"
import { getOrderSettings, performSettingsCommand } from "@/lib/settings/service"
import { orderSettingsDraftFrom } from "@/lib/settings/validation"
import { localDateOf } from "@/lib/time/format"

import { countLiveOrders, LIVE_STATUSES } from "./live-orders"

// The data the dashboard reads (B5a), through the modules' own services.

vi.mock("next/server", () => ({ connection: async () => {} }))
vi.mock("next/cache", () => ({ refresh: () => {} }))

const KEY = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"
const OTHER_KEY = "2c9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"
const SOURCES = ["FOODI_RESTAURANT_DATA_SOURCE", "FOODI_HOURS_DATA_SOURCE", "FOODI_MENU_DATA_SOURCE", "FOODI_ORDERS_DATA_SOURCE"]
const allOrders = { status: "all" as const, search: "", from: null, to: null, page: 1, pageSize: 100 }

beforeEach(() => {
  for (const name of SOURCES) vi.stubEnv(name, "")
  clearPreviewCollections()
})
afterEach(() => clearPreviewCollections())

const preview = () => {
  vi.stubEnv("NODE_ENV", "development")
  for (const name of SOURCES) vi.stubEnv(name, "preview")
}

describe("today's orders summary", () => {
  it("is never worked out from preview data in production, and has no fallback", async () => {
    vi.stubEnv("NODE_ENV", "production")
    for (const name of SOURCES) vi.stubEnv(name, "preview")
    await expect(getTodayOrdersSummary()).rejects.toMatchObject({ kind: "not_configured" })
    vi.stubEnv("NODE_ENV", "development")
    for (const name of SOURCES) vi.stubEnv(name, "")
    await expect(getTodayOrdersSummary()).rejects.toMatchObject({ kind: "not_configured" })
  })

  it("in preview, counts orders placed today in the restaurant's zone, labelled an estimate", async () => {
    preview()
    const summary = await getTodayOrdersSummary()
    const today = localDateOf(new Date().toISOString(), PREVIEW_RESTAURANT.timeZone)
    expect(summary).toMatchObject({ date: today, timeZone: PREVIEW_RESTAURANT.timeZone, source: "preview_estimate" })
    // The same orders the history shows for today's placement date.
    const placedToday = await listOrders({ ...allOrders, from: today, to: today })
    expect(totalOrders(summary.countsByStatus)).toBe(placedToday.totalItems)
    expect(totalOrders(summary.countsByStatus)).toBeGreaterThan(0)
    expect(totalOrders((await getTodayOrdersSummary("empty")).countsByStatus)).toBe(0)
    await expect(getTodayOrdersSummary("error")).rejects.toMatchObject({ kind: "unavailable" })
  })
})

describe("live orders", () => {
  it("count exactly the orders on the preview board, every one in a shown status", async () => {
    preview()
    const board = await getOrderBoard()
    const counts = countLiveOrders(board)
    for (const { status } of LIVE_STATUSES) {
      expect(counts[status]).toBe(board.filter((order) => order.status === status).length)
    }
    expect(LIVE_STATUSES.reduce((sum, { status }) => sum + counts[status], 0)).toBe(board.length)
    expect(board.length).toBeGreaterThan(0)
  })
})

describe("recent orders", () => {
  it("are the five most recently placed, newest first", async () => {
    preview()
    const all = (await listOrders(allOrders)).items
    const recent = (await listOrders({ ...allOrders, pageSize: 5 })).items
    const newest = [...all].sort((a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt)).slice(0, 5)
    expect(recent.map((order) => order.id)).toEqual(newest.map((order) => order.id))
  })
})

describe("dashboard isolation", () => {
  it("pausing and changing an order type leave orders, menu and other hours data unchanged", async () => {
    preview()
    const menuQuery = { ...parseMenuItemListQuery({}), pageSize: 100 }
    const board = await getOrderBoard()
    const orders = await listOrders(allOrders)
    const summary = await getTodayOrdersSummary()
    const menu = await listMenuItems(menuQuery)
    const weekly = await getWeeklyHours()

    await performHoursCommand({ type: "pause", duration: "until_resumed", reason: "" }, KEY)
    const settings = await getOrderSettings()
    const draft = orderSettingsDraftFrom(settings)
    draft.orderTypes.dine_in.enabled = false
    await performSettingsCommand({ type: "save_order_settings", version: settings.version, draft }, OTHER_KEY)

    expect((await getAvailabilityStatus()).pause.paused).toBe(true)
    expect(await getOrderBoard()).toEqual(board)
    expect(await listOrders(allOrders)).toEqual(orders)
    expect((await getTodayOrdersSummary()).countsByStatus).toEqual(summary.countsByStatus)
    expect(await listMenuItems(menuQuery)).toEqual(menu)
    expect(await getWeeklyHours()).toEqual(weekly)
  })
})
