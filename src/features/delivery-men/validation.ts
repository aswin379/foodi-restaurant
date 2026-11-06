import type { DeliveryManType, IdentityType } from "./types"

// Mirrors the admin form and the server's rules (delivery-men.validation.ts); the server is the authority.
export const MAX_FILE_BYTES = 2 * 1024 * 1024
export const MAX_IDENTITY_FILES = 5
export const MAX_EXTRA_FILES = 5
// Identity images and additional documents are images only: each is cropped to a square before upload, so what is
// sent is always a JPEG. PDFs cannot be square and are not accepted.
export const DOCUMENT_TYPES = ["image/jpeg", "image/png"]
/** What the seller may pick; the crop step turns it into a square JPEG. Admin accepts the same source types. */
export const IMAGE_SOURCE_TYPES = ["image/jpeg", "image/png", "image/webp"]
export const MAX_SOURCE_BYTES = 5 * 1024 * 1024
export const IMAGE_ONLY_MESSAGE = "Each file must be a JPG or PNG image of 2 MB or smaller."

/** The message for a picked file that cannot be cropped, or null when it can. */
export function checkSourceImage(file: File): string | null {
  if (!IMAGE_SOURCE_TYPES.includes(file.type)) return "Choose a JPG, PNG or WebP image."
  if (file.size > MAX_SOURCE_BYTES) return "Choose an image of 5 MB or smaller."
  return null
}

export type RiderValues = {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  identityType: IdentityType
  identityNumber: string
  vehicleId: string
  type: DeliveryManType
}

export type RiderFiles = { photo: File | null; identity: File[]; extra: File[] }
export type RiderErrors = Partial<Record<keyof RiderValues | "photo" | "identity" | "extra", string>>

export const PASSWORD_HINT = "Min 8 characters with upper & lower case, a number and a symbol; no spaces"

export function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    password.length <= 128 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9\s]/.test(password) &&
    !/\s/.test(password)
  )
}

function badFile(files: File[]): boolean {
  return files.some((file) => file.size > MAX_FILE_BYTES || !DOCUMENT_TYPES.includes(file.type))
}

/** `mode` "edit" skips the photo and files, which are managed on their own, and makes the password optional. */
export function validateRider(values: RiderValues, files: RiderFiles, mode: "create" | "edit"): RiderErrors {
  const errors: RiderErrors = {}
  if (!values.firstName.trim()) errors.firstName = "First name is required."
  if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) errors.email = "Enter a valid email address."
  if (!/^[0-9\s\-+()]{9,20}$/.test(values.phone.trim())) errors.phone = "Enter a valid phone number (9–20 digits)."
  if ((mode === "create" || values.password) && !isStrongPassword(values.password)) errors.password = PASSWORD_HINT
  if (!values.identityNumber.trim()) errors.identityNumber = "Identity number is required."
  else if (values.identityNumber.trim().length > 30) errors.identityNumber = "Use at most 30 characters."
  if (!values.vehicleId) errors.vehicleId = "Select a vehicle."
  if (mode === "create") {
    if (!files.photo) errors.photo = "Profile photo is required."
    else if (files.photo.size > MAX_FILE_BYTES) errors.photo = "Photo must be 2 MB or smaller."
    if (files.identity.length > MAX_IDENTITY_FILES) errors.identity = `Upload at most ${MAX_IDENTITY_FILES} files.`
    else if (badFile(files.identity)) errors.identity = IMAGE_ONLY_MESSAGE
    if (files.extra.length > MAX_EXTRA_FILES) errors.extra = `Upload at most ${MAX_EXTRA_FILES} files.`
    else if (badFile(files.extra)) errors.extra = IMAGE_ONLY_MESSAGE
  }
  return errors
}
