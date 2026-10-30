import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMoney, type ZoneAndLocale } from "@/lib/orders/format"
import type { Promotion } from "@/lib/promotions/types"

import {
  DiscountValue,
  Instant,
  PromotionStatusBadge,
  TextOrUnavailable,
  Unavailable,
  appliesToText,
  fundingText,
  managerText,
  orderTypesText,
} from "./promotion-values"

export function PromotionHeading({ promotion }: { promotion: Pick<Promotion, "code"> }) {
  return <h1 className="font-mono text-2xl font-semibold tracking-tight break-all">{promotion.code}</h1>
}

export function PromotionDetail({ promotion, context }: { promotion: Promotion; context: ZoneAndLocale }) {
  const { discount } = promotion
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <DetailCard title="Coupon">
        <Row label="Status">
          <PromotionStatusBadge status={promotion.status} />
        </Row>
        <Row label="Name">
          <TextOrUnavailable text={promotion.name} />
        </Row>
        <Row label="Type">Coupon</Row>
        <Row label="Managed by">
          <TextOrUnavailable text={managerText(promotion)} />
        </Row>
        <Row label="Funded by">
          <TextOrUnavailable text={fundingText(promotion)} />
        </Row>
      </DetailCard>

      <DetailCard title="Discount">
        <Row label="Value">
          <DiscountValue discount={discount} locale={context.locale} />
        </Row>
        <Row label="Maximum discount">
          {discount.type === "percentage" ? (
            discount.maxDiscount === null ? (
              <Unavailable />
            ) : (
              formatMoney(discount.maxDiscount, context.locale)
            )
          ) : (
            <span className="text-muted-foreground">Not applicable to a fixed amount</span>
          )}
        </Row>
        <Row label="Minimum order">
          {promotion.minimumOrder === null ? <Unavailable /> : formatMoney(promotion.minimumOrder, context.locale)}
        </Row>
        <Row label="Applies to">
          <TextOrUnavailable text={appliesToText(promotion)} />
        </Row>
      </DetailCard>

      <DetailCard title="Validity">
        <Row label="Starts">
          <Instant at={promotion.startsAt} context={context} />
        </Row>
        <Row label="Ends">
          <Instant at={promotion.endsAt} context={context} />
        </Row>
        <p className="text-xs text-muted-foreground">Times are shown in your restaurant&apos;s time zone ({context.timeZone}).</p>
      </DetailCard>

      <DetailCard title="Eligibility and usage">
        <Row label="Order types">
          <TextOrUnavailable text={orderTypesText(promotion)} />
        </Row>
        <Row label="Can be combined with other promotions">
          {promotion.stackable === null ? <Unavailable /> : promotion.stackable ? "Yes" : "No"}
        </Row>
        <Row label="Limit per customer">
          {promotion.perCustomerLimit === null ? <Unavailable /> : promotion.perCustomerLimit}
        </Row>
        <Row label="Total usage limit">{promotion.usageLimit === null ? <Unavailable /> : promotion.usageLimit}</Row>
        <Row label="Redemptions">{promotion.redemptionCount === null ? <Unavailable /> : promotion.redemptionCount}</Row>
        <p className="text-xs text-muted-foreground">The redemption count is as counted by Foodi. This page doesn&apos;t adjust it.</p>
      </DetailCard>
    </div>
  )
}

/** Said once on the page: what it is, and what it doesn't do. */
export function PromotionDisclaimer() {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      Everything on this page is shown as provided by Foodi&apos;s promotions service. This page is read-only. It doesn&apos;t calculate
      savings, check who is eligible, or work out whether a coupon is valid right now.
    </p>
  )
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="gap-4 rounded-3xl border-transparent py-6 shadow-[0_8px_30px_rgb(31_26_23/6%)]">
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg font-semibold">{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">{children}</CardContent>
    </Card>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <dl className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </dl>
  )
}
