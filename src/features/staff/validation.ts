import type { CreateStaffInput, StaffInput } from "./types"

// Mirrors the server's rules (seller-staff.validation.ts); the server is the authority.
export const PASSWORD_MIN = 10
export const CUSTOM_DESIGNATION = "custom"

export type StaffFormValues = {
  name: string
  email: string
  mobile: string
  password: string
  sellerId: string
  /** A designation id as text, or CUSTOM_DESIGNATION to type a new title. */
  designation: string
  customDesignation: string
  rolePreset: string
  permissions: string[]
}

export type FieldErrors = Partial<Record<keyof StaffFormValues, string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MOBILE = /^\+?[0-9]{7,15}$/

export function validateStaff(values: StaffFormValues, mode: "create" | "edit", needsRestaurant: boolean): FieldErrors {
  const errors: FieldErrors = {}
  if (values.name.trim().length < 2) errors.name = "Enter the full name."
  if (mode === "create") {
    if (!EMAIL.test(values.email.trim())) errors.email = "Enter a valid email address."
    if (values.password.length < PASSWORD_MIN) errors.password = `Use at least ${PASSWORD_MIN} characters.`
    if (needsRestaurant && !values.sellerId) errors.sellerId = "Select a restaurant."
  }
  if (values.mobile.trim() && !MOBILE.test(values.mobile.replace(/[\s-]/g, ""))) {
    errors.mobile = "Enter a valid mobile number."
  }
  if (!values.designation) errors.designation = "Select a designation."
  else if (values.designation === CUSTOM_DESIGNATION && values.customDesignation.trim().length < 2) {
    errors.customDesignation = "Enter the designation."
  }
  return errors
}

function designationFields(values: StaffFormValues): Pick<StaffInput, "designationId" | "customDesignation"> {
  return values.designation === CUSTOM_DESIGNATION
    ? { customDesignation: values.customDesignation.trim() }
    : { designationId: Number(values.designation) }
}

export function toEditInput(values: StaffFormValues): StaffInput {
  return {
    name: values.name.trim(),
    mobile: values.mobile.trim() ? values.mobile.trim() : null,
    rolePreset: values.rolePreset,
    permissions: values.permissions,
    ...designationFields(values),
  }
}

export function toCreateInput(values: StaffFormValues): CreateStaffInput {
  const { name, rolePreset, permissions, designationId, customDesignation } = toEditInput(values)
  return {
    name,
    rolePreset,
    permissions,
    ...(designationId !== undefined ? { designationId } : {}),
    ...(customDesignation !== undefined ? { customDesignation } : {}),
    ...(values.mobile.trim() ? { mobile: values.mobile.trim() } : {}),
    email: values.email.trim(),
    password: values.password,
    ...(values.sellerId ? { sellerId: Number(values.sellerId) } : {}),
  }
}

/** Server validation details ({path, message}[]) as field errors. */
export function fieldErrorsFrom(details: unknown): FieldErrors {
  const errors: FieldErrors = {}
  if (!Array.isArray(details)) return errors
  for (const item of details as Array<{ path?: string; message?: string }>) {
    if (!item.path || !item.message) continue
    const key = item.path === "designationId" ? "designation" : item.path
    if (!(key in errors)) (errors as Record<string, string>)[key] = item.message
  }
  return errors
}
