// @vitest-environment node
import { describe, expect, it } from "vitest"

import { parseReviewCommand } from "./commands"
import { REVIEW_REPORT_REASONS } from "./reasons"

describe("parseReviewCommand: reply", () => {
  it("parses a valid reply, trimmed", () => {
    expect(parseReviewCommand({ type: "reply", text: " Thanks! " })).toEqual({ ok: true, command: { type: "reply", text: "Thanks!" } })
  })

  it("refuses an empty or over-long reply with a field error on the text", () => {
    expect(parseReviewCommand({ type: "reply", text: "  " })).toEqual({ ok: false, fieldErrors: { text: "Write a reply before sending it." } })
    expect(parseReviewCommand({ type: "reply", text: "a".repeat(1000) })).toMatchObject({ ok: true })
    expect(parseReviewCommand({ type: "reply", text: "a".repeat(1001) })).toMatchObject({ ok: false, fieldErrors: { text: expect.any(String) } })
    expect(parseReviewCommand({ type: "reply" })).toMatchObject({ ok: false })
  })

  it("keeps only the fields it knows, so a browser can't add its own", () => {
    expect(parseReviewCommand({ type: "reply", text: "Hi", moderation: "hidden", rating: 1 })).toEqual({
      ok: true,
      command: { type: "reply", text: "Hi" },
    })
  })
})

describe("parseReviewCommand: report_abuse", () => {
  it("parses a report with a reason, trimming the note", () => {
    expect(parseReviewCommand({ type: "report_abuse", reason: "spam_or_fake", note: "  " })).toEqual({
      ok: true,
      command: { type: "report_abuse", reason: "spam_or_fake", note: "" },
    })
    expect(parseReviewCommand({ type: "report_abuse", reason: "abusive_language", note: " Rude words " })).toMatchObject({
      command: { note: "Rude words" },
    })
  })

  it("requires a reason from the list", () => {
    expect(parseReviewCommand({ type: "report_abuse", note: "" })).toEqual({ ok: false, fieldErrors: { reason: "Choose a reason." } })
    expect(parseReviewCommand({ type: "report_abuse", reason: "because", note: "" })).toMatchObject({ ok: false, fieldErrors: { reason: "Choose a reason." } })
    expect(parseReviewCommand({ type: "report_abuse", reason: 7, note: "" })).toMatchObject({ ok: false })
  })

  it("requires a note only for Other", () => {
    expect(REVIEW_REPORT_REASONS.filter((reason) => reason.requiresNote).map((reason) => reason.value)).toEqual(["other"])
    expect(parseReviewCommand({ type: "report_abuse", reason: "other", note: "" })).toEqual({
      ok: false,
      fieldErrors: { note: "Add a short explanation for this reason." },
    })
    expect(parseReviewCommand({ type: "report_abuse", reason: "other", note: "   " })).toMatchObject({ ok: false, fieldErrors: { note: expect.any(String) } })
    expect(parseReviewCommand({ type: "report_abuse", reason: "other", note: "Competitor review" })).toMatchObject({ ok: true })
  })

  it("limits the note's length", () => {
    expect(parseReviewCommand({ type: "report_abuse", reason: "other", note: "a".repeat(501) })).toMatchObject({ ok: false, fieldErrors: { note: expect.any(String) } })
  })
})

describe("parseReviewCommand: anything else", () => {
  it.each([null, undefined, "reply", 3, [], {}, { type: "delete" }, { type: "edit_reply", text: "x" }, { type: "hide" }])("refuses %j", (input) => {
    expect(parseReviewCommand(input)).toEqual({ ok: false, fieldErrors: { command: "Unknown action." } })
  })
})
