import { ServiceError } from "@/lib/data-source/errors"

import {
  FEE_BASES,
  PLAN_MODELS,
  PLAN_STATUSES,
  TAX_TREATMENTS,
  type Entitlement,
  type FeeTax,
  type FeeTerm,
  type Money,
  type Plan,
} from "./types"

// Converts the plan between the PROPOSED API shape (docs/billing-ui.md) and
// the frontend model. Anything unexpected is an integration error that fails
// visibly: an unknown model, status, fee basis or tax treatment is never
// guessed; a malformed, fractional, negative, unsafe or wrong-currency amount
// is refused rather than coerced; a rate outside 0 to 100 percent is refused;
// and a missing value stays null, never a default. Only the fields named below
// are read, so card, bank, UPI or tax-ID details sent alongside can't reach a
// screen. Error messages name the problem and never repeat a value. This
// validates shape only: it computes no fee, tax or status.

type Raw = Record<string, unknown>
const isRecord = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value)
const invalid = (what: string) => new ServiceError("unavailable", `Invalid billing data from API: ${what}`)

const ID_PATTERN = /^[\w-]{1,100}$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_NAME_LENGTH = 80
const MAX_LABEL_LENGTH = 80
const MAX_TAX_LABEL_LENGTH = 40
const MAX_DETAIL_LENGTH = 200
const MAX_NOTICE_LENGTH = 300
const MAX_ENTITLEMENTS = 50
const MAX_FEE_TERMS = 20
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

/** A real calendar date, exactly as supplied (never shifted or reinterpreted). */
function calendarDate(value: unknown, what: string): string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) throw invalid(what)
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw invalid(what)
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

/** A fee amount: non-negative integer minor units in the restaurant's currency. Nothing is converted. */
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

function taxFromApi(value: unknown): FeeTax {
  if (!isRecord(value)) throw invalid("tax")
  return {
    label: nonEmptyString(value.label, "tax label", MAX_TAX_LABEL_LENGTH),
    treatment: oneOf(value.treatment, TAX_TREATMENTS, "tax treatment"),
    rateBasisPoints: optional(value.rateBasisPoints, (rate) => integer(rate, "tax rate", 0, MAX_BASIS_POINTS)),
  }
}

function feeTermFromApi(value: unknown, currency: string): FeeTerm {
  if (!isRecord(value)) throw invalid("fee term")
  const basis = oneOf(value.basis, FEE_BASES, "fee basis")
  const amount = optional(value.amount, (fee) => money(fee, "fee", currency))
  const rateBasisPoints = optional(value.rateBasisPoints, (rate) => integer(rate, "fee rate", 0, MAX_BASIS_POINTS))
  // A percentage carries a rate and nothing else; a fixed fee carries an amount and nothing else.
  if (basis === "percentage_of_order" ? amount !== null || rateBasisPoints === null : amount === null || rateBasisPoints !== null) {
    throw invalid("fee value")
  }
  return {
    label: nonEmptyString(value.label, "fee label", MAX_LABEL_LENGTH),
    basis,
    amount,
    rateBasisPoints,
    tax: optional(value.tax, taxFromApi),
  }
}

function entitlementFromApi(value: unknown): Entitlement {
  if (!isRecord(value)) throw invalid("entitlement")
  return {
    label: nonEmptyString(value.label, "entitlement label", MAX_LABEL_LENGTH),
    detail: optional(value.detail, (detail) => nonEmptyString(detail, "entitlement detail", MAX_DETAIL_LENGTH)),
  }
}

function listOf<Item>(value: unknown, what: string, max: number, read: (item: unknown) => Item): Item[] {
  if (!Array.isArray(value) || value.length > max) throw invalid(what)
  return value.map(read)
}

export function planFromApi(value: unknown, expected: { currency: string }): Plan {
  if (!isRecord(value)) throw invalid("plan")
  const periodStart = optional(value.periodStart, (date) => calendarDate(date, "period start"))
  const periodEnd = optional(value.periodEnd, (date) => calendarDate(date, "period end"))
  if (periodStart !== null && periodEnd !== null && periodStart > periodEnd) throw invalid("period")
  return {
    id: id(value.id, "plan id"),
    name: nonEmptyString(value.name, "plan name", MAX_NAME_LENGTH),
    model: optional(value.model, (model) => oneOf(model, PLAN_MODELS, "plan model")),
    status: optional(value.status, (status) => oneOf(status, PLAN_STATUSES, "plan status")),
    renewsOn: optional(value.renewsOn, (date) => calendarDate(date, "renewal date")),
    trialEndsOn: optional(value.trialEndsOn, (date) => calendarDate(date, "trial end date")),
    periodStart,
    periodEnd,
    notice: optional(value.notice, (notice) => nonEmptyString(notice, "notice", MAX_NOTICE_LENGTH)),
    entitlements: listOf(value.entitlements, "entitlements", MAX_ENTITLEMENTS, entitlementFromApi),
    feeTerms: listOf(value.feeTerms, "fee terms", MAX_FEE_TERMS, (term) => feeTermFromApi(term, expected.currency)),
  }
}
