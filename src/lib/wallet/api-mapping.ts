import { ServiceError } from "@/lib/data-source/errors"

import {
  REFUND_STATUSES,
  SETTLEMENT_LINE_KINDS,
  SETTLEMENT_STATUSES,
  type Money,
  type PageInfo,
  type Refund,
  type SettlementDetail,
  type SettlementLine,
  type SettlementListResult,
  type SettlementOrder,
  type SettlementOrdersResult,
  type SettlementSummary,
  type WalletSummary,
} from "./types"

// Converts wallet data between the PROPOSED API shape (docs/wallet-ui.md) and
// the frontend model. Anything unexpected is an integration error that fails
// visibly: an unknown status or line kind is never guessed (and never turned
// into "paid"), a malformed, fractional, unsafe or wrong-currency amount is
// refused rather than coerced, and a missing amount stays null (unavailable),
// never zero. Only the fields named below are read, so raw bank or account
// details sent alongside a settlement can't reach a screen, and the payout
// label must look masked. Error messages name the problem and never repeat a
// value, so no financial payload is logged. This validates shape only: it does
// not check that amounts add up, and the UI never claims it does.

type Raw = Record<string, unknown>
const isRecord = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value)
const invalid = (what: string) => new ServiceError("unavailable", `Invalid wallet data from API: ${what}`)

const ID_PATTERN = /^[\w-]{1,100}$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_LABEL_LENGTH = 80
const MAX_REFERENCE_LENGTH = 40
const MAX_MASKED_LENGTH = 40
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

/** A real calendar date, exactly as supplied (it is never shifted or reinterpreted). */
function calendarDate(value: unknown, what: string): string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) throw invalid(what)
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw invalid(what)
  return value
}

function integer(value: unknown, what: string, min: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min) throw invalid(what)
  return value
}

function oneOf<Value extends string>(value: unknown, allowed: readonly Value[], what: string): Value {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) throw invalid(`unknown ${what}`)
  return value as Value
}

/** Integer minor units in the restaurant's currency. `signed` allows a negative amount (a deduction). */
function money(value: unknown, what: string, currency: string, signed: boolean): Money {
  if (!isRecord(value)) throw invalid(what)
  const amountMinor = integer(value.amountMinor, `${what} amount`, signed ? Number.MIN_SAFE_INTEGER : 0)
  // C5-style: only the restaurant's configured currency; nothing is converted.
  if (value.currency !== currency) throw invalid(`${what} currency`)
  return { amountMinor, currency }
}

/** A missing value stays null. It is never zero, never computed. */
function optional<Value>(value: unknown, read: (value: unknown) => Value): Value | null {
  return absent(value) ? null : read(value)
}

/** Must carry a mask and show at most four digits, so a raw account number or IBAN is refused, not shown. */
function maskedLabel(value: unknown, what: string): string | null {
  if (absent(value)) return null
  const label = nonEmptyString(value, what, MAX_MASKED_LENGTH)
  if (!MASK_PATTERN.test(label) || (label.match(/\d/g) ?? []).length > 4) throw invalid(what)
  return label
}

export function walletSummaryFromApi(value: unknown, expected: { currency: string }): WalletSummary {
  if (!isRecord(value)) throw invalid("wallet")
  const read = (field: unknown, what: string) => optional(field, (amount) => money(amount, what, expected.currency, false))
  return {
    pendingSettlement: read(value.pendingSettlement, "pending settlement"),
    paidOut: read(value.paidOut, "paid out"),
    onHold: read(value.onHold, "on hold"),
    asOf: optional(value.asOf, (at) => instant(at, "as-of date")),
    payoutDestinationLabel: maskedLabel(value.payoutDestinationLabel, "payout destination"),
  }
}

function settlementSummaryFromApi(value: unknown, currency: string): SettlementSummary {
  if (!isRecord(value)) throw invalid("settlement")
  const periodStart = calendarDate(value.periodStart, "period start")
  const periodEnd = calendarDate(value.periodEnd, "period end")
  if (periodStart > periodEnd) throw invalid("period")
  return {
    id: id(value.id, "settlement id"),
    periodStart,
    periodEnd,
    status: optional(value.status, (status) => oneOf(status, SETTLEMENT_STATUSES, "settlement status")),
    grossAmount: optional(value.grossAmount, (amount) => money(amount, "gross amount", currency, false)),
    netAmount: optional(value.netAmount, (amount) => money(amount, "net amount", currency, true)),
    orderCount: optional(value.orderCount, (count) => integer(count, "order count", 0)),
    paidAt: optional(value.paidAt, (at) => instant(at, "paid date")),
  }
}

function refundFromApi(value: unknown, currency: string): Refund {
  if (!isRecord(value)) throw invalid("refund")
  return {
    amount: money(value.amount, "refund amount", currency, true),
    status: oneOf(value.status, REFUND_STATUSES, "refund status"),
  }
}

function lineFromApi(value: unknown, currency: string): SettlementLine {
  if (!isRecord(value)) throw invalid("settlement line")
  const kind = oneOf(value.kind, SETTLEMENT_LINE_KINDS, "line kind")
  const refundStatus = optional(value.refundStatus, (status) => oneOf(status, REFUND_STATUSES, "refund status"))
  // A refund line must say whether the provider confirmed it; no other line may carry a refund status.
  if ((kind === "refund") !== (refundStatus !== null)) throw invalid("refund status")
  return {
    kind,
    label: nonEmptyString(value.label, "line label", MAX_LABEL_LENGTH),
    amount: money(value.amount, "line amount", currency, true),
    refundStatus,
  }
}

export function settlementDetailFromApi(value: unknown, expected: { currency: string }): SettlementDetail {
  const summary = settlementSummaryFromApi(value, expected.currency)
  const raw = value as Raw
  if (!Array.isArray(raw.lines)) throw invalid("settlement lines")
  return {
    ...summary,
    lines: raw.lines.map((line) => lineFromApi(line, expected.currency)),
    payoutDestinationLabel: maskedLabel(raw.payoutDestinationLabel, "payout destination"),
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

function itemsOf(value: unknown): unknown[] {
  if (!isRecord(value) || !Array.isArray(value.items)) throw invalid("list")
  return value.items
}

export function settlementListFromApi(value: unknown, expected: { currency: string }): SettlementListResult {
  const items = itemsOf(value).map((item) => settlementSummaryFromApi(item, expected.currency))
  return { items, ...pageInfoFromApi(value as Raw, items.length) }
}

function orderFromApi(value: unknown, currency: string): SettlementOrder {
  if (!isRecord(value)) throw invalid("settlement order")
  return {
    // A link needs a well-formed order id; a malformed one is an error, never repaired.
    id: optional(value.id, (orderId) => id(orderId, "order id")),
    reference: nonEmptyString(value.reference, "order reference", MAX_REFERENCE_LENGTH),
    placedAt: optional(value.placedAt, (at) => instant(at, "order date")),
    orderTotal: optional(value.orderTotal, (amount) => money(amount, "order total", currency, false)),
    commission: optional(value.commission, (amount) => money(amount, "order commission", currency, true)),
    net: optional(value.net, (amount) => money(amount, "order net", currency, true)),
    refund: optional(value.refund, (refund) => refundFromApi(refund, currency)),
  }
}

export function settlementOrdersFromApi(value: unknown, expected: { currency: string }): SettlementOrdersResult {
  const items = itemsOf(value).map((item) => orderFromApi(item, expected.currency))
  return { items, ...pageInfoFromApi(value as Raw, items.length) }
}
