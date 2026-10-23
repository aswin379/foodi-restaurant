// @vitest-environment node
import { describe, expect, it } from "vitest"

import { parseOrderCommand, PREP_TIME_MAX, PREP_TIME_MIN } from "./commands"

describe("parseOrderCommand", () => {
  it("accepts valid commands", () => {
    expect(parseOrderCommand({ type: "accept", prepTimeMinutes: 20 })).toEqual({
      ok: true,
      command: { type: "accept", prepTimeMinutes: 20 },
    })
    expect(parseOrderCommand({ type: "mark_ready", extra: "ignored" })).toEqual({ ok: true, command: { type: "mark_ready" } })
    expect(parseOrderCommand({ type: "cancel", reason: "other", note: " Gas outage ", riderRecallConfirmed: true })).toEqual({
      ok: true,
      command: { type: "cancel", reason: "other", note: "Gas outage", riderRecallConfirmed: true },
    })
  })

  it("rejects prep times outside the allowed range or not whole minutes", () => {
    for (const prepTimeMinutes of [PREP_TIME_MIN - 1, PREP_TIME_MAX + 1, 12.5, "20", null]) {
      expect(parseOrderCommand({ type: "accept", prepTimeMinutes })).toMatchObject({ ok: false })
    }
  })

  it("requires a listed reason, and a note for Other", () => {
    expect(parseOrderCommand({ type: "reject", reason: "", note: "" })).toEqual({
      ok: false,
      fieldErrors: { reason: "Choose a reason." },
    })
    expect(parseOrderCommand({ type: "reject", reason: "made_up", note: "" })).toMatchObject({ ok: false })
    expect(parseOrderCommand({ type: "reject", reason: "other", note: "  " })).toMatchObject({
      ok: false,
      fieldErrors: { note: expect.any(String) },
    })
    // Cancellation reasons are a different list from rejection reasons.
    expect(parseOrderCommand({ type: "cancel", reason: "too_busy", note: "" })).toMatchObject({ ok: false })
  })

  it("treats a missing rider confirmation as false", () => {
    expect(parseOrderCommand({ type: "cancel", reason: "kitchen_issue", note: "", riderRecallConfirmed: "yes" })).toMatchObject({
      ok: true,
      command: { riderRecallConfirmed: false },
    })
  })

  it("rejects unknown or malformed input", () => {
    for (const input of [null, "accept", 42, {}, { type: "start_preparing" }, { type: "dispatch" }]) {
      expect(parseOrderCommand(input)).toMatchObject({ ok: false })
    }
  })
})
