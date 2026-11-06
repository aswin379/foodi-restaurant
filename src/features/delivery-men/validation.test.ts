import { describe, expect, it } from "vitest"

import { checkSourceImage, isStrongPassword, validateRider, type RiderFiles, type RiderValues } from "./validation"

const values: RiderValues = {
  firstName: "Ravi",
  lastName: "",
  email: "ravi@example.com",
  phone: "+91 98765 43210",
  password: "Str0ng!Pass",
  identityType: "national_id",
  identityNumber: "ID12345",
  vehicleId: "1",
  type: "freelance",
}
const photo = new File(["x"], "p.jpg", { type: "image/jpeg" })
const files: RiderFiles = { photo, identity: [], extra: [] }

describe("rider validation (mirrors admin)", () => {
  it("accepts a complete registration", () => {
    expect(validateRider(values, files, "create")).toEqual({})
  })

  it("requires the photo, vehicle, identity number and a strong password on create", () => {
    const errors = validateRider(
      { ...values, password: "weak", identityNumber: "", vehicleId: "" },
      { photo: null, identity: [], extra: [] },
      "create"
    )
    expect(Object.keys(errors).sort()).toEqual(["identityNumber", "password", "photo", "vehicleId"])
  })

  it("rejects passwords with spaces or no symbol", () => {
    expect(isStrongPassword("Str0ng!Pass")).toBe(true)
    expect(isStrongPassword("Str0ng Pass!")).toBe(false)
    expect(isStrongPassword("Str0ngPass")).toBe(false)
  })

  it("limits documents to 5 images of JPG/PNG up to 2 MB, and refuses PDFs", () => {
    const image = new File(["x"], "a.jpg", { type: "image/jpeg" })
    const pdf = new File(["x"], "a.pdf", { type: "application/pdf" })
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "b.jpg", { type: "image/jpeg" })
    expect(validateRider(values, { photo, identity: Array(5).fill(image), extra: Array(5).fill(image) }, "create")).toEqual({})
    expect(validateRider(values, { photo, identity: Array(6).fill(image), extra: [] }, "create").identity).toBeDefined()
    expect(validateRider(values, { photo, identity: [big], extra: [] }, "create").identity).toBeDefined()
    expect(validateRider(values, { photo, identity: [pdf], extra: [] }, "create").identity).toMatch(/JPG or PNG image/)
    expect(validateRider(values, { photo, identity: [], extra: [pdf] }, "create").extra).toMatch(/JPG or PNG image/)
    expect(validateRider(values, { photo, identity: [], extra: [new File(["x"], "c.gif", { type: "image/gif" })] }, "create").extra).toBeDefined()
  })

  it("accepts only JPG, PNG or WebP images of 5 MB or smaller to crop", () => {
    expect(checkSourceImage(new File(["x"], "a.webp", { type: "image/webp" }))).toBeNull()
    expect(checkSourceImage(new File(["x"], "a.pdf", { type: "application/pdf" }))).not.toBeNull()
    expect(checkSourceImage(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "b.png", { type: "image/png" }))).not.toBeNull()
  })

  it("makes the password optional when editing", () => {
    expect(validateRider({ ...values, password: "" }, { photo: null, identity: [], extra: [] }, "edit")).toEqual({})
  })
})
