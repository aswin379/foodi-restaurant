import { describe, expect, it } from "vitest"

import { OTHER_ZONE, zoneMismatch, zoneNote } from "./zone-rules"

const inside = { id: 3, name: "Kochi" }

describe("zoneMismatch", () => {
  it("accepts a pin inside the selected zone", () => {
    expect(zoneMismatch("3", inside)).toBeUndefined()
  })
  it("rejects a pin inside a different zone", () => {
    expect(zoneMismatch("4", inside)).toMatch(/within the selected zone/)
  })
  it("rejects a pin outside every zone for an existing zone", () => {
    expect(zoneMismatch("3", "outside")).toMatch(/outside every zone/)
  })
  it("lets Other pass only outside every zone", () => {
    expect(zoneMismatch(OTHER_ZONE, "outside")).toBeUndefined()
    expect(zoneMismatch(OTHER_ZONE, inside)).toMatch(/existing zone/)
  })
  it("does not block before the pin is checked or a zone is chosen", () => {
    expect(zoneMismatch("3", null)).toBeUndefined()
    expect(zoneMismatch("", inside)).toBeUndefined()
  })
})

describe("zoneNote", () => {
  it("names the detected zone when it matches", () => {
    expect(zoneNote("3", inside)).toEqual({ text: 'Zone: Kochi', warn: false })
  })
  it("warns on a mismatch", () => {
    expect(zoneNote("4", inside).warn).toBe(true)
  })
})
