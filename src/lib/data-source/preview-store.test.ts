// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearPreviewCollections, getPreviewCollection, PreviewCollection } from "./preview-store"

type Dish = { id: string; name: string; available: boolean; tags: string[] }

const seed = (): Dish[] => [
  { id: "d1", name: "Masala dosa", available: true, tags: ["breakfast"] },
  { id: "d2", name: "Veg thali", available: true, tags: [] },
]

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development")
  clearPreviewCollections()
})

afterEach(() => {
  clearPreviewCollections()
})

describe("PreviewCollection", () => {
  it("simulates updates and keeps them for later reads", () => {
    const dishes = new PreviewCollection("dish", seed)
    const updated = dishes.update("d1", (dish) => ({ ...dish, available: false }))

    expect(updated.available).toBe(false)
    expect(dishes.get("d1")?.available).toBe(false)
    expect(dishes.get("d2")?.available).toBe(true)
  })

  it("supports insert and remove, and rejects duplicates and unknown ids", () => {
    const dishes = new PreviewCollection("dish", seed)
    dishes.insert({ id: "d3", name: "Filter coffee", available: true, tags: [] })
    expect(dishes.list().map((dish) => dish.id)).toEqual(["d1", "d2", "d3"])

    expect(() => dishes.insert({ id: "d1", name: "Copy", available: true, tags: [] })).toThrow(
      expect.objectContaining({ kind: "conflict" })
    )
    dishes.remove("d3")
    expect(() => dishes.remove("d3")).toThrow(expect.objectContaining({ kind: "not_found" }))
    expect(() => dishes.update("missing", (dish) => dish)).toThrow(
      expect.objectContaining({ kind: "not_found" })
    )
  })

  it("refuses an update that changes the record id", () => {
    const dishes = new PreviewCollection("dish", seed)
    expect(() => dishes.update("d1", (dish) => ({ ...dish, id: "other" }))).toThrow(
      expect.objectContaining({ kind: "validation" })
    )
    expect(dishes.get("other")).toBeNull()
  })

  it("leaves the record unchanged when the updater throws", () => {
    const dishes = new PreviewCollection("dish", seed)
    expect(() =>
      dishes.update("d1", () => {
        throw new Error("transition not allowed")
      })
    ).toThrow("transition not allowed")
    expect(dishes.get("d1")?.available).toBe(true)
  })

  it("returns copies, so callers can't change stored data", () => {
    const dishes = new PreviewCollection("dish", seed)
    const read = dishes.get("d1")!
    read.tags.push("mutated")
    read.name = "Changed"

    const listed = dishes.list()[0]
    listed.available = false

    expect(dishes.get("d1")).toEqual(seed()[0])
  })

  it("reset restores the seed data", () => {
    const dishes = new PreviewCollection("dish", seed)
    dishes.update("d1", (dish) => ({ ...dish, name: "Changed" }))
    dishes.reset()
    expect(dishes.list()).toEqual(seed())
  })

  it("refuses every operation in production", () => {
    const dishes = new PreviewCollection("dish", seed)
    vi.stubEnv("NODE_ENV", "production")

    const forbidden = expect.objectContaining({ kind: "forbidden" })
    expect(() => new PreviewCollection("dish", seed)).toThrow(forbidden)
    expect(() => dishes.list()).toThrow(forbidden)
    expect(() => dishes.get("d1")).toThrow(forbidden)
    expect(() => dishes.update("d1", (dish) => dish)).toThrow(forbidden)
    expect(() => dishes.reset()).toThrow(forbidden)
    expect(() => getPreviewCollection("dish", seed)).toThrow(forbidden)
  })
})

describe("getPreviewCollection", () => {
  it("returns the same collection for a name until the store is cleared", () => {
    const first = getPreviewCollection("dish", seed)
    first.update("d1", (dish) => ({ ...dish, available: false }))

    expect(getPreviewCollection("dish", seed).get("d1")?.available).toBe(false)

    clearPreviewCollections()
    expect(getPreviewCollection("dish", seed).get("d1")?.available).toBe(true)
  })
})
