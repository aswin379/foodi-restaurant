import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { OrderStatusBadge, PaymentStatusText } from "@/components/orders/status-badges"
import type { CustomerDetail, CustomerOrderSummary } from "@/lib/customers/types"
import { formatDateTime, formatMoney, type ZoneAndLocale } from "@/lib/orders/format"
import { orderTypeLabel } from "@/lib/orders/lifecycle"

import { CustomerName, InstantValue, LifetimeSpend, MaskedContact, OrderCount } from "./customer-values"

export function CustomerProfile({ customer, context }: { customer: CustomerDetail; context: ZoneAndLocale }) {
  return (
    <div className="flex flex-col gap-6">
      <Card className="gap-4 shadow-none">
        <CardHeader>
          <CardTitle>
            <h2 className="text-base font-semibold">Contact</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-3 text-sm">
            <InfoRow label="Phone">
              <MaskedContact value={customer.phoneMasked} />
            </InfoRow>
            <InfoRow label="Email">
              <MaskedContact value={customer.emailMasked} />
            </InfoRow>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Contact details are hidden to protect your customers&apos; privacy.
          </p>
        </CardContent>
      </Card>
      <Card className="gap-4 shadow-none">
        <CardHeader>
          <CardTitle>
            <h2 className="text-base font-semibold">At your restaurant</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-1">
            <InfoRow label="Orders">
              <OrderCount customer={customer} />
            </InfoRow>
            <InfoRow label="Lifetime spend">
              <LifetimeSpend customer={customer} context={context} />
            </InfoRow>
            <InfoRow label="Last order">
              <InstantValue at={customer.lastOrderAt} context={context} />
            </InfoRow>
            <InfoRow label="First order">
              <InstantValue at={customer.firstOrderAt} context={context} />
            </InfoRow>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Figures cover this restaurant only and are worked out by Foodi.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export function CustomerHeading({ customer }: { customer: Pick<CustomerDetail, "displayName"> }) {
  return (
    <h1 className="text-2xl font-semibold tracking-tight">
      <CustomerName customer={customer} />
    </h1>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

const orderHref = (order: CustomerOrderSummary) => `/orders/${encodeURIComponent(order.id)}`

/** Order history: table from md up, cards below. Each row opens the existing order detail. */
export function CustomerOrdersList({ orders, context }: { orders: CustomerOrderSummary[]; context: ZoneAndLocale }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Order</TableHead>
              <TableHead>Placed</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="pl-4">
                  <Link
                    href={orderHref(order)}
                    className="rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {order.reference}
                  </Link>
                  <div className="mt-0.5 text-sm text-muted-foreground">{orderTypeLabel(order)}</div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <time dateTime={order.placedAt}>{formatDateTime(order.placedAt, context)}</time>
                </TableCell>
                <TableCell className="text-right tabular-nums">{order.itemCount}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatMoney(order.total, context.locale)}</TableCell>
                <TableCell>
                  <PaymentStatusText status={order.paymentStatus} />
                </TableCell>
                <TableCell>
                  <OrderStatusBadge status={order.status} />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Link
                    href={orderHref(order)}
                    className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    View<span className="sr-only"> order {order.reference}</span>
                    <ChevronRight aria-hidden className="size-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {orders.map((order) => (
          <li key={order.id}>
            <Link
              href={orderHref(order)}
              className="block rounded-xl border bg-card p-4 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{order.reference}</p>
                  <p className="text-xs text-muted-foreground">
                    <time dateTime={order.placedAt}>{formatDateTime(order.placedAt, context)}</time>
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-3 text-sm">
                <span className="text-muted-foreground">
                  {orderTypeLabel(order)} · {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                </span>
                <span className="flex items-center gap-3">
                  <PaymentStatusText status={order.paymentStatus} />
                  <span className="font-semibold tabular-nums">{formatMoney(order.total, context.locale)}</span>
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
