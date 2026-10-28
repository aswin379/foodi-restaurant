import { ORDER_TYPES, orderTypeLabels, type OrderType } from "@/lib/domain/order-types"
import { imageDataUrlBytes, priceError, toMinor, toPriceInput, type ImageChange } from "@/lib/menu/validation"
import { PREP_TIME_MAX, PREP_TIME_MIN } from "@/lib/orders/commands"

import type { OrderSettings, RestaurantProfile } from "./types"

// Profile and order-settings form rules (B4a). The same functions run in the
// browser and in the Server Actions, so both report the same errors. Errors
// are keyed by field path; the forms turn a path into a field id with
// settingsFieldId(). Limits marked provisional in docs/settings-ui.md are not
// PRD rules.

export type FieldErrors = Record<string, string>
export const hasErrors = (errors: FieldErrors) => Object.keys(errors).length > 0

/** DOM id for a field path, e.g. "address.city" → "settings-address-city". */
export const settingsFieldId = (path: string) => `settings-${path.replaceAll(".", "-")}`

export const NAME_MAX = 80
export const DESCRIPTION_MAX = 500
export const ADDRESS_FIELD_MAX = 120
export const POSTAL_CODE_MAX = 12
export const EMAIL_MAX = 254

/**
 * Byte budgets for the compressed logo and cover (B4a hardening). The profile
 * save carries both inline, base64-encoded (4/3 larger), in one Server Action
 * request, which Next caps at 1 MB by default. 300 KB + 400 KB encodes to
 * about 933 KB, leaving room for the text fields; a unit test checks the
 * worst case. Menu images keep their own 700 KB budget (one image per save).
 * PROVISIONAL until the backend has an upload endpoint (docs/settings-ui.md).
 */
export const LOGO_MAX_BYTES = 300 * 1024
export const COVER_MAX_BYTES = 400 * 1024
/** Next's default Server Action body limit; profile saves must stay under it. */
export const SERVER_ACTION_BODY_LIMIT = 1024 * 1024

export type ProfileDraft = {
  name: string
  description: string
  phone: string
  email: string
  line1: string
  line2: string
  city: string
  region: string
  postalCode: string
  latitude: string
  longitude: string
  logo: ImageChange
  cover: ImageChange
}

export type OrderSettingsDraft = {
  orderTypes: Record<OrderType, { enabled: boolean; defaultPrepMinutes: string }>
  minimumOrder: string
  pickupCodeRequired: boolean
}

// ----- Drafts from saved values -------------------------------------------------

export function profileDraftFrom(profile: RestaurantProfile): ProfileDraft {
  return {
    name: profile.name,
    description: profile.description ?? "",
    phone: profile.contact.phone ?? "",
    email: profile.contact.email ?? "",
    line1: profile.address.line1,
    line2: profile.address.line2 ?? "",
    city: profile.address.city,
    region: profile.address.region ?? "",
    postalCode: profile.address.postalCode,
    latitude: profile.location ? String(profile.location.latitude) : "",
    longitude: profile.location ? String(profile.location.longitude) : "",
    logo: { kind: "keep" },
    cover: { kind: "keep" },
  }
}

export function orderSettingsDraftFrom(settings: OrderSettings): OrderSettingsDraft {
  return {
    orderTypes: Object.fromEntries(
      ORDER_TYPES.map((type) => [
        type,
        { enabled: settings.orderTypes[type].enabled, defaultPrepMinutes: String(settings.orderTypes[type].defaultPrepMinutes) },
      ])
    ) as OrderSettingsDraft["orderTypes"],
    minimumOrder: settings.minimumOrder ? toPriceInput(settings.minimumOrder.amountMinor) : "",
    pickupCodeRequired: settings.pickupCodeRequired,
  }
}

// ----- Validation --------------------------------------------------------------

const PHONE_PATTERN = /^\+?[\d\s()-]+$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const COORDINATE_PATTERN = /^-?\d{1,3}(\.\d{1,6})?$/

function required(errors: FieldErrors, path: string, value: string, label: string, max: number) {
  const trimmed = value.trim()
  if (!trimmed) errors[path] = `Enter the ${label}.`
  else if (trimmed.length > max) errors[path] = `Keep the ${label} under ${max} characters.`
}

