import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { DeliveryBoy, DeliveryLookups } from "../types"
import { DeliveryBoysManager } from "./delivery-boys-manager"

// Every service is mocked: these tests never reach the API or the database.
const getDeliveryLookups = vi.fn()
const listDeliveryBoys = vi.fn()
const setDeliveryBoyStatus = vi.fn()
vi.mock("../delivery-men-service", () => ({
  getDeliveryLookups: () => getDeliveryLookups(),
  listDeliveryBoys: () => listDeliveryBoys(),
  createDeliveryBoy: vi.fn(),
  deleteDeliveryBoy: vi.fn(),
  deleteDeliveryBoyDocument: vi.fn(),
  getDeliveryBoyFileUrl: vi.fn(),
  listDeliveryBoyFiles: vi.fn(async () => []),
  replaceDeliveryBoyPhoto: vi.fn(),
  setDeliveryBoyStatus: (...args: unknown[]) => setDeliveryBoyStatus(...args),
  updateDeliveryBoy: vi.fn(),
  uploadDeliveryBoyDocument: vi.fn(),
}))
vi.mock("@/components/shared/image-crop-dialog", () => ({ ImageCropDialog: () => null }))
vi.mock("@/components/shared/notifications", () => ({ notify: vi.fn() }))

const lookups = (over: Partial<DeliveryLookups> = {}): DeliveryLookups => ({
  zone: { id: 3, name: "Kochi" },
  vehicles: [{ id: 1, name: "Bike" }],
  deliveryMode: "SELF",
  ...over,
})

const rider = (over: Partial<DeliveryBoy> = {}): DeliveryBoy => ({
  id: 1,
  firstName: "Ravi",
  lastName: null,
  email: "r@example.com",
  phoneNumber: "+919999999999",
  identityDocumentType: "national_id",
  identityDocumentNumber: "ID1",
  zone: { id: 3, name: "Kochi" },
  vehicle: { id: 1, name: "Bike" },
  deliveryManType: "freelance",
  applicationStatus: "approved",
  denialReason: null,
  accountStatus: "active",
  currentOrderCount: 0,
  createdAt: "2026-11-05T00:00:00.000Z",
  ...over,
})

const load = (l: DeliveryLookups, riders: DeliveryBoy[]) => {
  getDeliveryLookups.mockResolvedValue(l)
  listDeliveryBoys.mockResolvedValue({ items: riders, page: 1, pageSize: 20, total: riders.length })
}

beforeEach(() => {
  getDeliveryLookups.mockReset()
  listDeliveryBoys.mockReset()
  setDeliveryBoyStatus.mockReset()
})

