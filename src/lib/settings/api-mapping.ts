import { fromApiOrderType, toApiOrderType } from "@/lib/api/mapping"
import { ServiceError } from "@/lib/data-source/errors"
import { ORDER_TYPES, type OrderType } from "@/lib/domain/order-types"

import type { SettingsCommand } from "./commands"
import type { SettingsCommandResult } from "./rules"
import type { OrderSettings, OrderTypeSetting, RestaurantProfile } from "./types"

// Converts settings between the PROPOSED API shape (docs/settings-ui.md) and
// the frontend model. Order types appear as record keys and go through
// src/lib/api/mapping.ts, the only place backend names may differ. Anything
// unexpected is an integration error, never guessed.

type Raw = Record<string, unknown>
const isRecord = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value)
const invalid = (what: string) => new ServiceError("unavailable", `Invalid settings data from API: ${what}`)

function string(value: unknown, what: string): string {
  if (typeof value !== "string") throw invalid(what)
  return value
}
const nullableString = (value: unknown, what: string) => (value === null || value === undefined ? null : string(value, what))
function number(value: unknown, what: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw invalid(what)
  return value
}

export function profileFromApi(value: unknown): RestaurantProfile {
  if (!isRecord(value) || !isRecord(value.contact) || !isRecord(value.address)) throw invalid("profile")
  const location = value.location === null || value.location === undefined ? null : value.location
  if (location !== null && !isRecord(location)) throw invalid("location")
  return {
    name: string(value.name, "name"),
    description: nullableString(value.description, "description"),
    contact: { phone: nullableString(value.contact.phone, "phone"), email: nullableString(value.contact.email, "email") },
    address: {
      line1: string(value.address.line1, "address line1"),
      line2: nullableString(value.address.line2, "address line2"),
      city: string(value.address.city, "city"),
      region: nullableString(value.address.region, "region"),
      postalCode: string(value.address.postalCode, "postal code"),
    },
    location: location && { latitude: number(location.latitude, "latitude"), longitude: number(location.longitude, "longitude") },
    logoUrl: nullableString(value.logoUrl, "logoUrl"),
    coverUrl: nullableString(value.coverUrl, "coverUrl"),
    timeZone: string(value.timeZone, "timeZone"),
    currency: string(value.currency, "currency"),
    locale: string(value.locale, "locale"),
    version: string(value.version, "version"),
    updatedAt: nullableString(value.updatedAt, "updatedAt"),
    updatedBy: nullableString(value.updatedBy, "updatedBy"),
  }
}

export function orderSettingsFromApi(value: unknown): OrderSettings {
  if (!isRecord(value) || !isRecord(value.orderTypes)) throw invalid("order settings")
  const orderTypes: Partial<Record<OrderType, OrderTypeSetting>> = {}
  for (const [key, raw] of Object.entries(value.orderTypes)) {
    if (!isRecord(raw) || typeof raw.enabled !== "boolean") throw invalid(`order type ${key}`)
    orderTypes[fromApiOrderType(key)] = { enabled: raw.enabled, defaultPrepMinutes: number(raw.defaultPrepMinutes, `${key} prep time`) }
  }
  const missing = ORDER_TYPES.filter((type) => !orderTypes[type])
  if (missing.length) throw invalid(`missing order types ${missing.join(", ")}`)
  const minimum = value.minimumOrder
  if (minimum !== null && minimum !== undefined && !isRecord(minimum)) throw invalid("minimumOrder")
  if (typeof value.pickupCodeRequired !== "boolean") throw invalid("pickupCodeRequired")
  return {
    orderTypes: orderTypes as OrderSettings["orderTypes"],
    minimumOrder: minimum ? { amountMinor: number(minimum.amountMinor, "minimumOrder amount"), currency: string(minimum.currency, "minimumOrder currency") } : null,
    pickupCodeRequired: value.pickupCodeRequired,
    version: string(value.version, "version"),
    updatedAt: nullableString(value.updatedAt, "updatedAt"),
    updatedBy: nullableString(value.updatedBy, "updatedBy"),
  }
}

/** A command's request body, with order types in API names. */
export function commandBodyToApi(command: SettingsCommand): unknown {
  if (command.type === "save_profile") return command.draft
  return {
    ...command.draft,
    orderTypes: Object.fromEntries(ORDER_TYPES.map((type) => [toApiOrderType(type), command.draft.orderTypes[type]])),
  }
}

export function commandResultFromApi(command: SettingsCommand, value: unknown): SettingsCommandResult {
  return command.type === "save_profile"
    ? { kind: "profile", profile: profileFromApi(value) }
    : { kind: "order_settings", orderSettings: orderSettingsFromApi(value) }
}
