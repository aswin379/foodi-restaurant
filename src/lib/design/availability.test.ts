// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

import { designSystemAvailable } from "./availability"

afterEach(() => vi.unstubAllEnvs())

describe("designSystemAvailable", () => {
  it("is off unless explicitly enabled", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("FOODI_DESIGN_SYSTEM", "")
    expect(designSystemAvailable()).toBe(false)
  })

  it("is on in development with the preview opt-in", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("FOODI_DESIGN_SYSTEM", "preview")
    expect(designSystemAvailable()).toBe(true)
  })

  it.each(["true", "1", "yes", "PREVIEW", "on"])("ignores the value %j", (value) => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("FOODI_DESIGN_SYSTEM", value)
    expect(designSystemAvailable()).toBe(false)
  })

  it.each(["preview", "fixtures"])("is refused in production whatever the variable says (%s)", (value) => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("FOODI_DESIGN_SYSTEM", value)
    expect(designSystemAvailable()).toBe(false)
  })
})