function optional(errors: FieldErrors, path: string, value: string, label: string, max: number) {
  if (value.trim().length > max) errors[path] = `Keep the ${label} under ${max} characters.`
}

function imageError(change: ImageChange, maxBytes: number) {
  if (change.kind !== "replace") return undefined
  const bytes = imageDataUrlBytes(change.dataUrl)
  if (bytes === null) return "Choose a JPG, PNG or WebP image."
  if (bytes > maxBytes) return "This image is too large after compression. Try a smaller or less detailed one."
  return undefined
}

function coordinate(value: string, limit: number) {
  const trimmed = value.trim()
  if (!COORDINATE_PATTERN.test(trimmed)) return null
  const number = Number(trimmed)
  return Math.abs(number) <= limit ? number : null
}

export function validateProfileDraft(draft: ProfileDraft): FieldErrors {
  const errors: FieldErrors = {}
  required(errors, "name", draft.name, "restaurant name", NAME_MAX)
  optional(errors, "description", draft.description, "description", DESCRIPTION_MAX)

  const phone = draft.phone.trim()
  if (phone) {
    const digits = phone.replace(/\D/g, "").length
    if (!PHONE_PATTERN.test(phone) || digits < 7 || digits > 15) {
      errors.phone = "Enter a phone number with 7 to 15 digits, like +91 98765 43210."
    }
  }
  const email = draft.email.trim()
  if (email && (email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email))) errors.email = "Enter an email address, like name@example.com."

  required(errors, "address.line1", draft.line1, "address", ADDRESS_FIELD_MAX)
  optional(errors, "address.line2", draft.line2, "second address line", ADDRESS_FIELD_MAX)
  required(errors, "address.city", draft.city, "city", ADDRESS_FIELD_MAX)
  optional(errors, "address.region", draft.region, "state or region", ADDRESS_FIELD_MAX)
  required(errors, "address.postalCode", draft.postalCode, "postal code", POSTAL_CODE_MAX)

  // D3: coordinates are optional, but come as a pair.
  const latitude = draft.latitude.trim()
  const longitude = draft.longitude.trim()
  if (latitude || longitude) {
    if (!latitude) errors["location.latitude"] = "Enter the latitude too, or clear both."
    else if (coordinate(latitude, 90) === null) errors["location.latitude"] = "Enter a latitude between -90 and 90, with up to 6 decimals."
    if (!longitude) errors["location.longitude"] = "Enter the longitude too, or clear both."
    else if (coordinate(longitude, 180) === null) {
      errors["location.longitude"] = "Enter a longitude between -180 and 180, with up to 6 decimals."
    }
  }

  const logo = imageError(draft.logo, LOGO_MAX_BYTES)
  if (logo) errors.logo = logo
  const cover = imageError(draft.cover, COVER_MAX_BYTES)
  if (cover) errors.cover = cover
  return errors
}

export const orderSettingsPaths = {
  orderTypes: "orderTypes",
  prep: (type: OrderType) => `orderTypes.${type}.defaultPrepMinutes`,
  minimumOrder: "minimumOrder",
}

export function validateOrderSettingsDraft(draft: OrderSettingsDraft): FieldErrors {
  const errors: FieldErrors = {}
  if (ORDER_TYPES.every((type) => !draft.orderTypes[type].enabled)) {
    errors[orderSettingsPaths.orderTypes] =
      "Keep at least one order type on. To stop orders for a while, pause them in Availability & hours."
  }
  for (const type of ORDER_TYPES) {
    const value = draft.orderTypes[type].defaultPrepMinutes.trim()
    const minutes = /^\d{1,3}$/.test(value) ? Number(value) : null
    if (minutes === null || minutes < PREP_TIME_MIN || minutes > PREP_TIME_MAX) {
      errors[orderSettingsPaths.prep(type)] =
        `Enter a ${orderTypeLabels[type].toLowerCase()} prep time from ${PREP_TIME_MIN} to ${PREP_TIME_MAX} minutes.`
    }
  }
  // Blank means no minimum; an entered amount must be above zero (B4a hardening).
  if (draft.minimumOrder.trim()) {
    const problem = priceError(draft.minimumOrder, "the minimum order")
    if (problem) errors[orderSettingsPaths.minimumOrder] = problem
    else if (toMinor(draft.minimumOrder) === 0) {
      errors[orderSettingsPaths.minimumOrder] = "Enter an amount above 0, or leave it blank for no minimum."
    }
  }
  return errors
}

