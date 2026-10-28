import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { RestaurantProfile } from "@/lib/settings/types"

import { ProfileForm } from "./profile-form"
import { REQUEST_FAILED_MESSAGE, useSettingsCommand } from "./use-settings-command"

// The Server Action is replaced per test; the real one is covered by the
// service tests and the browser tests.
const runSettingsCommand = vi.fn()
vi.mock("@/app/(dashboard)/settings/actions", () => ({ runSettingsCommand: (input: unknown) => runSettingsCommand(input) }))
const notifyActionResult = vi.fn()
vi.mock("@/components/shared/notifications", () => ({ notifyActionResult: (...args: unknown[]) => notifyActionResult(...args) }))

beforeEach(() => {
  runSettingsCommand.mockReset()
  notifyActionResult.mockReset()
})

const profile: RestaurantProfile = {
  name: "Spice Route",
  description: null,
  contact: { phone: null, email: null },
  address: { line1: "12 Sample Street", line2: null, city: "Bengaluru", region: null, postalCode: "560001" },
  location: null,
  logoUrl: "data:image/png;base64,AAAA",
  coverUrl: null,
  timeZone: "Asia/Kolkata",
  currency: "INR",
  locale: "en-IN",
  version: "p-1",
  updatedAt: null,
  updatedBy: null,
}
const command = { type: "save_order_settings" as const, version: "v1", draft: { orderTypes: { delivery: { enabled: true, defaultPrepMinutes: "20" }, takeaway: { enabled: true, defaultPrepMinutes: "20" }, dine_in: { enabled: true, defaultPrepMinutes: "20" } }, minimumOrder: "", pickupCodeRequired: false } }

describe("useSettingsCommand", () => {
  it("turns a request that fails before the action answers into a recoverable failure, never a success", async () => {
    runSettingsCommand.mockRejectedValueOnce(new Error("Body exceeded 1 MB limit."))
    const { result } = renderHook(() => useSettingsCommand())
    act(() => result.current.run(command, "Order settings updated"))
    await waitFor(() => expect(result.current.result).toEqual({ ok: false, reason: "unavailable", message: REQUEST_FAILED_MESSAGE }))
    expect(result.current.pending).toBe(false)
    expect(notifyActionResult).not.toHaveBeenCalled()

    // Retrying sends the same idempotency key, so it can't apply twice.
    runSettingsCommand.mockResolvedValueOnce({ ok: true, preview: true, data: { kind: "order_settings" } })
    act(() => result.current.run(command, "Order settings updated"))
    await waitFor(() => expect(result.current.result).toMatchObject({ ok: true }))
    expect(runSettingsCommand.mock.calls[1][0].idempotencyKey).toBe(runSettingsCommand.mock.calls[0][0].idempotencyKey)
    expect(notifyActionResult).toHaveBeenCalledTimes(1)
  })
})

describe("ProfileForm", () => {
  it("shows a rejected request as an alert, with the form still usable", async () => {
    runSettingsCommand.mockRejectedValueOnce(new Error("network"))
    render(<ProfileForm profile={profile} />)
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("nothing was saved")
    // The pending state clears just after the result renders; the button must become usable again.
    await waitFor(() => expect(screen.getByRole("button", { name: "Save profile" })).not.toHaveAttribute("aria-disabled"))
  })

  it("names each image's controls, and sends error-summary links to the visible image button", async () => {
    runSettingsCommand.mockResolvedValueOnce({
      ok: false,
      reason: "validation",
      message: "Some details need correcting.",
      fieldErrors: { logo: "This image is too large after compression. Try a smaller or less detailed one." },
    })
    render(<ProfileForm profile={profile} />)
    expect(screen.getByRole("button", { name: "Choose another logo image" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove logo image" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Choose cover image" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remove image" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }))
    const link = await screen.findByRole("link", { name: /too large after compression/ })
    expect(link).toHaveAttribute("href", "#settings-logo-button")
    fireEvent.click(link)
    expect(screen.getByRole("button", { name: "Choose another logo image" })).toHaveFocus()
    // The error is also announced with the control it belongs to.
    expect(screen.getByRole("button", { name: "Choose another logo image" })).toHaveAccessibleDescription(/too large after compression/)
  })
})
