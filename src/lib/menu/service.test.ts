// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearPreviewCollections } from "@/lib/data-source/preview-store"

import { PREVIEW_RESTAURANT } from "@/lib/restaurant/context"

import { parseMenuItemListQuery } from "./query"
import { emptyDays } from "./schedule"
import {
  getMenuContext,
  getMenuItem,
  listMenuCategories,
  listMenuItems,
  menuMode,
  performMenuCommand,
  resetMenuPreview,
} from "./service"
import { itemDraft } from "./test-drafts"

vi.mock("next/server", () => ({ connection: async () => {} }))

const query = parseMenuItemListQuery({})
const KEY = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"

beforeEach(() => {
  vi.stubEnv("FOODI_MENU_DATA_SOURCE", "")
  clearPreviewCollections()
})
afterEach(() => clearPreviewCollections())

describe("menu data source", () => {
  it("refuses preview data and simulated changes in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    for (const value of ["fixtures", "preview"]) {
      vi.stubEnv("FOODI_MENU_DATA_SOURCE", value)
      expect(menuMode()).toBe("api")
      await expect(listMenuItems(query)).rejects.toMatchObject({ kind: "not_configured" })
      await expect(listMenuCategories()).rejects.toMatchObject({ kind: "not_configured" })
      await expect(getMenuContext()).rejects.toMatchObject({ kind: "not_configured" })
      await expect(performMenuCommand({ type: "set_available", itemId: "prv-item-03" }, KEY)).rejects.toMatchObject({
        kind: "not_configured",
      })
      await expect(resetMenuPreview()).rejects.toMatchObject({ kind: "forbidden" })
    }
  })

  it("doesn't fall back to preview data when the API isn't available", async () => {
    vi.stubEnv("NODE_ENV", "development")
    await expect(listMenuItems(query)).rejects.toMatchObject({ kind: "not_configured" })
    await expect(getMenuItem("prv-item-01")).rejects.toMatchObject({ kind: "not_configured" })
  })

  it("keeps simulated changes in preview mode until reset", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("FOODI_MENU_DATA_SOURCE", "preview")
    expect((await getMenuItem("prv-item-03"))?.soldOut).not.toBeNull()
    await performMenuCommand({ type: "set_available", itemId: "prv-item-03" }, KEY)
    expect((await getMenuItem("prv-item-03"))?.soldOut).toBeNull()
    await resetMenuPreview()
    expect((await getMenuItem("prv-item-03"))?.soldOut).not.toBeNull()
  })

  it("saves a schedule in the restaurant's time zone in preview, and refuses it in production", async () => {
    const schedule = {
      mode: "custom" as const,
      days: {
        ...emptyDays(),
        mon: {
          enabled: true,
          allDay: null,
          windows: [
            { key: "new-a", start: "11:00", end: "15:00", channels: ["dine_in" as const, "takeaway" as const] },
            { key: "new-b", start: "18:00", end: "22:00", channels: ["delivery" as const] },
          ],
        },
        sat: {
          enabled: true,
          allDay: { channels: ["takeaway" as const] },
          windows: [{ key: "new-c", start: "22:00", end: "01:00", channels: ["delivery" as const] }],
        },
      },
    }
    const command = { type: "save_item" as const, itemId: null, draft: itemDraft({ name: "Late chai", schedule }) }

    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("FOODI_MENU_DATA_SOURCE", "preview")
    const result = await performMenuCommand(command, KEY)
    if (result.kind !== "item") throw new Error("expected an item")
    expect(result.item.schedule).toEqual({
      mode: "custom",
      timeZone: PREVIEW_RESTAURANT.timeZone,
      weekly: [
        {
          days: ["mon"],
          allDay: null,
          windows: [
            { start: "11:00", end: "15:00", channels: ["takeaway", "dine_in"] },
            { start: "18:00", end: "22:00", channels: ["delivery"] },
          ],
        },
        { days: ["sat"], allDay: { channels: ["takeaway"] }, windows: [{ start: "22:00", end: "01:00", channels: ["delivery"] }] },
      ],
    })
    expect((await getMenuItem(result.item.id))?.schedule).toEqual(result.item.schedule)

    vi.stubEnv("NODE_ENV", "production")
    await expect(performMenuCommand(command, "2c9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed")).rejects.toMatchObject({
      kind: "not_configured",
    })
  })
})
