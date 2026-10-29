import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Review, ReviewReply, ReviewReport } from "@/lib/reviews/types"

import { ReplySection } from "./reply-section"
import { ReportAbuse } from "./report-abuse"
import { REQUEST_FAILED_MESSAGE } from "./use-review-command"

// The Server Action is replaced per test; the real one is covered by the
// service tests and the browser tests.
const runReviewCommand = vi.fn()
vi.mock("@/app/(dashboard)/reviews/actions", () => ({ runReviewCommand: (input: unknown) => runReviewCommand(input) }))
const notifyActionResult = vi.fn()
vi.mock("@/components/shared/notifications", () => ({ notifyActionResult: (...args: unknown[]) => notifyActionResult(...args) }))

const context = { timeZone: "Asia/Kolkata", locale: "en-IN" }
const review = (overrides: Partial<Review> = {}): Review => ({
  id: "prv-rev-005",
  rating: 5,
  text: "Great.",
  reviewerName: "Vikram R.",
  createdAt: "2026-10-27T09:30:00Z",
  reply: null,
  moderation: null,
  report: null,
  order: null,
  ...overrides,
})
const saved = (overrides: Partial<Review> = {}) => ({ ok: true as const, data: review(overrides), preview: true })

beforeEach(() => {
  runReviewCommand.mockReset()
  notifyActionResult.mockReset()
})

const textbox = () => screen.getByRole("textbox", { name: "Write a reply" })
const send = () => screen.getByRole("button", { name: "Send reply" })
const typeReply = (text: string) => fireEvent.change(textbox(), { target: { value: text } })

