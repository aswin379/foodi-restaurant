// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearPreviewCollections } from "@/lib/data-source/preview-store"

import { createPreviewMenuAdapter, resetPreviewMenu } from "./preview-source"
import { parseMenuItemListQuery } from "./query"
import { itemDraft } from "./test-drafts"

const KEY_A = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"
const KEY_B = "6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b"

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development")
  clearPreviewCollections()
})
afterEach(() => clearPreviewCollections())

const list = (params: Record<string, string> = {}) =>
  createPreviewMenuAdapter().listItems({ ...parseMenuItemListQuery(params), pageSize: 100 })

describe("preview menu adapter", () => {
  it("keeps archived items out of the default list and filters by status", async () => {
    const all = await list()
    expect(all.items.every((item) => !item.archived)).toBe(true)
    const archived = await list({ filter: "archived" })
    expect(archived.items.length).toBeGreaterThan(0)
    expect(archived.items.every((item) => item.archived)).toBe(true)
    const soldOut = await list({ filter: "sold_out" })
    expect(soldOut.items.map((item) => item.name).sort()).toEqual(["Chicken 65", "Kadai vegetables"])
    const available = await list({ filter: "available" })
    // Items in a switched-off category aren't "available".
    expect(available.items.some((item) => item.categoryId === "prv-cat-breakfast")).toBe(false)
  })

  it("puts every active item in a category (D7)", async () => {
    const { items } = await list()
    expect(items.every((item) => item.categoryId && item.categoryName)).toBe(true)
  })

  it("counts only active items per category and lists archived categories last", async () => {
    const categories = await createPreviewMenuAdapter().listCategories()
    expect(categories.at(-1)).toMatchObject({ archived: true })
    expect(categories.find((category) => category.id === "prv-cat-drinks")?.itemCount).toBe(4)
  })

  it("applies a repeated key once, and refuses the key for a different change", async () => {
    const adapter = createPreviewMenuAdapter()
    const command = { type: "save_item" as const, itemId: null, draft: itemDraft({ categoryId: "prv-cat-mains", name: "Aloo gobi" }) }
    const first = await adapter.act(command, KEY_A)
    const replay = await adapter.act(command, KEY_A)
    expect(replay).toEqual(first)
    expect((await list({ q: "aloo gobi" })).totalItems).toBe(1)
    await expect(adapter.act({ type: "set_available", itemId: "prv-item-03" }, KEY_A)).rejects.toMatchObject({
      kind: "conflict",
    })
    await adapter.act({ type: "set_available", itemId: "prv-item-03" }, KEY_B)
  })

  it("resets to the sample menu", async () => {
    const adapter = createPreviewMenuAdapter()
    await adapter.act({ type: "archive_item", itemId: "prv-item-01" }, KEY_A)
    expect((await adapter.getItem("prv-item-01"))?.archived).toBe(true)
    resetPreviewMenu()
    expect((await adapter.getItem("prv-item-01"))?.archived).toBe(false)
  })

  it("refuses to run in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    await expect(list()).rejects.toMatchObject({ kind: "forbidden" })
  })
})
