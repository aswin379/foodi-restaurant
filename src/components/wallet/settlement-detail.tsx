import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateTime, type ZoneAndLocale } from "@/lib/orders/format"
import {
  settlementLineKindLabels,
  type SettlementDetail as SettlementDetailData,
  type SettlementOrder,
} from "@/lib/wallet/types"

import { InstantValue, MoneyValue, PeriodText, RefundStatusText, SettlementStatusBadge, Unavailable } from "./wallet-values"

export function SettlementOverview({ settlement, context }: { settlement: SettlementDetailData; context: ZoneAndLocale }) {
  return (
    <Card className="gap-4 shadow-none">
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">Settlement</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-1">
          <Row label="Status">
            <SettlementStatusBadge status={settlement.status} />
          </Row>
          <Row label="Orders">{settlement.orderCount === null ? <Unavailable /> : settlement.orderCount}</Row>
          <Row label="Gross amount">
            <MoneyValue money={settlement.grossAmount} locale={context.locale} />
          </Row>
          <Row label="Net amount">
            <MoneyValue money={settlement.netAmount} locale={context.locale} />
          </Row>
          <Row label="Paid on">
            <InstantValue at={settlement.paidAt} context={context} />
          </Row>
          <Row label="Payout destination">
            {settlement.payoutDestinationLabel === null ? (
              <Unavailable />
            ) : (
              <span className="font-mono text-[0.8125rem]">{settlement.payoutDestinationLabel}</span>
            )}
          </Row>
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          The status and amounts are shown as reported by Foodi&apos;s settlement service. This page doesn&apos;t verify them or
          any bank transfer.
        </p>
      </CardContent>
    </Card>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

export function SettlementHeading({ settlement, locale }: { settlement: Pick<SettlementDetailData, "periodStart" | "periodEnd">; locale: string }) {
  return (
    <h1 className="text-2xl font-semibold tracking-tight">
      Settlement <PeriodText settlement={settlement} locale={locale} />
    </h1>
  )
}

/** Labelled lines exactly as supplied. They are not added up, reconciled or checked against the net amount. */
export function SettlementLines({ settlement, context }: { settlement: SettlementDetailData; context: ZoneAndLocale }) {
  if (settlement.lines.length === 0) {
    return <p className="text-sm text-muted-foreground">No commission, fee, tax or adjustment lines were provided.</p>
  }
  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card">
      {settlement.lines.map((line, index) => (
        <li key={index} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">{line.label}</p>
            <p className="text-xs text-muted-foreground">{settlementLineKindLabels[line.kind]}</p>
            {line.refundStatus !== null ? <RefundStatusText status={line.refundStatus} /> : null}
          </div>
          <p className="text-sm font-medium">
            <MoneyValue money={line.amount} locale={context.locale} />
          </p>
        </li>
      ))}
    </ul>
  )
}

const orderHref = (order: SettlementOrder) => (order.id === null ? null : `/orders/${encodeURIComponent(order.id)}`)

function OrderReference({ order }: { order: SettlementOrder }) {
  const href = orderHref(order)
  return href === null ? (
    <span className="font-medium">{order.reference}</span>
  ) : (
    <Link
      href={href}
      className="rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {order.reference}
    </Link>
  )
}

function RefundCell({ order, locale }: { order: SettlementOrder; locale: string }) {
  if (order.refund === null) return <span className="text-muted-foreground">None</span>
  return (
    <span className="flex flex-col gap-0.5">
      <MoneyValue money={order.refund.amount} locale={locale} />
      <RefundStatusText status={order.refund.status} />
    </span>
  )
}

/** The order breakdown: table from md up, cards below. An order links to its page only when an order ID was supplied. */
export function SettlementOrders({ orders, context }: { orders: SettlementOrder[]; context: ZoneAndLocale }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Order</TableHead>
              <TableHead>Placed</TableHead>
              <TableHead className="text-right">Order total</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead>Refund</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order, index) => (
              <TableRow key={`${order.reference}-${index}`}>
                <TableCell className="pl-4">
                  <OrderReference order={order} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {order.placedAt === null ? <Unavailable /> : <time dateTime={order.placedAt}>{formatDateTime(order.placedAt, context)}</time>}
                </TableCell>
                <TableCell className="text-right">
                  <MoneyValue money={order.orderTotal} locale={context.locale} />
                </TableCell>
                <TableCell className="text-right">
                  <MoneyValue money={order.commission} locale={context.locale} />
                </TableCell>
                <TableCell className="text-right font-medium">
                  <MoneyValue money={order.net} locale={context.locale} />
                </TableCell>
                <TableCell className="max-w-56 whitespace-normal">
                  <RefundCell order={order} locale={context.locale} />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  {orderHref(order) === null ? null : (
                    <Link
                      href={orderHref(order)!}
                      className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary-text underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      View<span className="sr-only"> order {order.reference}</span>
                      <ChevronRight aria-hidden className="size-4" />
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {orders.map((order, index) => (
          <li key={`${order.reference}-${index}`} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <p>
                <OrderReference order={order} />
              </p>
              <p className="text-xs text-muted-foreground">
                {order.placedAt === null ? <Unavailable /> : <time dateTime={order.placedAt}>{formatDateTime(order.placedAt, context)}</time>}
              </p>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-3 border-t pt-3 text-sm">
              <Metric label="Order total">
                <MoneyValue money={order.orderTotal} locale={context.locale} />
              </Metric>
              <Metric label="Commission">
                <MoneyValue money={order.commission} locale={context.locale} />
              </Metric>
              <Metric label="Net">
                <MoneyValue money={order.net} locale={context.locale} />
              </Metric>
            </dl>
            {order.refund !== null ? (
              <div className="mt-3 border-t pt-3 text-sm">
                <RefundCell order={order} locale={context.locale} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  )
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}
