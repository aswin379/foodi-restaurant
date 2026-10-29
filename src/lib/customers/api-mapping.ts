import { ServiceError } from "@/lib/data-source/errors"
import { DELIVERY_MODES, ORDER_TYPES } from "@/lib/domain/order-types"
import { ORDER_STATUSES, PAYMENT_STATUSES, type Money } from "@/lib/orders/types"

import {
  CUSTOMER_SORTS,
  type Customer,
  type CustomerDetail,
  type CustomerListResult,
  type CustomerOrdersResult,
  type CustomerOrderSummary,
  type CustomerSort,
  type PageInfo,
} from "./types"

// Converts customers between the PROPOSED API shape (docs/customers-ui.md)
// and the frontend model. Anything unexpected is an integration error that
// fails visibly. Only the fields named below are read, so a raw `phone`,
// `email` or address that an API sends alongside a customer can never reach
// the screen (C6). The masked fields must also look masked: a value that
// could be a raw phone number or email address is refused, not displayed, and
// no error ever repeats a value. This is a presentation safeguard, not
// authorization: the backend must enforce ownership and masking (C7).

type Raw = Record<string, unknown>
const isRecord = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value)
const invalid = (what: string) => new ServiceError("unavailable", `Invalid customer data from API: ${what}`)

const ID_PATTERN = /^[\w-]{1,100}$/
const MAX_NAME_LENGTH = 80
const MAX_MASKED_LENGTH = 60
const MAX_REFERENCE_LENGTH = 40
const MASK_PATTERN = /[•*]/
const absent = (value: unknown) => value === null || value === undefined

function id(value: unknown, what: string): string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) throw invalid(what)
  return value
}

function nonEmptyString(value: unknown, what: string, max: number): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) throw invalid(what)
  return value
}

function instant(value: unknown, what: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw invalid(what)
  return value
}

function integer(value: unknown, what: string, min: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) throw invalid(what)
  return value
}

function oneOf<Value extends string>(value: unknown, allowed: readonly Value[], what: string): Value {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) throw invalid(`unknown ${what}`)
  return value as Value
}

function money(value: unknown, what: string, currency: string): Money {
  if (!isRecord(value)) throw invalid(what)
  const amountMinor = integer(value.amountMinor, `${what} amount`, 0)
  // C5: the restaurant's configured currency only; another currency is not converted or shown.
  if (value.currency !== currency) throw invalid(`${what} currency`)
  return { amountMinor, currency }
}

/** A name is a display name only; one that looks like an email address or phone number is refused. */
function displayName(value: unknown): string | null {
  if (absent(value)) return null
  const name = nonEmptyString(value, "customer name", MAX_NAME_LENGTH)
  if (name.includes("@") || (name.match(/\d/g) ?? []).length >= 7) throw invalid("customer name")
  return name
}

/** C6: must carry a mask and at most four visible digits. */
function maskedPhone(value: unknown): string | null {
  if (absent(value)) return null
  const phone = nonEmptyString(value, "masked phone", MAX_MASKED_LENGTH)
  if (!MASK_PATTERN.test(phone) || (phone.match(/\d/g) ?? []).length > 4) throw invalid("masked phone")
  return phone
}

/** C6: must carry a mask. */
function maskedEmail(value: unknown): string | null {
  if (absent(value)) return null
  const email = nonEmptyString(value, "masked email", MAX_MASKED_LENGTH)
  if (!MASK_PATTERN.test(email)) throw invalid("masked email")
  return email
}

/** C9: a missing metric stays null. It is never zero, never computed. */
function optional<Value>(value: unknown, read: (value: unknown) => Value): Value | null {
  return absent(value) ? null : read(value)
}

export function customerFromApi(value: unknown, expected: { currency: string }): Customer {
  if (!isRecord(value)) throw invalid("customer")
  return {
    id: id(value.id, "customer id"),
    displayName: displayName(value.displayName),
    phoneMasked: maskedPhone(value.phoneMasked),
    emailMasked: maskedEmail(value.emailMasked),
    orderCount: optional(value.orderCount, (count) => integer(count, "order count", 0)),
    lifetimeSpend: optional(value.lifetimeSpend, (spend) => money(spend, "lifetime spend", expected.currency)),
    lastOrderAt: optional(value.lastOrderAt, (at) => instant(at, "last order date")),
  }
}

export function customerDetailFromApi(value: unknown, expected: { currency: string }): CustomerDetail {
  const customer = customerFromApi(value, expected)
  return { ...customer, firstOrderAt: optional((value as Raw).firstOrderAt, (at) => instant(at, "first order date")) }
}

function pageInfoFromApi(value: Raw, itemCount: number): PageInfo {
  const page = integer(value.page, "page", 1)
  const pageSize = integer(value.pageSize, "page size", 1)
  const totalItems = optional(value.totalItems, (total) => integer(total, "total items", 0))
  const totalPages = optional(value.totalPages, (total) => integer(total, "total pages", 1))
  if (typeof value.hasNextPage !== "boolean") throw invalid("next page flag")
  if (itemCount > pageSize) throw invalid("page size")
  // Totals, when given, must agree with each other and with the next-page flag.
  if (totalItems !== null && totalPages !== null && totalPages !== Math.max(1, Math.ceil(totalItems / pageSize))) {
    throw invalid("totals")
  }
  if (totalPages !== null && value.hasNextPage !== page < totalPages) throw invalid("next page flag")
  return { page, pageSize, totalItems, totalPages, hasNextPage: value.hasNextPage }
}

function itemsOf(value: unknown): unknown[] {
  if (!isRecord(value) || !Array.isArray(value.items)) throw invalid("list")
  return value.items
}

function supportedSortsFromApi(value: unknown): CustomerSort[] {
  if (absent(value)) return []
  if (!Array.isArray(value)) throw invalid("supported sorts")
  return value.map((sort) => oneOf(sort, CUSTOMER_SORTS, "sort"))
}

export function customerListFromApi(value: unknown, expected: { currency: string }): CustomerListResult {
  const items = itemsOf(value).map((item) => customerFromApi(item, expected))
  const raw = value as Raw
  return { items, ...pageInfoFromApi(raw, items.length), supportedSorts: supportedSortsFromApi(raw.supportedSorts) }
}

function orderFromApi(value: unknown, currency: string): CustomerOrderSummary {
  if (!isRecord(value)) throw invalid("order")
  const orderType = oneOf(value.orderType, ORDER_TYPES, "order type")
  const deliveryMode = optional(value.deliveryMode, (mode) => oneOf(mode, DELIVERY_MODES, "delivery mode"))
  if ((orderType === "delivery") !== (deliveryMode !== null)) throw invalid("delivery mode")
  return {
    id: id(value.id, "order id"),
    reference: nonEmptyString(value.reference, "order reference", MAX_REFERENCE_LENGTH),
    placedAt: instant(value.placedAt, "order date"),
    status: oneOf(value.status, ORDER_STATUSES, "order status"),
    paymentStatus: oneOf(value.paymentStatus, PAYMENT_STATUSES, "payment status"),
    orderType,
    deliveryMode,
    itemCount: integer(value.itemCount, "item count", 0),
    total: money(value.total, "order total", currency),
  }
}

export function customerOrdersFromApi(value: unknown, expected: { currency: string }): CustomerOrdersResult {
  const items = itemsOf(value).map((item) => orderFromApi(item, expected.currency))
  return { items, ...pageInfoFromApi(value as Raw, items.length) }
}