describe("Delivery boys page", () => {
  it("points to Restaurant profile when the restaurant does not deliver itself", async () => {
    load(lookups({ deliveryMode: "FOODI" }), [])
    render(<DeliveryBoysManager />)
    expect(await screen.findByText(/We deliver ourselves/)).toHaveTextContent(/Restaurant profile/)
    expect(screen.queryByRole("button", { name: /Add delivery boy/ })).not.toBeInTheDocument()
  })

  it("says to add one when there are no delivery boys yet", async () => {
    load(lookups(), [])
    render(<DeliveryBoysManager />)
    expect(await screen.findByText("No delivery boys yet")).toBeInTheDocument()
    expect(screen.getByText(/Add one to start delivering/)).toBeInTheDocument()
    // Registration is a page of its own, not a pop-up.
    expect(screen.getByRole("link", { name: /Add delivery boy/ })).toHaveAttribute("href", "/delivery-boys/new")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("tells the seller to turn a delivery boy on when none is switched on, with no mention of approval", async () => {
    load(lookups(), [rider({ accountStatus: "inactive" })])
    render(<DeliveryBoysManager />)
    expect(await screen.findByText(/Turn one on to receive your own delivery orders/)).toBeInTheDocument()
    expect(screen.queryByText(/approval|admin|Foodi reviews/i)).not.toBeInTheDocument()
  })

  it("shows no warning while one delivery boy is switched on", async () => {
    load(lookups(), [rider({ accountStatus: "inactive" }), rider({ id: 2, firstName: "Sam" })])
    render(<DeliveryBoysManager />)
    await screen.findByText("Sam")
    expect(screen.queryByText(/Turn one on/)).not.toBeInTheDocument()
  })

  it("shows a green Active and a red Inactive switch for each row", async () => {
    load(lookups(), [rider({ id: 1, firstName: "Ravi" }), rider({ id: 2, firstName: "Sam", accountStatus: "inactive" })])
    render(<DeliveryBoysManager />)
    const on = await screen.findByRole("switch", { name: "Active: Ravi" })
    const off = screen.getByRole("switch", { name: "Active: Sam" })
    expect(on).toBeChecked()
    expect(on.className).toContain("data-[state=checked]:bg-success")
    expect(screen.getByText("Active")).toHaveClass("text-success-foreground")
    expect(off).not.toBeChecked()
    expect(off.className).toContain("data-[state=unchecked]:bg-danger")
    expect(screen.getByText("Inactive")).toHaveClass("text-danger-foreground")
  })

  it("switches a delivery boy off and on from the list without opening the details panel", async () => {
    load(lookups(), [rider(), rider({ id: 2, firstName: "Sam", accountStatus: "inactive" })])
    setDeliveryBoyStatus.mockResolvedValue(undefined)
    render(<DeliveryBoysManager />)
    fireEvent.click(await screen.findByRole("switch", { name: "Active: Ravi" }))
    await waitFor(() => expect(setDeliveryBoyStatus).toHaveBeenCalledWith(1, "inactive"))
    fireEvent.click(screen.getByRole("switch", { name: "Active: Sam" }))
    await waitFor(() => expect(setDeliveryBoyStatus).toHaveBeenCalledWith(2, "active"))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await waitFor(() => expect(listDeliveryBoys.mock.calls.length).toBeGreaterThan(1)) // the list reloads
  })

  it("shows the API's message when switching fails", async () => {
    load(lookups(), [rider()])
    setDeliveryBoyStatus.mockRejectedValue(new Error("Only an admin can suspend or reinstate a delivery man"))
    render(<DeliveryBoysManager />)
    fireEvent.click(await screen.findByRole("switch", { name: "Active: Ravi" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Only an admin can suspend")
  })

  it("locks the switch for a delivery boy Foodi suspended or rejected, and says why", async () => {
    load(lookups(), [
      rider({ id: 1, firstName: "Ravi", accountStatus: "suspended" }),
      rider({ id: 2, firstName: "Sam", applicationStatus: "denied", accountStatus: "inactive", denialReason: "Bad ID" }),
    ])
    render(<DeliveryBoysManager />)
    expect(await screen.findByRole("switch", { name: "Active: Ravi" })).toBeDisabled()
    expect(screen.getByRole("switch", { name: "Active: Sam" })).toBeDisabled()
    expect(screen.getByText("Suspended by Foodi")).toBeInTheDocument()
    expect(screen.getByText("Rejected by Foodi")).toBeInTheDocument()
  })

  it("has the same switch in the details panel", async () => {
    load(lookups(), [rider()])
    setDeliveryBoyStatus.mockResolvedValue(undefined)
    render(<DeliveryBoysManager />)
    fireEvent.click(await screen.findByRole("button", { name: "Ravi" }))
    const panel = await screen.findByRole("dialog")
    const panelSwitch = panel.querySelector('[role="switch"]') as HTMLElement
    expect(panelSwitch).toBeChecked()
    fireEvent.click(panelSwitch)
    await waitFor(() => expect(setDeliveryBoyStatus).toHaveBeenCalledWith(1, "inactive"))
    expect(screen.queryByRole("button", { name: /^(Activate|Deactivate)$/ })).not.toBeInTheDocument()
  })

  it("blocks adding when the restaurant has no zone, with a clear message", async () => {
    load(lookups({ zone: null }), [])
    render(<DeliveryBoysManager />)
    expect(await screen.findByRole("alert")).toHaveTextContent(/Set your restaurant location/)
    await waitFor(() => expect(screen.getByRole("button", { name: /Add delivery boy/ })).toBeDisabled())
  })
})