// ----- Saving (used by the preview rules; the backend does its own) ----------------

export function orderSettingsFromDraft(draft: OrderSettingsDraft, currency: string): Pick<OrderSettings, "orderTypes" | "minimumOrder" | "pickupCodeRequired"> {
  return {
    orderTypes: Object.fromEntries(
      ORDER_TYPES.map((type) => [type, { enabled: draft.orderTypes[type].enabled, defaultPrepMinutes: Number(draft.orderTypes[type].defaultPrepMinutes.trim()) }])
    ) as OrderSettings["orderTypes"],
    minimumOrder: draft.minimumOrder.trim() ? { amountMinor: toMinor(draft.minimumOrder), currency } : null,
    pickupCodeRequired: draft.pickupCodeRequired,
  }
}

const orNull = (value: string) => value.trim() || null

export function profileFieldsFromDraft(draft: ProfileDraft): Pick<RestaurantProfile, "name" | "description" | "contact" | "address" | "location"> {
  return {
    name: draft.name.trim(),
    description: orNull(draft.description),
    contact: { phone: orNull(draft.phone), email: orNull(draft.email) },
    address: {
      line1: draft.line1.trim(),
      line2: orNull(draft.line2),
      city: draft.city.trim(),
      region: orNull(draft.region),
      postalCode: draft.postalCode.trim(),
    },
    location: draft.latitude.trim() ? { latitude: Number(draft.latitude.trim()), longitude: Number(draft.longitude.trim()) } : null,
  }
}

/** Order types turned off by a draft compared with the saved settings (D6: these get a warning). */
export function turnedOff(saved: OrderSettings, draft: OrderSettingsDraft): OrderType[] {
  return ORDER_TYPES.filter((type) => saved.orderTypes[type].enabled && !draft.orderTypes[type].enabled)
}

// ----- Untrusted input ----------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "")

function imageChange(value: unknown): ImageChange {
  if (!isRecord(value)) return { kind: "keep" }
  if (value.kind === "remove") return { kind: "remove" }
  if (value.kind === "replace") return { kind: "replace", dataUrl: text(value.dataUrl, 1_000_000) }
  return { kind: "keep" }
}

/** Builds a well-typed profile draft from untrusted input; validate afterwards. */
export function profileDraftFromInput(value: unknown): ProfileDraft {
  const raw = isRecord(value) ? value : {}
  return {
    name: text(raw.name, 500),
    description: text(raw.description, 2000),
    phone: text(raw.phone, 100),
    email: text(raw.email, 500),
    line1: text(raw.line1, 500),
    line2: text(raw.line2, 500),
    city: text(raw.city, 500),
    region: text(raw.region, 500),
    postalCode: text(raw.postalCode, 100),
    latitude: text(raw.latitude, 30),
    longitude: text(raw.longitude, 30),
    logo: imageChange(raw.logo),
    cover: imageChange(raw.cover),
  }
}

/** Builds a well-typed order-settings draft from untrusted input; unknown order types are dropped. */
export function orderSettingsDraftFromInput(value: unknown): OrderSettingsDraft {
  const raw = isRecord(value) ? value : {}
  const rawTypes = isRecord(raw.orderTypes) ? raw.orderTypes : {}
  const orderTypes = {} as OrderSettingsDraft["orderTypes"]
  for (const type of ORDER_TYPES) {
    const entry = isRecord(rawTypes[type]) ? rawTypes[type] : {}
    orderTypes[type] = { enabled: entry.enabled === true, defaultPrepMinutes: text(entry.defaultPrepMinutes, 10) }
  }
  return { orderTypes, minimumOrder: text(raw.minimumOrder, 20), pickupCodeRequired: raw.pickupCodeRequired === true }
}
