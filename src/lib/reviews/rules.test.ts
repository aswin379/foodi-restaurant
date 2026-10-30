// @vitest-environment node
import { describe, expect, it } from "vitest"

import { buildFixtureReviews } from "./fixtures/reviews"
import { applyReviewCommand, canReply, canReport } from "./rules"
import type { Review } from "./types"

const NOW = new Date("2026-10-28T06:00:00.000Z")
const reviews = buildFixtureReviews(NOW.getTime())
const unreplied = reviews.find((review) => !review.reply && !review.report && !review.moderation)!
const replied = reviews.find((review) => review.reply)!
const reported = reviews.find((review) => review.report)!

describe("who can reply or report", () => {
  it("offers a reply only while there is none (R6), and a report only while there is none", () => {
    expect(canReply(unreplied)).toBe(true)
    expect(canReply(replied)).toBe(false)
    expect(canReport(unreplied)).toBe(true)
    expect(canReport(reported)).toBe(false)
  })
})

describe("applyReviewCommand", () => {
  it("records a reply with the time, and no publication status (R7)", () => {
    const updated = applyReviewCommand(unreplied, { type: "reply", text: "Thank you!" }, NOW)
    expect(updated.reply).toEqual({ text: "Thank you!", repliedAt: NOW.toISOString(), publication: null })
  })

  it("refuses a second reply instead of replacing the first (R6)", () => {
    expect(() => applyReviewCommand(replied, { type: "reply", text: "Again" }, NOW)).toThrow(
      expect.objectContaining({ kind: "conflict", userMessage: expect.stringContaining("already has a reply") })
    )
  })

  it("records a report without changing anything else about the review (R8)", () => {
    const updated = applyReviewCommand(unreplied, { type: "report_abuse", reason: "other", note: "Looks fake" }, NOW)
    expect(updated.report).toEqual({ reportedAt: NOW.toISOString(), reason: "other", note: "Looks fake" })
    const { report, ...rest } = updated
    const { report: before, ...restBefore } = unreplied
    void [report, before]
    expect(rest).toEqual(restBefore)
    // Still visible, still the same rating and text, no moderation status invented.
    expect(updated.moderation).toBeNull()
  })

  it("stores an empty note as none, and refuses a second report", () => {
    expect(applyReviewCommand(unreplied, { type: "report_abuse", reason: "spam_or_fake", note: "" }, NOW).report?.note).toBeNull()
    expect(() => applyReviewCommand(reported, { type: "report_abuse", reason: "other", note: "x" }, NOW)).toThrow(
      expect.objectContaining({ kind: "conflict", userMessage: "You've already reported this review." })
    )
  })

  it("keeps a source-supplied moderation status as it was, whatever the command", () => {
    const underReview = reviews.find((review) => review.moderation === "under_review") as Review
    expect(applyReviewCommand(underReview, { type: "reply", text: "Hi" }, NOW).moderation).toBe("under_review")
    expect(applyReviewCommand(underReview, { type: "report_abuse", reason: "spam_or_fake", note: "" }, NOW).moderation).toBe("under_review")
  })

  it("doesn't change the review it was given", () => {
    const copy = structuredClone(unreplied)
    applyReviewCommand(unreplied, { type: "reply", text: "x" }, NOW)
    expect(unreplied).toEqual(copy)
  })
})
