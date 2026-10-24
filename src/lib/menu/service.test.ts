// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

import { parseMenuItemListQuery } from "./query"
import { listMenuCategories, listMenuItems, menuDataSource } from "./service"

vi.mock("next/server", () => ({ connection: async () => {} }))

const query = parseMenuItemListQuery({})

describe("menu data source (existing RUI-03 behaviour)", () => {
  beforeEach(() => {
    vi.stubEnv("FOODI_MENU_DATA_SOURCE", "")
  })

  it("refuses fixtures in production and reports the API as not configured", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("FOODI_MENU_DATA_SOURCE", "fixtures")
    expect(menuDataSource()).toBe("api")
    await expect(listMenuItems(query)).rejects.toMatchObject({ kind: "not_configured" })
    await expect(listMenuCategories()).rejects.toMatchObject({ kind: "not_configured" })
  })

  it("doesn't fall back to fixtures when the API isn't available", async () => {
    vi.stubEnv("NODE_ENV", "development")
    await expect(listMenuItems(query)).rejects.toMatchObject({ kind: "not_configured" })
  })

  it("serves sample items only when explicitly enabled", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("FOODI_MENU_DATA_SOURCE", "fixtures")
    const result = await listMenuItems(query)
    expect(result.items.length).toBeGreaterThan(0)
  })
})
