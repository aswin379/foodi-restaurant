// @vitest-environment node
import { describe, expect, it, vi } from "vitest"

import { ServiceError } from "./errors"
import { assertPreviewAllowed, resolveDataSourceMode, selectAdapter } from "./mode"

describe("resolveDataSourceMode", () => {
  it("defaults to the real API", () => {
    expect(resolveDataSourceMode(undefined, "development")).toBe("api")
    expect(resolveDataSourceMode("", "development")).toBe("api")
    expect(resolveDataSourceMode("api", "development")).toBe("api")
    expect(resolveDataSourceMode("PREVIEW", "development")).toBe("api")
  })

  it("uses preview only when explicitly enabled outside production", () => {
    expect(resolveDataSourceMode("preview", "development")).toBe("preview")
    expect(resolveDataSourceMode("fixtures", "development")).toBe("preview")
    expect(resolveDataSourceMode("preview", "test")).toBe("preview")
  })

  it("refuses preview in production whatever the variable says", () => {
    expect(resolveDataSourceMode("preview", "production")).toBe("api")
    expect(resolveDataSourceMode("fixtures", "production")).toBe("api")
  })
})

describe("assertPreviewAllowed", () => {
  it("throws a forbidden ServiceError in production", () => {
    expect(() => assertPreviewAllowed("production")).toThrow(ServiceError)
    try {
      assertPreviewAllowed("production")
    } catch (error) {
      expect((error as ServiceError).kind).toBe("forbidden")
    }
  })

  it("allows development and test", () => {
    expect(() => assertPreviewAllowed("development")).not.toThrow()
    expect(() => assertPreviewAllowed("test")).not.toThrow()
  })
})

describe("selectAdapter", () => {
  const api = { name: "api" }
  const previewAdapter = { name: "preview" }

  it("never builds the preview adapter in production", () => {
    const preview = vi.fn(() => previewAdapter)
    const selected = selectAdapter({ modeValue: "preview", api, preview, nodeEnv: "production" })
    expect(selected).toEqual({ mode: "api", adapter: api })
    expect(preview).not.toHaveBeenCalled()
  })

  it("builds the preview adapter only when chosen", () => {
    const preview = vi.fn(() => previewAdapter)
    expect(selectAdapter({ modeValue: undefined, api, preview, nodeEnv: "development" }).adapter).toBe(api)
    expect(preview).not.toHaveBeenCalled()
    expect(selectAdapter({ modeValue: "preview", api, preview, nodeEnv: "development" })).toEqual({
      mode: "preview",
      adapter: previewAdapter,
    })
  })

  it("lets API errors reach the caller instead of falling back to preview data", async () => {
    const failingApi = {
      list: vi.fn(async () => {
        throw new ServiceError("unavailable")
      }),
    }
    const preview = vi.fn(() => ({ list: vi.fn(async () => ["sample"]) }))
    const { adapter } = selectAdapter({ modeValue: undefined, api: failingApi, preview, nodeEnv: "development" })

    await expect(adapter.list()).rejects.toMatchObject({ kind: "unavailable" })
    expect(preview).not.toHaveBeenCalled()
  })
})
