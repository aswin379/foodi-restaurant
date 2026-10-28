import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ServiceError } from "@/lib/data-source/errors"

import { PreviewDataBadge, SectionFailure } from "./dashboard-states"

describe("SectionFailure", () => {
  it("says a source isn't connected, without an alert or sample figures", () => {
    render(<SectionFailure error={new ServiceError("not_configured")} what="live orders" retryHref="/dashboard" />)
    expect(screen.getByText(/Live orders aren't connected yet/)).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("shows a permission refusal as an alert, with no retry", () => {
    render(<SectionFailure error={new ServiceError("forbidden")} what="recent orders" retryHref="/dashboard" />)
    expect(screen.getByRole("alert")).toHaveTextContent("You don't have permission to see recent orders.")
    expect(screen.queryByRole("link", { name: "Try again" })).not.toBeInTheDocument()
  })

  it("shows any other failure as an alert with a retry link", () => {
    render(<SectionFailure error={new Error("boom")} what="today's orders" retryHref="/dashboard" />)
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load today's orders. Nothing has changed.")
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/dashboard")
  })
})

describe("PreviewDataBadge", () => {
  it("labels preview figures with their source, and estimates as estimates", () => {
    const { rerender } = render(<PreviewDataBadge source="sample orders" />)
    expect(screen.getByText("Preview: sample orders")).toBeInTheDocument()
    rerender(<PreviewDataBadge source="sample orders" estimate />)
    expect(screen.getByText("Preview estimate from sample orders")).toBeInTheDocument()
  })
})
