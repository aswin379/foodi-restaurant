import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import type { SellerUser } from "@/features/auth/types"

import { SidebarNav } from "./sidebar-nav"

let pathname = "/dashboard"
let query = ""
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(query),
}))

let currentUser: SellerUser
vi.mock("@/features/auth/auth-context", () => ({ useAuth: () => ({ user: currentUser }) }))

let usesOwnDelivery = true
vi.mock("@/features/delivery-men/own-delivery", () => ({ useUsesOwnDelivery: () => usesOwnDelivery }))

const owner: SellerUser = {
  id: 1,
  role: "owner",
  firstName: "A",
  lastName: "B",
  email: "a@example.com",
  restaurant: { id: 1, name: "R" },
  restaurants: [{ id: 1, name: "R", status: "APPROVED" }],
}

beforeEach(() => {
  pathname = "/dashboard"
  query = ""
  usesOwnDelivery = true
  currentUser = owner
})

const deliveryButton = () => screen.getByRole("button", { name: "Delivery" })
const subLink = (name: string) => screen.queryByRole("link", { name })

describe("Delivery dropdown", () => {
  it("is closed on other pages and opens on click", () => {
    render(<SidebarNav />)
    expect(deliveryButton()).toHaveAttribute("aria-expanded", "false")
    expect(subLink("Activity")).toBeNull()
    fireEvent.click(deliveryButton())
    expect(deliveryButton()).toHaveAttribute("aria-expanded", "true")
    expect(subLink("Activity")).toHaveAttribute("href", "/delivery")
    expect(subLink("History")).toHaveAttribute("href", "/delivery?view=history")
    expect(subLink("Delivery boys")).toHaveAttribute("href", "/delivery-boys")
  })

  it("opens by itself on a Delivery page and marks Activity as the current page", () => {
    pathname = "/delivery"
    render(<SidebarNav />)
    expect(deliveryButton()).toHaveAttribute("aria-expanded", "true")
    expect(subLink("Activity")).toHaveAttribute("aria-current", "page")
    expect(subLink("History")).not.toHaveAttribute("aria-current")
  })

  it("marks History as current for ?view=history, and Delivery boys on its own page", () => {
    pathname = "/delivery"
    query = "view=history"
    const { unmount } = render(<SidebarNav />)
    expect(subLink("History")).toHaveAttribute("aria-current", "page")
    expect(subLink("Activity")).not.toHaveAttribute("aria-current")
    unmount()

    pathname = "/delivery-boys"
    query = ""
    render(<SidebarNav />)
    expect(subLink("Delivery boys")).toHaveAttribute("aria-current", "page")
  })

  it("can be closed again by the owner while on a Delivery page", () => {
    pathname = "/delivery-boys"
    render(<SidebarNav />)
    fireEvent.click(deliveryButton())
    expect(deliveryButton()).toHaveAttribute("aria-expanded", "false")
    expect(subLink("Delivery boys")).toBeNull()
  })

  it("shows Delivery boys only while the restaurant delivers its own orders", () => {
    usesOwnDelivery = false
    render(<SidebarNav />)
    fireEvent.click(deliveryButton())
    expect(subLink("Activity")).not.toBeNull()
    expect(subLink("History")).not.toBeNull()
    expect(subLink("Delivery boys")).toBeNull()
  })

  it("has no separate My delivery boys link", () => {
    render(<SidebarNav />)
    expect(screen.queryByText("My delivery boys")).toBeNull()
  })

  it("is hidden from staff without the delivery permission and shown to staff with it", () => {
    currentUser = { ...owner, role: "staff", permissions: ["orders"] }
    const { unmount } = render(<SidebarNav />)
    expect(screen.queryByRole("button", { name: "Delivery" })).toBeNull()
    unmount()

    currentUser = { ...owner, role: "staff", permissions: ["delivery"] }
    render(<SidebarNav />)
    fireEvent.click(deliveryButton())
    expect(subLink("History")).toHaveAttribute("href", "/delivery?view=history")
    expect(subLink("Delivery boys")).not.toBeNull()
  })

  it("links straight to Activity on the collapsed rail", () => {
    render(
      <TooltipProvider>
        <SidebarNav collapsed />
      </TooltipProvider>
    )
    expect(screen.queryByRole("button", { name: "Delivery" })).toBeNull()
    expect(screen.getByRole("link", { name: "Delivery" })).toHaveAttribute("href", "/delivery")
  })
})
