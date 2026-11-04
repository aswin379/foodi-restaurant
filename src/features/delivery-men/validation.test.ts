import { describe, expect, it } from "vitest"

import { isStrongPassword, validateRider, type RiderFiles, type RiderValues } from "./validation"

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

  it("limits documents to 5 files of JPG/PNG/PDF up to 2 MB", () => {
    const pdf = new File(["x"], "a.pdf", { type: "application/pdf" })
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "b.jpg", { type: "image/jpeg" })
    expect(validateRider(values, { photo, identity: Array(6).fill(pdf), extra: [] }, "create").identity).toBeDefined()
    expect(validateRider(values, { photo, identity: [big], extra: [] }, "create").identity).toBeDefined()
    expect(validateRider(values, { photo, identity: [], extra: [new File(["x"], "c.gif", { type: "image/gif" })] }, "create").extra).toBeDefined()
  })

  it("makes the password optional when editing", () => {
    expect(validateRider({ ...values, password: "" }, { photo: null, identity: [], extra: [] }, "edit")).toEqual({})
  })
})
