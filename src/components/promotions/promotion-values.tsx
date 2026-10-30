import { orderTypeLabels } from "@/lib/domain/order-types"
import { formatMoney, type ZoneAndLocale } from "@/lib/orders/format"
import {
  promotionComponentLabels,
  promotionFundingLabels,
  promotionManagerLabels,
  promotionStatusLabels,
  type Promotion,
  type PromotionDiscount,
  type PromotionStatus,
} from "@/lib/promotions/types"
import { cn } from "@/lib/utils"

/** A missing value is a neutral marker, never a default or a guess. */
export function Unavailable() {
  return (
    <>
      <span aria-hidden>—</span>
      <span className="sr-only">Not available</span>
    </>
  )
}

/** Formats a rate the server gave in basis points (1234 is 12.34%). This is formatting, not calculation. */
export function formatRate(rateBasisPoints: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(rateBasisPoints / 10_000)
}

/** The value exactly as the coupon states it. No saving or discounted price is ever worked out. */
export function discountText(discount: PromotionDiscount, locale: string) {
  return discount.type === "percentage" ? `${formatRate(discount.rateBasisPoints, locale)} off` : `${formatMoney(discount.amount, locale)} off`
}

export function DiscountValue({ discount, locale }: { discount: PromotionDiscount; locale: string }) {
  return <>{discountText(discount, locale)}</>
}

/**
 * A validity instant in the restaurant's time zone, always with its year: a coupon's dates can be
 * months apart or in the past, and "1 Oct" alone would not say which year.
 */
export function formatValidityInstant(at: string, { timeZone, locale }: ZoneAndLocale) {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(at))
}

export function Instant({ at, context }: { at: string | null; context: ZoneAndLocale }) {
  return at === null ? <Unavailable /> : <time dateTime={at}>{formatValidityInstant(at, context)}</time>
}

/** The validity as given. A missing end is not "never expires" and a missing start is not "now". */
export function ValidityText({ promotion, context }: { promotion: Pick<Promotion, "startsAt" | "endsAt">; context: ZoneAndLocale }) {
  const { startsAt, endsAt } = promotion
  if (startsAt === null && endsAt === null) return <Unavailable />
  if (startsAt !== null && endsAt !== null) {
    return (
      <>
        <Instant at={startsAt} context={context} />
        {" – "}
        <Instant at={endsAt} context={context} />
      </>
    )
  }
  return startsAt !== null ? (
    <>
      From <Instant at={startsAt} context={context} />
    </>
  ) : (
    <>
      Until <Instant at={endsAt} context={context} />
    </>
  )
}

const statusTone: Record<PromotionStatus, string> = {
  scheduled: "border-violet-line bg-violet-soft text-violet-foreground",
  active: "border-success-line bg-success-soft text-success-foreground",
  paused: "border-warning-line bg-warning-soft text-warning-foreground",
  expired: "border-neutral-line bg-neutral-soft text-neutral-foreground",
  cancelled: "border-danger-line bg-danger-soft text-danger-foreground",
}

/** The status the source reports. With none, nothing is assumed, and it is never worked out from a date. */
export function PromotionStatusBadge({ status }: { status: PromotionStatus | null }) {
  if (status === null) return <Unavailable />
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        statusTone[status]
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {promotionStatusLabels[status]}
    </span>
  )
}

export const fundingText = (promotion: Pick<Promotion, "fundedBy">) =>
  promotion.fundedBy === null ? null : promotionFundingLabels[promotion.fundedBy]

export const managerText = (promotion: Pick<Promotion, "managedBy">) =>
  promotion.managedBy === null ? null : promotionManagerLabels[promotion.managedBy]

export const orderTypesText = (promotion: Pick<Promotion, "orderTypes">) =>
  promotion.orderTypes === null ? null : promotion.orderTypes.map((type) => orderTypeLabels[type]).join(", ")

export const appliesToText = (promotion: Pick<Promotion, "appliesTo">) =>
  promotion.appliesTo === null ? null : promotion.appliesTo.map((part) => promotionComponentLabels[part]).join(", ")

/** Text or the unavailable marker. */
export function TextOrUnavailable({ text }: { text: string | null }) {
  return text === null ? <Unavailable /> : <>{text}</>
}