describe("ReplySection: the form", () => {
  it("has an accessible label, a hint that a reply is final, and a character counter", () => {
    render(<ReplySection reviewId="prv-rev-005" reply={null} context={context} />)
    expect(textbox()).toBeInTheDocument()
    expect(textbox()).toHaveAccessibleDescription(/can't be edited or deleted after you send it[\s\S]*1,000 of 1,000 characters left/)
    typeReply("Thank you")
    expect(screen.getByText("991 of 1,000 characters left")).toBeInTheDocument()
  })

  it("refuses an empty reply with an error tied to the textbox, and sends nothing", () => {
    render(<ReplySection reviewId="prv-rev-005" reply={null} context={context} />)
    fireEvent.click(send())
    expect(textbox()).toBeInvalid()
    expect(textbox()).toHaveAccessibleDescription(/Write a reply before sending it\./)
    expect(runReviewCommand).not.toHaveBeenCalled()
    typeReply("   ")
    fireEvent.click(send())
    expect(runReviewCommand).not.toHaveBeenCalled()
    // Typing clears the error.
    typeReply("Hello")
    expect(textbox()).not.toBeInvalid()
  })

  it("sends exactly 1,000 characters and refuses 1,001, saying how many over", async () => {
    render(<ReplySection reviewId="prv-rev-005" reply={null} context={context} />)
    typeReply("a".repeat(1001))
    expect(screen.getByText("1 character over the 1,000 limit")).toBeInTheDocument()
    fireEvent.click(send())
    expect(textbox()).toHaveAccessibleDescription(/Keep your reply to 1,000 characters or fewer\. It is 1 over\./)
    expect(runReviewCommand).not.toHaveBeenCalled()

    runReviewCommand.mockResolvedValueOnce(saved())
    typeReply("a".repeat(1000))
    fireEvent.click(send())
    await waitFor(() => expect(runReviewCommand).toHaveBeenCalledTimes(1))
    expect(runReviewCommand.mock.calls[0][0].command).toEqual({ type: "reply", text: "a".repeat(1000) })
  })

  it("sends the trimmed reply with the review id and an idempotency key, then notifies the success once", async () => {
    runReviewCommand.mockResolvedValueOnce(saved({ reply: { text: "Thanks!", repliedAt: "2026-10-28T06:00:00Z", publication: null } }))
    render(<ReplySection reviewId="prv-rev-005" reply={null} context={context} />)
    typeReply("  Thanks!  ")
    fireEvent.click(send())
    await waitFor(() => expect(notifyActionResult).toHaveBeenCalledTimes(1))
    expect(runReviewCommand).toHaveBeenCalledWith({
      reviewId: "prv-rev-005",
      command: { type: "reply", text: "Thanks!" },
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    })
    // The notification says "submitted", never "published" or "visible": the preview label is added by the notification itself.
    expect(notifyActionResult).toHaveBeenCalledWith(expect.objectContaining({ ok: true, preview: true }), { success: "Reply submitted" })
  })

  it("shows a failed request as an alert, keeps the text, never notifies success, and retries with the same key", async () => {
    runReviewCommand.mockRejectedValueOnce(new Error("network"))
    render(<ReplySection reviewId="prv-rev-005" reply={null} context={context} />)
    typeReply("Thanks!")
    fireEvent.click(send())
    expect(await screen.findByRole("alert")).toHaveTextContent(REQUEST_FAILED_MESSAGE)
    expect(notifyActionResult).not.toHaveBeenCalled()
    expect(textbox()).toHaveValue("Thanks!")
    // The pending state clears just after the alert renders; the button must become usable again.
    await waitFor(() => expect(send()).not.toHaveAttribute("aria-disabled"))

    runReviewCommand.mockResolvedValueOnce(saved())
    fireEvent.click(send())
    await waitFor(() => expect(notifyActionResult).toHaveBeenCalledTimes(1))
    expect(runReviewCommand.mock.calls[1][0].idempotencyKey).toBe(runReviewCommand.mock.calls[0][0].idempotencyKey)
  })

  it("gives an edited reply a new key, because a key belongs to one request", async () => {
    runReviewCommand.mockRejectedValueOnce(new Error("network"))
    render(<ReplySection reviewId="prv-rev-005" reply={null} context={context} />)
    typeReply("First try")
    fireEvent.click(send())
    await screen.findByRole("alert")
    await waitFor(() => expect(send()).not.toHaveAttribute("aria-disabled"))
    runReviewCommand.mockRejectedValueOnce(new Error("network"))
    typeReply("Second try")
    fireEvent.click(send())
    await waitFor(() => expect(runReviewCommand).toHaveBeenCalledTimes(2))
    expect(runReviewCommand.mock.calls[1][0].idempotencyKey).not.toBe(runReviewCommand.mock.calls[0][0].idempotencyKey)
  })

  it("shows a refusal (no permission) as an alert, with no success notification", async () => {
    runReviewCommand.mockResolvedValueOnce({ ok: false, reason: "forbidden", message: "You don't have permission to do this." })
    render(<ReplySection reviewId="prv-rev-005" reply={null} context={context} />)
    typeReply("Thanks!")
    fireEvent.click(send())
    expect(await screen.findByRole("alert")).toHaveTextContent("You don't have permission to do this.")
    expect(notifyActionResult).not.toHaveBeenCalled()
    expect(screen.queryByText(/submitted|sent|published/i)).not.toBeInTheDocument()
  })

  it("shows a server field error on the textbox instead of a general alert", async () => {
    runReviewCommand.mockResolvedValueOnce({ ok: false, reason: "validation", message: "Some details need correcting.", fieldErrors: { text: "The server says this reply is too long." } })
    render(<ReplySection reviewId="prv-rev-005" reply={null} context={context} />)
    typeReply("Thanks!")
    fireEvent.click(send())
    await waitFor(() => expect(textbox()).toHaveAccessibleDescription(/The server says this reply is too long\./))
    expect(textbox()).toBeInvalid()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("shows a 'already has a reply' conflict as an alert and doesn't claim success", async () => {
    runReviewCommand.mockResolvedValueOnce({ ok: false, reason: "conflict", message: "This review already has a reply. A reply can't be edited or deleted here." })
    render(<ReplySection reviewId="prv-rev-005" reply={null} context={context} />)
    typeReply("Thanks!")
    fireEvent.click(send())
    expect(await screen.findByRole("alert")).toHaveTextContent(/already has a reply/)
    expect(notifyActionResult).not.toHaveBeenCalled()
  })
})

describe("ReplySection: after a reply exists (R6, R7)", () => {
  const reply = (overrides: Partial<ReviewReply> = {}): ReviewReply => ({ text: "Thank you!\nCome again.", repliedAt: "2026-10-27T11:00:00Z", publication: null, ...overrides })

  it("shows the reply with no form, no second reply, and no edit or delete controls", () => {
    render(<ReplySection reviewId="prv-rev-005" reply={reply()} context={context} />)
    expect(screen.getByText(/Thank you!/)).toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByText(/edit|delete|remove/i)).not.toBeInTheDocument()
  })

  it("says nothing about visibility or approval when the source gave no status", () => {
    render(<ReplySection reviewId="prv-rev-005" reply={reply()} context={context} />)
    expect(screen.queryByText(/visible|published|approv|customers can see/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Replied/)).toHaveTextContent(/27 Oct, 4:30 pm/)
  })

  it.each([
    ["published", "Visible to customers"],
    ["pending_approval", "Waiting for approval"],
    ["not_published", "Not published"],
  ] as const)("shows the status %s only because the source supplied it", (publication, label) => {
    render(<ReplySection reviewId="prv-rev-005" reply={reply({ publication })} context={context} />)
    expect(screen.getByText(new RegExp(label))).toBeInTheDocument()
  })

  it("moves focus to the reply heading when the form is replaced by the saved reply", () => {
    const { rerender } = render(<ReplySection reviewId="prv-rev-005" reply={null} context={context} />)
    rerender(<ReplySection reviewId="prv-rev-005" reply={reply()} context={context} />)
    expect(screen.getByRole("heading", { name: "Your reply" })).toHaveFocus()
  })

  it("doesn't grab focus when it simply loads with a reply", () => {
    render(<ReplySection reviewId="prv-rev-005" reply={reply()} context={context} />)
    expect(screen.getByRole("heading", { name: "Your reply" })).not.toHaveFocus()
  })
})

describe("ReportAbuse", () => {
  const reportButton = () => screen.getByRole("button", { name: "Report abuse" })
  const dialog = () => screen.getByRole("alertdialog", { name: "Report this review?" })
  const submit = () => within(dialog()).getByRole("button", { name: "Submit report" })
  const choose = (name: string) => fireEvent.click(within(dialog()).getByRole("radio", { name }))
  const open = () => fireEvent.click(reportButton())

  it("explains that a report doesn't hide or remove the review, and asks for explicit confirmation", () => {
    render(<ReportAbuse reviewId="prv-rev-009" report={null} context={context} />)
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    open()
    expect(dialog()).toHaveAccessibleDescription(/doesn't hide or remove the review.*isn't a moderation decision/)
    expect(runReviewCommand).not.toHaveBeenCalled()
    expect(within(dialog()).getByRole("radio", { name: "Other" })).toBeInTheDocument()
  })

  it("requires a reason", () => {
    render(<ReportAbuse reviewId="prv-rev-009" report={null} context={context} />)
    open()
    fireEvent.click(submit())
    expect(within(dialog()).getByText("Choose a reason.")).toBeInTheDocument()
    expect(runReviewCommand).not.toHaveBeenCalled()
  })

  it("requires a note for Other, and only for Other", async () => {
    runReviewCommand.mockResolvedValue(saved())
    render(<ReportAbuse reviewId="prv-rev-009" report={null} context={context} />)
    open()
    choose("Other")
    fireEvent.click(submit())
    expect(within(dialog()).getByText("Add a short explanation for this reason.")).toBeInTheDocument()
    expect(runReviewCommand).not.toHaveBeenCalled()

    fireEvent.change(within(dialog()).getByRole("textbox"), { target: { value: "  Looks fake  " } })
    fireEvent.click(submit())
    await waitFor(() => expect(runReviewCommand).toHaveBeenCalledTimes(1))
    expect(runReviewCommand.mock.calls[0][0]).toEqual({
      reviewId: "prv-rev-009",
      command: { type: "report_abuse", reason: "other", note: "Looks fake" },
      idempotencyKey: expect.any(String),
    })
  })

  it("submits another reason without a note, notifies 'Report submitted' once and closes", async () => {
    runReviewCommand.mockResolvedValueOnce(saved())
    render(<ReportAbuse reviewId="prv-rev-009" report={null} context={context} />)
    open()
    choose("Spam or a fake review")
    fireEvent.click(submit())
    await waitFor(() => expect(notifyActionResult).toHaveBeenCalledTimes(1))
    expect(notifyActionResult).toHaveBeenCalledWith(expect.objectContaining({ ok: true }), { success: "Report submitted" })
    expect(runReviewCommand.mock.calls[0][0].command).toEqual({ type: "report_abuse", reason: "spam_or_fake", note: "" })
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  })

  it("shows a failed request inside the dialog, keeps it open, never notifies success, and retries with the same key", async () => {
    runReviewCommand.mockRejectedValueOnce(new Error("network"))
    render(<ReportAbuse reviewId="prv-rev-009" report={null} context={context} />)
    open()
    choose("Offensive or abusive language")
    fireEvent.click(submit())
    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(REQUEST_FAILED_MESSAGE)
    expect(notifyActionResult).not.toHaveBeenCalled()
    expect(dialog()).toBeInTheDocument()
    await waitFor(() => expect(submit()).not.toHaveAttribute("aria-disabled"))

    runReviewCommand.mockResolvedValueOnce(saved())
    fireEvent.click(submit())
    await waitFor(() => expect(notifyActionResult).toHaveBeenCalledTimes(1))
    expect(runReviewCommand.mock.calls[1][0].idempotencyKey).toBe(runReviewCommand.mock.calls[0][0].idempotencyKey)
  })

  it("shows a refusal inside the dialog without claiming the report was made", async () => {
    runReviewCommand.mockResolvedValueOnce({ ok: false, reason: "forbidden", message: "You don't have permission to do this." })
    render(<ReportAbuse reviewId="prv-rev-009" report={null} context={context} />)
    open()
    choose("Spam or a fake review")
    fireEvent.click(submit())
    expect(await within(dialog()).findByRole("alert")).toHaveTextContent("You don't have permission to do this.")
    expect(notifyActionResult).not.toHaveBeenCalled()
  })

  it("closes on Escape without sending anything, and returns focus to the Report abuse button", async () => {
    render(<ReportAbuse reviewId="prv-rev-009" report={null} context={context} />)
    open()
    fireEvent.keyDown(dialog(), { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    await waitFor(() => expect(reportButton()).toHaveFocus())
    expect(runReviewCommand).not.toHaveBeenCalled()
  })

  it("closes on Cancel and returns focus to the button", async () => {
    render(<ReportAbuse reviewId="prv-rev-009" report={null} context={context} />)
    open()
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    await waitFor(() => expect(reportButton()).toHaveFocus())
  })

  it("starts each time with no reason chosen and no earlier error", () => {
    render(<ReportAbuse reviewId="prv-rev-009" report={null} context={context} />)
    open()
    fireEvent.click(submit())
    expect(within(dialog()).getByText("Choose a reason.")).toBeInTheDocument()
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }))
    open()
    expect(within(dialog()).queryByText("Choose a reason.")).not.toBeInTheDocument()
  })

  describe("when this restaurant already reported the review", () => {
    const report: ReviewReport = { reportedAt: "2026-10-27T12:00:00Z", reason: "spam_or_fake", note: null }

    it("shows the report as a fact, with no second report control", () => {
      render(<ReportAbuse reviewId="prv-rev-017" report={report} context={context} />)
      expect(screen.queryByRole("button", { name: "Report abuse" })).not.toBeInTheDocument()
      expect(screen.getByText(/You reported this review/)).toBeInTheDocument()
      expect(screen.getByText("Reason: Spam or a fake review")).toBeInTheDocument()
    })

    it("doesn't claim the review was removed, hidden, investigated or ruled abusive", () => {
      render(<ReportAbuse reviewId="prv-rev-017" report={{ ...report, note: "Link spam" }} context={context} />)
      expect(screen.getByText(/isn't a moderation decision/)).toBeInTheDocument()
      expect(screen.queryByText(/was removed|has been removed|was hidden|investigat|reviewed by|ruled|confirmed abusive/i)).not.toBeInTheDocument()
      expect(screen.getByText(/Link spam/)).toBeInTheDocument()
    })

    it("moves focus to the report details when the Report button is replaced by them", () => {
      const { rerender } = render(<ReportAbuse reviewId="prv-rev-017" report={null} context={context} />)
      rerender(<ReportAbuse reviewId="prv-rev-017" report={report} context={context} />)
      expect(screen.getByText(/You reported this review/).closest("div")).toHaveFocus()
    })

    it("shows an unknown reason as sent, never swapped for a guess", () => {
      render(<ReportAbuse reviewId="prv-rev-017" report={{ ...report, reason: "something_new" }} context={context} />)
      expect(screen.getByText("Reason: something_new")).toBeInTheDocument()
    })
  })
})

