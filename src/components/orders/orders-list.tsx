import Link from "next/link"
import { ChevronRight } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateTime, formatMoney, type ZoneAndLocale } from "@/lib/orders/format"
import type { OrderSummary } from "@/lib/orders/types"

import { OrderStatusBadge, OrderTypeLabel, PaymentStatusText } from "./status-badges"

const orderHref = (order: OrderSummary) => `/orders/${encodeURIComponent(order.id)}`

/** Table from md up, cards below, both rendered from the same summaries. */
export function OrdersList({
  orders,
  context,
}: {
  orders: OrderSummary[]
  context: ZoneAndLocale
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Order</TableHead>
              <TableHead>Placed</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
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
                  <div className="mt-0.5">
                    <OrderTypeLabel order={order} />
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <time dateTime={order.placedAt}>{formatDateTime(order.placedAt, context)}</time>
                </TableCell>
                <TableCell>{order.customerName ?? "—"}</TableCell>
                <TableCell className="max-w-56 lg:max-w-72">
                  <span className="block truncate text-muted-foreground" title={order.itemsPreview}>
                    {order.itemsPreview}
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(order.total, context.locale)}
                </TableCell>
                <TableCell>
                  <PaymentStatusText status={order.paymentStatus} />
                </TableCell>
                <TableCell>
                  <OrderStatusBadge status={order.status} />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Link
                    href={orderHref(order)}
                    className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary-text underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    View
                    <span className="sr-only"> order {order.reference}</span>
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
                    {order.customerName ? ` · ${order.customerName}` : null}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                {order.itemsPreview}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-3">
                <OrderTypeLabel order={order} />
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
