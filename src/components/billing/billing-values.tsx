import { formatMoney } from "@/lib/orders/format"
import { cn } from "@/lib/utils"
import {
  planModelLabels,
  planStatusLabels,
  type FeeTax,
  type FeeTerm,
  type PlanModel,
  type PlanStatus,
} from "@/lib/billing/types"

/** A missing value is a neutral marker, never a default or a guess. */
export function Unavailable() {
  return (
    <>
      <span aria-hidden>—</span>
      <span className="sr-only">Not available</span>
    </>
  )
}

/** A restaurant-local calendar date shown as supplied: never shifted into another time zone. */
export function formatCalendarDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`)
  )
}

export function DateValue({ date, locale }: { date: string | null; locale: string }) {
  return date === null ? <Unavailable /> : <time dateTime={date}>{formatCalendarDate(date, locale)}</time>
}

/** Formats a rate the server gave in basis points (1234 is 12.34%). This is formatting, not calculation. */
export function formatRate(rateBasisPoints: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(rateBasisPoints / 10_000)
}

export function PlanModelText({ model }: { model: PlanModel | null }) {
  return model === null ? <Unavailable /> : <>{planModelLabels[model]}</>
}

const statusTone: Record<PlanStatus, string> = {
  active: "border-success-line bg-success-soft text-success-foreground",
  trialing: "border-info-line bg-info-soft text-info-foreground",
  past_due: "border-warning-line bg-warning-soft text-warning-foreground",
  expired: "border-danger-line bg-danger-soft text-danger-foreground",
  cancelled: "border-neutral-line bg-neutral-soft text-neutral-foreground",
}

/** The status the source reports. With none, nothing is assumed. The badge says nothing about access. */
export function PlanStatusBadge({ status }: { status: PlanStatus | null }) {
  if (status === null) return <Unavailable />
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        statusTone[status]
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {planStatusLabels[status]}
    </span>
  )
}

/** The fee exactly as the term states it: a given amount or a given rate. Nothing is worked out. */
export function feeValueText(term: Pick<FeeTerm, "basis" | "amount" | "rateBasisPoints">, locale: string) {
  if (term.basis === "percentage_of_order") {
    return `${formatRate(term.rateBasisPoints ?? 0, locale)} of order value`
  }
  const amount = formatMoney(term.amount!, locale)
  return term.basis === "per_order" ? `${amount} per order` : `${amount} per billing period`
}

/** The tax wording as the server gives it: whether the amount contains it, and its given rate. Never a taxed total. */
export function taxText(tax: FeeTax, locale: string) {
  const rate = tax.rateBasisPoints === null ? "" : ` (${formatRate(tax.rateBasisPoints, locale)})`
  return tax.treatment === "excluded" ? `Amount excludes ${tax.label}${rate}` : `Amount includes ${tax.label}${rate}`
}
