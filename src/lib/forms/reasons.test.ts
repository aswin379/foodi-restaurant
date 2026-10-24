// @vitest-environment node
import { describe, expect, it } from "vitest"

import { hasReasonErrors, REASON_NOTE_MAX_LENGTH, validateReasonSelection } from "./reasons"

const options = [
  { value: "item_unavailable", label: "Item unavailable" },
  { value: "other", label: "Other", requiresNote: true },
]

describe("validateReasonSelection", () => {
  it("requires a reason from the list", () => {
    expect(validateReasonSelection({ reason: null, note: "" }, options)).toEqual({ reason: "Choose a reason." })
    expect(validateReasonSelection({ reason: "made_up", note: "" }, options).reason).toBeDefined()
  })

  it("accepts a listed reason with an optional note", () => {
    const errors = validateReasonSelection({ reason: "item_unavailable", note: "" }, options)
    expect(hasReasonErrors(errors)).toBe(false)
  })

  it("requires a note when the reason needs one", () => {
    expect(validateReasonSelection({ reason: "other", note: "   " }, options).note).toBeDefined()
    expect(hasReasonErrors(validateReasonSelection({ reason: "other", note: "Gas outage" }, options))).toBe(false)
  })

  it("limits the note length", () => {
    const note = "x".repeat(REASON_NOTE_MAX_LENGTH + 1)
    expect(validateReasonSelection({ reason: "item_unavailable", note }, options).note).toBeDefined()
  })

  it("allows no reason when optional, but still rejects unknown ones", () => {
    expect(validateReasonSelection({ reason: null, note: "" }, options, { required: false })).toEqual({})
    expect(validateReasonSelection({ reason: "made_up", note: "" }, options, { required: false }).reason).toBeDefined()
  })
})
