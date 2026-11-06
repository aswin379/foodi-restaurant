import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { DeliveryLookups } from "../types"
import { RegisterDeliveryBoy } from "./register-delivery-boy"

// Every service is mocked: these tests never reach the API or the database.
const getDeliveryLookups = vi.fn()
vi.mock("../delivery-men-service", () => ({
  getDeliveryLookups: () => getDeliveryLookups(),
  createDeliveryBoy: vi.fn(),
}))
const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("@/components/shared/image-crop-dialog", () => ({ ImageCropDialog: () => null }))
vi.mock("@/components/shared/notifications", () => ({ notify: vi.fn() }))

const lookups = (over: Partial<DeliveryLookups> = {}): DeliveryLookups => ({
  zone: { id: 3, name: "Kochi" },
  vehicles: [{ id: 1, name: "Bike" }],
  deliveryMode: "SELF",
  ...over,
})

beforeEach(() => {
  getDeliveryLookups.mockReset()
  push.mockReset()
})

describe("Add delivery boy page", () => {
  it("shows the form on the page (not in a dialog) with the photo box above the fields", async () => {
    getDeliveryLookups.mockResolvedValue(lookups())
    render(<RegisterDeliveryBoy />)
    expect(await screen.findByRole("button", { name: "Register delivery boy" })).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Back to delivery boys/ })).toHaveAttribute("href", "/delivery-boys")

    const photoBox = screen.getByText("Click to upload photo")
    const firstName = screen.getByLabelText("First name")
    expect(photoBox.compareDocumentPosition(firstName) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // The identity and additional boxes sit below the fields.
    const identityBox = screen.getAllByText("Add image")[0] as HTMLElement
    expect(firstName.compareDocumentPosition(identityBox) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("does not mention admin approval", async () => {
    getDeliveryLookups.mockResolvedValue(lookups())
    render(<RegisterDeliveryBoy />)
    await screen.findByRole("button", { name: "Register delivery boy" })
    expect(screen.queryByText(/approval|Foodi reviews/i)).not.toBeInTheDocument()
    expect(screen.getByText(/active as soon as you register/i)).toBeInTheDocument()
  })

  it("explains how to switch on Self delivery when the restaurant does not deliver itself", async () => {
    getDeliveryLookups.mockResolvedValue(lookups({ deliveryMode: "FOODI" }))
    render(<RegisterDeliveryBoy />)
    expect(await screen.findByText(/We deliver ourselves/)).toHaveTextContent(/Restaurant profile/)
    expect(screen.queryByRole("button", { name: "Register delivery boy" })).not.toBeInTheDocument()
  })

  it("blocks registration with a clear message when the restaurant has no zone", async () => {
    getDeliveryLookups.mockResolvedValue(lookups({ zone: null }))
    render(<RegisterDeliveryBoy />)
    expect(await screen.findByRole("alert")).toHaveTextContent(/Set your restaurant location/)
    expect(screen.queryByRole("button", { name: "Register delivery boy" })).not.toBeInTheDocument()
  })

  it("shows the load error", async () => {
    getDeliveryLookups.mockRejectedValue(new Error("Could not load"))
    render(<RegisterDeliveryBoy />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load")
  })
})
