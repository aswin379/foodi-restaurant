// @vitest-environment node
import { describe, expect, it, vi } from "vitest"

import { getRestaurantContext, PREVIEW_RESTAURANT } from "./context"

describe("getRestaurantContext", () => {
  it("is not configured by default", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("FOODI_RESTAURANT_DATA_SOURCE", "")
    await expect(getRestaurantContext()).rejects.toMatchObject({ kind: "not_configured" })
  })

  it("returns the labelled preview restaurant in preview mode", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("FOODI_RESTAURANT_DATA_SOURCE", "preview")
    await expect(getRestaurantContext()).resolves.toEqual(PREVIEW_RESTAURANT)
  })

  it("refuses preview data in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("FOODI_RESTAURANT_DATA_SOURCE", "preview")
    await expect(getRestaurantContext()).rejects.toMatchObject({ kind: "not_configured" })
  })
})
