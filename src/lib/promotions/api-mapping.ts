import { ServiceError } from "@/lib/data-source/errors"
import { ORDER_TYPES } from "@/lib/domain/order-types"

import {
  PROMOTION_COMPONENTS,
  PROMOTION_FUNDING,
  PROMOTION_KINDS,
  PROMOTION_MANAGERS,
  PROMOTION_STATUSES,
  type Money,
  type OrderType,
  type PageInfo,
  type Promotion,
  type PromotionComponent,
  type PromotionDiscount,
  type PromotionListResult,
} from "./types"

// Converts promotions between the PROPOSED API shape (docs/promotions-ui.md)
// and the frontend model. Anything unexpected is an integration error that
// fails visibly: an unknown kind, status, discount type, funding, manager,
// order type or component is never guessed; a malformed, fractional, negative,
// unsafe or wrong-currency amount is refused rather than coerced; a rate over
// 100 percent is refused; a discount that mixes the percentage and fixed forms
// is refused; and a missing value stays null, never a default. Only the fields
// named below are read, so customer, order or redemption-history data sent
// alongside a coupon can't reach a screen. Error messages name the problem and
// never repeat a value. This validates shape only: it computes no discount,
// infers no eligibility and checks no status against a date.

type Raw = Record<string, unknown>
const isRecord = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value)
const invalid = (what: string) => new ServiceError("unavailable", `Invalid promotion data from API: ${what}`)

const ID_PATTERN = /^[\w-]{1,100}$/
/** A code is shown as given: visible characters only, no whitespace or control characters. */
const CODE_PATTERN = /^[^\s\p{Cc}]{1,40}$/u
/** An ISO 8601 instant with a time and an explicit offset or Z. Date.parse alone accepts far looser text. */
const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/
const MAX_NAME_LENGTH = 80
/** 100 percent. */
const MAX_BASIS_POINTS = 10_000
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
  if (typeof value !== "string" || !INSTANT_PATTERN.test(value) || Number.isNaN(Date.parse(value))) throw invalid(what)
  return value
}

function integer(value: unknown, what: string, min: number, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw invalid(what)
  return value
}

function oneOf<Value extends string>(value: unknown, allowed: readonly Value[], what: string): Value {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) throw invalid(`unknown ${what}`)
  return value as Value
}

/** A coupon amount: non-negative integer minor units in the restaurant's currency. Nothing is converted. */
function money(value: unknown, what: string, currency: string): Money {
  if (!isRecord(value)) throw invalid(what)
  const amountMinor = integer(value.amountMinor, `${what} amount`, 0)
  if (value.currency !== currency) throw invalid(`${what} currency`)
  return { amountMinor, currency }
}

/** A missing value stays null. It is never a default, never computed. */
function optional<Value>(value: unknown, read: (value: unknown) => Value): Value | null {
  return absent(value) ? null : read(value)
}

/** A non-empty list of distinct allowed values, or null when the source doesn't say. */
function distinctList<Value extends string>(value: unknown, allowed: readonly Value[], what: string): Value[] | null {
  if (absent(value)) return null
  if (!Array.isArray(value) || value.length === 0) throw invalid(what)
  const items = value.map((item) => oneOf(item, allowed, what))
  if (new Set(items).size !== items.length) throw invalid(what)
  return items
}

function discountFromApi(value: unknown, currency: string): PromotionDiscount {
  if (!isRecord(value)) throw invalid("discount")
  const type = oneOf(value.type, ["percentage", "fixed_amount"] as const, "discount type")
  if (type === "percentage") {
    // A percentage carries a rate and, optionally, a cap. It never carries a fixed amount.
    if (!absent(value.amount)) throw invalid("discount value")
    return {
      type,
      rateBasisPoints: integer(value.rateBasisPoints, "discount rate", 0, MAX_BASIS_POINTS),
      maxDiscount: optional(value.maxDiscount, (cap) => money(cap, "maximum discount", currency)),
    }
  }
  // A fixed amount carries an amount and nothing else.
  if (!absent(value.rateBasisPoints) || !absent(value.maxDiscount)) throw invalid("discount value")
  return { type, amount: money(value.amount, "discount", currency) }
}

export function promotionFromApi(value: unknown, expected: { currency: string }): Promotion {
  if (!isRecord(value)) throw invalid("promotion")
  const startsAt = optional(value.startsAt, (at) => instant(at, "start date"))
  const endsAt = optional(value.endsAt, (at) => instant(at, "end date"))
  if (startsAt !== null && endsAt !== null && Date.parse(startsAt) > Date.parse(endsAt)) throw invalid("validity")
  const code = value.code
  if (typeof code !== "string" || !CODE_PATTERN.test(code)) throw invalid("code")
  return {
    id: id(value.id, "promotion id"),
    kind: oneOf(value.kind, PROMOTION_KINDS, "promotion kind"),
    code,
    name: optional(value.name, (name) => nonEmptyString(name, "name", MAX_NAME_LENGTH)),
    status: optional(value.status, (status) => oneOf(status, PROMOTION_STATUSES, "promotion status")),
    discount: discountFromApi(value.discount, expected.currency),
    minimumOrder: optional(value.minimumOrder, (amount) => money(amount, "minimum order", expected.currency)),
    startsAt,
    endsAt,
    orderTypes: distinctList<OrderType>(value.orderTypes, ORDER_TYPES, "order types"),
    appliesTo: distinctList<PromotionComponent>(value.appliesTo, PROMOTION_COMPONENTS, "applies-to list"),
    fundedBy: optional(value.fundedBy, (funding) => oneOf(funding, PROMOTION_FUNDING, "funding")),
    managedBy: optional(value.managedBy, (manager) => oneOf(manager, PROMOTION_MANAGERS, "manager")),
    stackable: optional(value.stackable, (stackable) => {
      if (typeof stackable !== "boolean") throw invalid("stackable flag")
      return stackable
    }),
    usageLimit: optional(value.usageLimit, (limit) => integer(limit, "usage limit", 1)),
    perCustomerLimit: optional(value.perCustomerLimit, (limit) => integer(limit, "per-customer limit", 1)),
    redemptionCount: optional(value.redemptionCount, (count) => integer(count, "redemption count", 0)),
  }
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

export function promotionListFromApi(value: unknown, expected: { currency: string }): PromotionListResult {
  if (!isRecord(value) || !Array.isArray(value.items)) throw invalid("list")
  const items = value.items.map((item) => promotionFromApi(item, expected))
  return { items, ...pageInfoFromApi(value, items.length) }
}
