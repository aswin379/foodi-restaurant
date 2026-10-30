import { formatDate, formatMoney, type ZoneAndLocale } from "@/lib/orders/format"
import {
  settlementStatusLabels,
  type Money,
  type RefundStatus,
  type SettlementStatus,
  type SettlementSummary,
} from "@/lib/wallet/types"
import { cn } from "@/lib/utils"

/** A missing value is a neutral marker, never zero or a guess. */
export function Unavailable() {
  return (
    <>
      <span aria-hidden>—</span>
      <span className="sr-only">Not available</span>
    </>
  )
}

/** Money exactly as supplied. A negative amount is a deduction and shows its sign. */
export function MoneyValue({ money, locale }: { money: Money | null; locale: string }) {
  return money === null ? <Unavailable /> : <span className="tabular-nums">{formatMoney(money, locale)}</span>
}

export function InstantValue({ at, context }: { at: string | null; context: ZoneAndLocale }) {
  return at === null ? <Unavailable /> : <time dateTime={at}>{formatDate(at, context)}</time>
}

const formatCalendarDate = (date: string, locale: string) =>
  // A settlement period is a restaurant-local calendar date, shown as supplied: never shifted into another zone.
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`)
  )

/** The server-supplied period, inclusive. */
export function PeriodText({ settlement, locale }: { settlement: Pick<SettlementSummary, "periodStart" | "periodEnd">; locale: string }) {
  return (
    <>
      <time dateTime={settlement.periodStart}>{formatCalendarDate(settlement.periodStart, locale)}</time>
      {" – "}
      <time dateTime={settlement.periodEnd}>{formatCalendarDate(settlement.periodEnd, locale)}</time>
    </>
  )
}

const statusTone: Record<SettlementStatus, string> = {
  pending: "border-warning-line bg-warning-soft text-warning-foreground",
  processing: "border-info-line bg-info-soft text-info-foreground",
  paid: "border-success-line bg-success-soft text-success-foreground",
  failed: "border-danger-line bg-danger-soft text-danger-foreground",
  on_hold: "border-neutral-line bg-neutral-soft text-neutral-foreground",
}

const pill = "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"

/** The status the source reports. With none, nothing is assumed. */
export function SettlementStatusBadge({ status }: { status: SettlementStatus | null }) {
  if (status === null) {
    return (
      <span className="text-sm text-muted-foreground">
        <Unavailable />
      </span>
    )
  }
  return (
    <span className={cn(pill, statusTone[status])}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {settlementStatusLabels[status]}
    </span>
  )
}

/** PRD P2: a refund is final only when the payment provider confirms it. */
export function RefundStatusText({ status }: { status: RefundStatus }) {
  return status === "pending" ? (
    <span className="text-sm font-medium text-warning-foreground">Refund pending, not final until the payment provider confirms it</span>
  ) : (
    <span className="text-sm font-medium text-neutral-foreground">Refund confirmed by the payment provider</span>
  )
}
