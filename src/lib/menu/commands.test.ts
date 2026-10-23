// @vitest-environment node
import { describe, expect, it } from "vitest"

import { parseMenuCommand } from "./commands"
import { itemDraft } from "./test-drafts"

describe("parseMenuCommand", () => {
  it("accepts a valid item save and re-validates it", () => {
    expect(parseMenuCommand({ type: "save_item", itemId: null, draft: itemDraft() })).toMatchObject({ ok: true })
    expect(parseMenuCommand({ type: "save_item", itemId: null, draft: itemDraft({ categoryId: "" }) })).toMatchObject({
      ok: false,
      fieldErrors: { categoryId: expect.any(String) },
    })
  })

  it("drops unknown values instead of trusting them", () => {
    const parsed = parseMenuCommand({
      type: "save_item",
      itemId: "prv-item-01",
      draft: {
        ...itemDraft(),
        dietary: "carnivore",
        allergens: ["gluten", "plutonium", "gluten"],
        tags: ["bestseller", "<script>"],
        channels: { delivery: "yes", takeaway: true, dine_in: true },
        sizes: [{ key: "bad key!", name: "Half", price: "90" }],
      },
    })
    expect(parsed).toMatchObject({ ok: true })
    if (!parsed.ok || parsed.command.type !== "save_item") throw new Error("expected a save")
    expect(parsed.command.draft).toMatchObject({
      dietary: "veg",
      allergens: ["gluten"],
      tags: ["bestseller"],
      channels: { delivery: false, takeaway: true, dine_in: true },
      sizes: [],
    })
  })

  it("re-checks schedule order types and All day on the server", () => {
    const schedule = (sat: unknown) => ({ mode: "custom", days: { sat } })
    const save = (sat: unknown, channels = { delivery: true, takeaway: true, dine_in: true }) =>
      parseMenuCommand({ type: "save_item", itemId: null, draft: { ...itemDraft(), channels, schedule: schedule(sat) } })

    expect(save({ enabled: true, windows: [{ key: "w1", start: "18:00", end: "22:00", channels: ["pickup"] }] })).toEqual({
      ok: false,
      fieldErrors: { "schedule.sat.w1.channels": "Choose at least one order type." },
    })
    expect(
      save({
        enabled: true,
        allDay: { channels: ["takeaway"] },
        windows: [{ key: "w1", start: "18:00", end: "22:00", channels: ["takeaway", "delivery"] }],
      })
    ).toMatchObject({ ok: false, fieldErrors: { "schedule.sat.w1.channels": expect.stringMatching(/already available all day/) } })
    expect(
      save({ enabled: true, allDay: { channels: ["delivery"] } }, { delivery: false, takeaway: true, dine_in: true })
    ).toMatchObject({ ok: false, fieldErrors: { "schedule.sat.allDay": expect.stringMatching(/Delivery is off/) } })
    expect(save({ enabled: true, allDay: { channels: ["takeaway", "dine_in"] } })).toMatchObject({ ok: true })
  })

  it("rejects malformed ids and unknown commands", () => {
    for (const input of [
      null,
      { type: "set_available", itemId: "../etc/passwd" },
      { type: "save_item", itemId: 42, draft: itemDraft() },
      { type: "move_category", categoryId: "prv-cat-mains", direction: "sideways" },
      { type: "drop_tables" },
    ]) {
      expect(parseMenuCommand(input)).toMatchObject({ ok: false })
    }
  })

  it("checks sold-out choices and reasons", () => {
    expect(parseMenuCommand({ type: "set_sold_out", itemId: "prv-item-01", until: "for_2h", reason: " Oven " })).toEqual({
      ok: true,
      command: { type: "set_sold_out", itemId: "prv-item-01", until: "for_2h", reason: "Oven" },
    })
    expect(parseMenuCommand({ type: "set_sold_out", itemId: "prv-item-01", until: "forever", reason: "" })).toMatchObject({
      ok: false,
    })
    expect(
      parseMenuCommand({ type: "set_sold_out", itemId: "prv-item-01", until: "manual", reason: "x".repeat(200) })
    ).toMatchObject({ ok: false, fieldErrors: { reason: expect.any(String) } })
  })
})
