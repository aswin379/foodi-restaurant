import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { DeliveryLookups } from "../types"
import type { RiderFiles, RiderValues } from "../validation"
import { RiderForm, toCreateForm, toUpdateFields } from "./rider-form"

// The cropper is covered by square-image-picker.test.tsx.
vi.mock("@/components/shared/image-crop-dialog", () => ({ ImageCropDialog: () => null }))

const lookups: DeliveryLookups = {
  zone: { id: 3, name: "Kochi" },
  vehicles: [{ id: 1, name: "Bike" }],
  deliveryMode: "SELF",
}

const values: RiderValues = {
  firstName: " Ravi ",
  lastName: "",
  email: " ravi@example.com ",
  phone: "+91 98765 43210",
  password: "Str0ng!Pass",
  identityType: "national_id",
  identityNumber: " ID1 ",
  vehicleId: "1",
  type: "freelance",
}

describe("RiderForm (create)", () => {
  it("has no Zone field, and asks for square photo, identity images and optional extra images", () => {
    render(<RiderForm lookups={lookups} submitLabel="Register" onSubmit={async () => {}} />)
    expect(screen.queryByLabelText(/zone/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Profile photo \(required, square\)/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Identity images \(up to 5, square\)/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Additional documents \(optional, up to 5, square\)/)).toBeInTheDocument()
    for (const label of [/Profile photo/, /Identity images/, /Additional documents/]) {
      const accept = (screen.getByLabelText(label) as HTMLInputElement).accept
      expect(accept).toContain("image/jpeg")
      expect(accept).not.toContain("pdf")
    }
  })

  it("keeps the other registration fields", () => {
    render(<RiderForm lookups={lookups} submitLabel="Register" onSubmit={async () => {}} />)
    for (const label of ["First name", "Last name", "Email", "Phone", "Password", "Delivery type", "Vehicle", "Identity type", "Identity number"]) {
      expect(screen.getByLabelText(label), label).toBeInTheDocument()
    }
  })

  it("blocks submitting when the restaurant has no zone", () => {
    render(<RiderForm lookups={{ ...lookups, zone: null }} submitLabel="Register" onSubmit={async () => {}} />)
    expect(screen.getByRole("button", { name: "Register" })).toBeDisabled()
  })
})

describe("form bodies", () => {
  const photo = new File(["p"], "p.jpg", { type: "image/jpeg" })
  const files: RiderFiles = {
    photo,
    identity: [new File(["1"], "1.jpg", { type: "image/jpeg" }), new File(["2"], "2.jpg", { type: "image/jpeg" })],
    extra: [new File(["3"], "3.jpg", { type: "image/jpeg" })],
  }

  it("never sends a zone or a seller", () => {
    const form = toCreateForm(values, files)
    expect([...form.keys()].filter((key) => /zone|seller/i.test(key))).toEqual([])
    expect(Object.keys(toUpdateFields(values)).filter((key) => /zone|seller/i.test(key))).toEqual([])
  })

  it("sends the trimmed fields and every image under the names the API expects", () => {
    const form = toCreateForm(values, files)
    expect(form.get("first_name")).toBe("Ravi")
    expect(form.get("email")).toBe("ravi@example.com")
    expect(form.get("identity_document_number")).toBe("ID1")
    expect(form.get("delivery_man_type")).toBe("freelance")
    expect(form.get("last_name")).toBeNull()
    expect(form.get("profile_photo")).toBeInstanceOf(File)
    expect(form.getAll("identity_documents")).toHaveLength(2)
    expect(form.getAll("additional_documents")).toHaveLength(1)
  })
})
