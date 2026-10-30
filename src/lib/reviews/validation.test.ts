// @vitest-environment node
import { describe, expect, it } from "vitest"

import { characterCount, REVIEW_REPLY_MAX_LENGTH, replyCharactersLeft, validateReply } from "./validation"

describe("validateReply", () => {
  it("accepts a reply and trims it", () => {
    expect(validateReply("  Thank you!\n")).toEqual({ ok: true, text: "Thank you!" })
  })

  it("keeps line breaks inside the reply", () => {
    expect(validateReply("Thanks.\n\nCome again.")).toEqual({ ok: true, text: "Thanks.\n\nCome again." })
  })

  it.each([["empty", ""], ["spaces", "   "], ["line breaks and tabs", "\n\t \n"], ["not text", 42], ["missing", undefined], ["null", null], ["an object", {}]])(
    "refuses an empty reply (%s)",
    (_, input) => {
      expect(validateReply(input)).toEqual({ ok: false, error: "Write a reply before sending it." })
    }
  )

  it("accepts exactly 1,000 characters and refuses 1,001", () => {
    expect(REVIEW_REPLY_MAX_LENGTH).toBe(1000)
    expect(validateReply("a".repeat(1000))).toMatchObject({ ok: true })
    const refused = validateReply("a".repeat(1001))
    expect(refused).toEqual({ ok: false, error: "Keep your reply to 1,000 characters or fewer. It is 1 over." })
  })

  it("measures the trimmed text, so edge whitespace can't push a reply over", () => {
    expect(validateReply(` ${"a".repeat(1000)} `)).toMatchObject({ ok: true })
    expect(validateReply("a".repeat(1000) + "   b")).toMatchObject({ ok: false })
  })

  it("counts an emoji as one character", () => {
    expect(characterCount("👍")).toBe(1)
    expect(validateReply("👍".repeat(1000))).toMatchObject({ ok: true })
    expect(validateReply("👍".repeat(1001))).toMatchObject({ ok: false })
  })

  it("says how far over a long reply is", () => {
    expect(validateReply("a".repeat(1250))).toEqual({ ok: false, error: expect.stringContaining("It is 250 over.") })
  })
})

describe("replyCharactersLeft", () => {
  it("counts down from the limit, negative when over, on the trimmed text", () => {
    expect(replyCharactersLeft("")).toBe(1000)
    expect(replyCharactersLeft("  abc  ")).toBe(997)
    expect(replyCharactersLeft("a".repeat(1000))).toBe(0)
    expect(replyCharactersLeft("a".repeat(1003))).toBe(-3)
  })
})
