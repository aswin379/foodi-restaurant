import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ServiceError } from "@/lib/data-source/errors"

import { HoursLoadFailure } from "./hours-states"

// The forbidden state has no preview scenario, so it is covered here.
describe("HoursLoadFailure", () => {
  it("says there is no permission, with an alert, for a forbidden response", () => {
    render(<HoursLoadFailure error={new ServiceError("forbidden")} retryHref="/hours" />)
    expect(screen.getByRole("alert")).toHaveTextContent("You don't have permission to see or change opening hours.")
    expect(screen.queryByRole("link", { name: "Try again" })).toBeNull()
  })

  it("says hours aren't connected, and shows no data, when the service isn't configured", () => {
    render(<HoursLoadFailure error={new ServiceError("not_configured")} retryHref="/hours" />)
    expect(screen.getByText("Hours aren't connected yet")).toBeInTheDocument()
    expect(screen.getByText(/Nothing is shown or saved until then/)).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Try again" })).toBeNull()
  })

  it("offers a retry link for any other failure", () => {
    render(<HoursLoadFailure error={new ServiceError("unavailable")} retryHref="/hours/special-dates" />)
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load your hours")
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/hours/special-dates")
  })
})
