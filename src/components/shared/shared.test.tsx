import { useState } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { PREVIEW_ONLY_LABEL } from "@/lib/data-source/preview-copy"
import { actionFailure, type ActionResult } from "@/lib/data-source/result"
import type { ReasonSelection } from "@/lib/forms/reasons"

import { ActionResultMessage } from "./action-result-message"
import { ConfirmDialog } from "./confirm-dialog"
import { clearNotifications, Notifications, notify, notifyActionResult } from "./notifications"
import { PreviewNotice } from "./preview-notice"
import { ReasonPicker } from "./reason-picker"

afterEach(() => {
  act(() => clearNotifications())
})

describe("Notifications", () => {
  it("adds the preview label to every simulated success", () => {
    render(<Notifications />)
    act(() => notifyActionResult({ ok: true, data: undefined, preview: true }, { success: "Order accepted" }))

    expect(screen.getByText("Order accepted")).toBeInTheDocument()
    expect(screen.getByText(PREVIEW_ONLY_LABEL)).toBeInTheDocument()
  })

  it("doesn't add the label to a real success", () => {
    render(<Notifications />)
    act(() => notify({ kind: "success", title: "Order accepted", preview: false }))

    expect(screen.getByText("Order accepted")).toBeInTheDocument()
    expect(screen.queryByText(PREVIEW_ONLY_LABEL)).not.toBeInTheDocument()
  })

  it("shows failures as errors, with the safe message", () => {
    render(<Notifications />)
    act(() => notifyActionResult(actionFailure("not_configured"), { success: "Order accepted" }))

    expect(screen.queryByText("Order accepted")).not.toBeInTheDocument()
    expect(screen.getByText("Nothing was changed")).toBeInTheDocument()
    expect(screen.getByText(/isn't connected to Foodi yet/)).toBeInTheDocument()
  })
})

describe("ActionResultMessage", () => {
  const preview: ActionResult = { ok: true, data: undefined, preview: true }

  it("labels simulated successes", () => {
    render(<ActionResultMessage result={preview} successText="Item marked sold out" />)
    expect(screen.getByRole("status")).toHaveTextContent(`Item marked sold out. ${PREVIEW_ONLY_LABEL}.`)
  })

  it("uses an alert for failures", () => {
    render(<ActionResultMessage result={actionFailure("conflict")} successText="Saved" />)
    expect(screen.getByRole("alert")).toHaveTextContent(/changed elsewhere/)
    expect(screen.queryByText("Saved")).not.toBeInTheDocument()
  })

  it("keeps an empty live region before the first result", () => {
    render(<ActionResultMessage result={null} successText="Saved" />)
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
  })
})

describe("PreviewNotice", () => {
  it("states that nothing is saved to Foodi", () => {
    render(<PreviewNotice detail="Sample references start with PRV-." />)
    expect(screen.getByRole("note")).toHaveTextContent(PREVIEW_ONLY_LABEL)
    expect(screen.getByRole("note")).toHaveTextContent("Sample references start with PRV-.")
  })
})

const reasons = [
  { value: "kitchen_issue", label: "Kitchen issue" },
  { value: "other", label: "Other", requiresNote: true },
]

function PickerHarness({ errors }: { errors?: { reason?: string; note?: string } }) {
  const [value, setValue] = useState<ReasonSelection>({ reason: null, note: "" })
  return (
    <>
      <ReasonPicker legend="Why are you cancelling?" options={reasons} value={value} onChange={setValue} errors={errors} />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  )
}

describe("ReasonPicker", () => {
  it("is a labelled, required group of choices", () => {
    render(<PickerHarness />)
    expect(screen.getByRole("group", { name: "Why are you cancelling? (required)" })).toBeInTheDocument()
    expect(screen.getAllByRole("radio")).toHaveLength(2)
  })

  it("reports the chosen reason and note, and marks the note required for Other", () => {
    render(<PickerHarness />)
    fireEvent.click(screen.getByRole("radio", { name: "Other" }))
    expect(screen.getByLabelText(/Note.*\(required\)/)).toBeInTheDocument()

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Gas outage" } })
    expect(screen.getByTestId("value")).toHaveTextContent('{"reason":"other","note":"Gas outage"}')
  })

  it("links errors to the fields", () => {
    render(<PickerHarness errors={{ reason: "Choose a reason." }} />)
    const group = screen.getByRole("radiogroup")
    expect(group).toHaveAttribute("aria-invalid", "true")
    expect(group).toHaveAccessibleDescription("Choose a reason.")
  })
})

describe("ConfirmDialog", () => {
  it("confirms once, and can't be confirmed or dismissed while pending", () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    const { rerender } = render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Cancel this order?"
        description="The customer is notified."
        confirmLabel="Cancel order"
        destructive
        onConfirm={onConfirm}
      />
    )

    expect(screen.getByRole("alertdialog", { name: "Cancel this order?" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    rerender(
      <ConfirmDialog
        open
        pending
        onOpenChange={onOpenChange}
        title="Cancel this order?"
        description="The customer is notified."
        confirmLabel="Cancel order"
        destructive
        onConfirm={onConfirm}
      />
    )
    const confirm = screen.getByRole("button", { name: "Cancel order" })
    expect(confirm).toHaveAttribute("aria-disabled", "true")
    fireEvent.click(confirm)
    fireEvent.keyDown(confirm, { key: "Escape" })
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Go back" })).toBeDisabled()
  })
})
