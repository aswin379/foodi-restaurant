// @vitest-environment node
import { describe, expect, it } from "vitest"

import { categoryDraft, itemDraft } from "./test-drafts"
import { imageDataUrlBytes, validateCategoryDraft, validateMenuItemDraft, type GroupDraft } from "./validation"

const option = (key: string, name: string, price = "0", available = true) => ({ key, name, price, available })
const group = (overrides: Partial<GroupDraft> = {}): GroupDraft => ({
  key: "g1",
  name: "Extras",
  selection: "multiple",
  required: false,
  min: "0",
  max: "2",
  options: [option("o1", "Cheese", "20"), option("o2", "Olives", "15")],
  ...overrides,
})

describe("validateMenuItemDraft", () => {
  it("accepts a minimal valid item", () => {
    expect(validateMenuItemDraft(itemDraft())).toEqual({})
  })

  it("requires a name and a category (D7)", () => {
    const errors = validateMenuItemDraft(itemDraft({ name: " ", categoryId: "" }))
    expect(errors.name).toBe("Enter the item name.")
    expect(errors.categoryId).toMatch(/Every item needs one/)
  })

  it("needs a price without sizes, but not with sizes (sizes replace the price)", () => {
    expect(validateMenuItemDraft(itemDraft({ price: "" })).price).toBeDefined()
    expect(validateMenuItemDraft(itemDraft({ price: "12.345" })).price).toMatch(/two decimals/)
    const withSizes = itemDraft({
      price: "",
      sizes: [
        { key: "s1", name: "Half", price: "90", available: true },
        { key: "s2", name: "Full", price: "140", available: true },
      ],
    })
    expect(validateMenuItemDraft(withSizes)).toEqual({})
  })

  it("checks size names and prices, including duplicates", () => {
    const errors = validateMenuItemDraft(
      itemDraft({
        sizes: [
          { key: "s1", name: "Half", price: "90", available: true },
          { key: "s2", name: "half", price: "", available: true },
        ],
      })
    )
    expect(errors["sizes.s2.name"]).toBe("Each size needs a different name.")
    expect(errors["sizes.s2.price"]).toBeDefined()
  })

  it("checks option group limits", () => {
    expect(validateMenuItemDraft(itemDraft({ groups: [group()] }))).toEqual({})
    expect(validateMenuItemDraft(itemDraft({ groups: [group({ max: "3" })] }))["groups.g1.max"]).toMatch(/2 options/)
    expect(validateMenuItemDraft(itemDraft({ groups: [group({ max: "0" })] }))["groups.g1.max"]).toBeDefined()
    expect(
      validateMenuItemDraft(itemDraft({ groups: [group({ required: true, min: "3", max: "2" })] }))["groups.g1.min"]
    ).toMatch(/more than the maximum/)
    expect(validateMenuItemDraft(itemDraft({ groups: [group({ required: true, min: "0" })] }))["groups.g1.min"]).toBeDefined()
  })

  it("ignores min/max for single choice, but needs an available option when required", () => {
    expect(validateMenuItemDraft(itemDraft({ groups: [group({ selection: "single", min: "x", max: "y" })] }))).toEqual({})
    const unavailable = group({ selection: "single", required: true, options: [option("o1", "Mild", "0", false)] })
    expect(validateMenuItemDraft(itemDraft({ groups: [unavailable] }))["groups.g1.options"]).toMatch(/available option/)
  })

  it("needs options with names and valid added prices (blank means free)", () => {
    const errors = validateMenuItemDraft(
      itemDraft({ groups: [group({ options: [option("o1", "", ""), option("o2", "Olives", "abc")] })] })
    )
    expect(errors["groups.g1.options.o1.name"]).toBeDefined()
    expect(errors["groups.g1.options.o1.price"]).toBeUndefined()
    expect(errors["groups.g1.options.o2.price"]).toBeDefined()
    expect(validateMenuItemDraft(itemDraft({ groups: [group({ options: [] })] }))["groups.g1.options"]).toMatch(/at least one/)
  })

  it("needs at least one order type", () => {
    const errors = validateMenuItemDraft(itemDraft({ channels: { delivery: false, takeaway: false, dine_in: false } }))
    expect(errors.channels).toBe("Turn on at least one order type.")
  })

  it("checks calories, the sold-out reason and replacement images", () => {
    expect(validateMenuItemDraft(itemDraft({ calories: "9999" })).calories).toBeDefined()
    expect(validateMenuItemDraft(itemDraft({ calories: "420" })).calories).toBeUndefined()
    expect(
      validateMenuItemDraft(itemDraft({ soldOut: { state: "sold_out", until: "manual", reason: "x".repeat(200) } }))[
        "soldOut.reason"
      ]
    ).toBeDefined()
    expect(validateMenuItemDraft(itemDraft({ image: { kind: "replace", dataUrl: "data:text/html;base64,PGI+" } })).image).toMatch(
      /JPG, PNG or WebP/
    )
    const big = `data:image/webp;base64,${"A".repeat(1_000_000)}`
    expect(validateMenuItemDraft(itemDraft({ image: { kind: "replace", dataUrl: big } })).image).toMatch(/too large/)
    expect(validateMenuItemDraft(itemDraft({ image: { kind: "replace", dataUrl: "data:image/png;base64,iVBORw==" } }))).toEqual({})
  })
})

describe("imageDataUrlBytes", () => {
  it("measures decoded size and rejects other content", () => {
    expect(imageDataUrlBytes("data:image/png;base64,AAAA")).toBe(3)
    expect(imageDataUrlBytes("data:image/png;base64,AA==")).toBe(1)
    expect(imageDataUrlBytes("data:image/svg+xml;base64,AAAA")).toBeNull()
    expect(imageDataUrlBytes("https://example.com/a.png")).toBeNull()
  })
})

describe("validateCategoryDraft", () => {
  it("requires a name and an order type", () => {
    expect(validateCategoryDraft(categoryDraft())).toEqual({})
    expect(validateCategoryDraft(categoryDraft({ name: "" })).name).toBe("Enter the category name.")
    expect(
      validateCategoryDraft(categoryDraft({ channels: { delivery: false, takeaway: false, dine_in: false } })).channels
    ).toBeDefined()
  })
})
