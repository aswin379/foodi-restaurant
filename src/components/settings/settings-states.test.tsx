import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ServiceError } from "@/lib/data-source/errors"

import { SettingsLoadFailure } from "./settings-states"

describe("SettingsLoadFailure", () => {
  it("says there is no permission, with an alert and no retry, for a forbidden response", () => {
    render(<SettingsLoadFailure error={new ServiceError("forbidden")} retryHref="/settings/profile" />)
    expect(screen.getByRole("alert")).toHaveTextContent("You don't have permission to see or change restaurant settings")
    expect(screen.getByText("Only the restaurant owner can. Ask them if something needs changing.")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Try again" })).toBeNull()
  })

  it("says settings aren't connected, and shows no data, when the service isn't configured", () => {
    render(<SettingsLoadFailure error={new ServiceError("not_configured")} retryHref="/settings/profile" />)
    expect(screen.getByText("Settings aren't connected yet")).toBeInTheDocument()
    expect(screen.getByText(/Nothing is shown or saved until then/)).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Try again" })).toBeNull()
  })

  it("offers a retry link to the same page for any other failure", () => {
    render(<SettingsLoadFailure error={new ServiceError("unavailable")} retryHref="/settings/orders" />)
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load your settings")
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/settings/orders")
  })
})
