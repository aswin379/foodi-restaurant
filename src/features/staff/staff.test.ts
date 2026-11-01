import { describe, expect, it } from "vitest"

import { dashboardNavigation } from "@/components/dashboard/navigation"
import type { SellerUser } from "@/features/auth/types"

import { canSeeArea, permissionFor } from "./access"
import {
  CUSTOM_DESIGNATION,
  fieldErrorsFrom,
  toCreateInput,
  validateStaff,
  type StaffFormValues,
} from "./validation"

const valid: StaffFormValues = {
  name: "Asha Nair",
  email: "asha@example.com",
  mobile: "",
  password: "long-enough-password",
  sellerId: "",
  designation: "3",
  customDesignation: "",
  rolePreset: "custom",
  permissions: ["orders"],
}

const user = (over: Partial<SellerUser>): SellerUser => ({
  id: 1,
  role: "owner",
  firstName: "A",
  lastName: "B",
  email: "a@example.com",
  restaurant: { id: 1, name: "R" },
  restaurants: [{ id: 1, name: "R", status: "APPROVED" }],
  ...over,
})

describe("validateStaff", () => {
  it("accepts a complete registration", () => {
    expect(validateStaff(valid, "create", false)).toEqual({})
  })

  it("requires the restaurant only when the owner must choose", () => {
    expect(validateStaff(valid, "create", true).sellerId).toBeDefined()
    expect(validateStaff({ ...valid, sellerId: "7" }, "create", true).sellerId).toBeUndefined()
  })

  it("checks name, email, password, mobile and designation", () => {
    const errors = validateStaff(
      { ...valid, name: "A", email: "nope", password: "short", mobile: "12", designation: "" },
      "create",
      false
    )
    expect(Object.keys(errors).sort()).toEqual(["designation", "email", "mobile", "name", "password"])
  })

  it("needs text for a custom designation, and ignores email and password when editing", () => {
    expect(validateStaff({ ...valid, designation: CUSTOM_DESIGNATION }, "edit", false).customDesignation).toBeDefined()
    expect(validateStaff({ ...valid, email: "", password: "" }, "edit", false)).toEqual({})
  })
})

describe("toCreateInput", () => {
  it("sends either a designation id or a custom one, never both", () => {
    const byId = toCreateInput(valid)
    expect(byId.designationId).toBe(3)
    expect(byId.customDesignation).toBeUndefined()
    const custom = toCreateInput({ ...valid, designation: CUSTOM_DESIGNATION, customDesignation: " Barista " })
    expect(custom.customDesignation).toBe("Barista")
    expect(custom.designationId).toBeUndefined()
  })

  it("omits an empty mobile and an unchosen restaurant", () => {
    const input = toCreateInput(valid)
    expect("mobile" in input).toBe(false)
    expect("sellerId" in input).toBe(false)
    expect(toCreateInput({ ...valid, sellerId: "9" }).sellerId).toBe(9)
  })
})

describe("fieldErrorsFrom", () => {
  it("maps server details onto form fields", () => {
    expect(fieldErrorsFrom([{ path: "designationId", message: "Choose a designation" }, { path: "email", message: "Taken" }])).toEqual({
      designation: "Choose a designation",
      email: "Taken",
    })
    expect(fieldErrorsFrom(undefined)).toEqual({})
  })
})

describe("canSeeArea", () => {
  it("shows owners everything", () => {
    expect(canSeeArea(user({}), "/wallet")).toBe(true)
  })

  const links = dashboardNavigation.flatMap((group) => group.items).filter((item) => item.href !== "/staff")
  const staffWith = (permissions: string[]) => user({ role: "staff", permissions })
  const needed = (item: (typeof links)[number]) => permissionFor(item.href, item.title) as string

  it("maps every sidebar link (Soon placeholders included) to its own permission", () => {
    for (const item of links) expect(permissionFor(item.href, item.title), item.title).toBeDefined()
    expect(new Set(links.map(needed)).size).toBe(links.length)
  })

  it("shows each link only with its own permission", () => {
    for (const item of links) {
      expect(canSeeArea(staffWith([needed(item)]), item.href, item.title), `allowed ${item.title}`).toBe(true)
      expect(canSeeArea(staffWith([]), item.href, item.title), `denied ${item.title}`).toBe(false)
      const others = links.filter((o) => o !== item).map(needed)
      expect(canSeeArea(staffWith(others), item.href, item.title), `others ${item.title}`).toBe(false)
    }
  })

  it("uses the most specific page: Categories needs its own permission, not Menu's", () => {
    expect(canSeeArea(staffWith(["menu"]), "/menu")).toBe(true)
    expect(canSeeArea(staffWith(["menu"]), "/menu/items/5")).toBe(true)
    expect(canSeeArea(staffWith(["menu"]), "/menu/categories")).toBe(false)
    expect(canSeeArea(staffWith(["profile"]), "/settings")).toBe(false)
  })

  it("uses one permission per module: no view/manage/prepare variants exist", () => {
    for (const item of links) expect(needed(item), item.title).not.toContain(".")
  })

  it("keeps Staff & roles and unknown pages owner-only, whatever the permissions", () => {
    const all = staffWith(links.map(needed))
    expect(canSeeArea(all, "/staff")).toBe(false)
    expect(canSeeArea(all, "/restaurants")).toBe(false)
  })

  it("never derives access from a designation", () => {
    expect(canSeeArea(user({ role: "staff", designation: "Accountant", permissions: [] }), "/reports")).toBe(false)
  })
})
