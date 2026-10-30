import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { OrdersLoadFailure } from "@/components/orders/orders-states"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDateTime, formatMoney, type ZoneAndLocale } from "@/lib/orders/format"
import { orderTypeLabel } from "@/lib/orders/lifecycle"
import { getOrder, getOrdersContext, ordersMode } from "@/lib/orders/service"
import type { Money, OrderDetail } from "@/lib/orders/types"

import { PrintButton } from "./print-button"

export const metadata: Metadata = {
  title: "Print order",
}

// Kitchen ticket (KOT) and bill for one order, laid out for printing. Outside
// the dashboard shell so only the tickets print. Preview data is labelled on
// the paper too.
export default function PrintOrderPage({ params }: PageProps<"/print/orders/[orderId]">) {
  return (
    <main className="mx-auto my-6 flex w-full max-w-md flex-col gap-6 rounded-3xl bg-white p-6 text-black shadow-[0_8px_30px_rgb(31_26_23/6%)] print:my-0 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <PrintView params={params} />
      </Suspense>
    </main>
  )
}

async function PrintView({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params

  let loaded
  try {
    const [context, order] = await Promise.all([getOrdersContext(), getOrder(decodeURIComponent(orderId))])
    loaded = { context, order }
  } catch (error) {
    return <OrdersLoadFailure error={error} retryHref={`/print/orders/${orderId}`} />
  }
  const { order } = loaded
  if (!order) notFound()
  const context: ZoneAndLocale = { timeZone: loaded.context.timeZone, locale: loaded.context.locale }
  const preview = ordersMode() === "preview"

  return (
    <>
      <div className="flex flex-col gap-3 print:hidden">
        <p className="rounded-2xl border border-warning-line bg-warning-soft px-3 py-2 text-xs text-warning-foreground">
          <span className="font-semibold">Development preview.</span> This page isn&apos;t protected by sign-in yet.
        </p>
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/orders/${encodeURIComponent(order.id)}`}
            className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-stone-700 outline-none hover:text-black focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Back to order
          </Link>
          <PrintButton />
        </div>
      </div>

      <h1 className="sr-only">Kitchen ticket and bill for order {order.reference}</h1>
      {preview ? <PreviewStamp /> : null}
      <KitchenTicket order={order} context={context} />
      <div aria-hidden className="border-t-2 border-dashed border-stone-400 print:break-after-page" />
      {preview ? <PreviewStamp /> : null}
      <Bill order={order} context={context} restaurantName={loaded.context.name} />
    </>
  )
}

function PreviewStamp() {
  return (
    <p className="border-2 border-black px-2 py-1 text-center text-sm font-bold tracking-wide uppercase">
      Preview · sample data · not a real order
    </p>
  )
}

function KitchenTicket({ order, context }: { order: OrderDetail; context: ZoneAndLocale }) {
  return (
    <section aria-labelledby="kot-heading" className="flex flex-col gap-3 font-mono text-sm">
      <h2 id="kot-heading" className="text-center text-base font-bold uppercase">
        Kitchen ticket
      </h2>
      <div className="flex justify-between gap-3 font-bold">
        <span>{order.reference}</span>
        <span>{orderTypeLabel(order)}</span>
      </div>
      <p>{formatDateTime(order.placedAt, context)}</p>
      {order.scheduledFor ? <p className="font-bold">For {formatDateTime(order.scheduledFor, context)}</p> : null}
      {order.tableLabel ? <p className="font-bold">{order.tableLabel}</p> : null}
      <ul className="flex flex-col gap-2 border-y border-dashed border-stone-400 py-3">
        {order.items.map((item) => (
          <li key={item.id}>
            <span className="text-base font-bold">
              {item.quantity} × {item.name}
            </span>
            {item.options.length > 0 ? <span className="block pl-4">{item.options.join(", ")}</span> : null}
            {item.note ? <span className="block pl-4">Note: {item.note}</span> : null}
            {item.unavailableAfterPlacement ? (
              <span className="block pl-4 font-bold">! Marked unavailable after this order was placed</span>
            ) : null}
          </li>
        ))}
      </ul>
      {order.customerNote ? <p>Customer note: {order.customerNote}</p> : null}
    </section>
  )
}

function Bill({
  order,
  context,
  restaurantName,
}: {
  order: OrderDetail
  context: ZoneAndLocale
  restaurantName: string | null
}) {
  const money = (value: Money) => formatMoney(value, context.locale)
  const rows: [string, Money | null, boolean?][] = [
    ["Subtotal", order.charges.subtotal],
    ["Discount", order.charges.discount, true],
    ["Taxes", order.charges.tax],
    ["Delivery fee", order.charges.deliveryFee],
    ["Packaging", order.charges.packagingFee],
  ]
  return (
    <section aria-labelledby="bill-heading" className="flex flex-col gap-3 font-mono text-sm">
      <h2 id="bill-heading" className="text-center text-base font-bold uppercase">
        Bill
      </h2>
      {restaurantName ? <p className="text-center">{restaurantName}</p> : null}
      <p>
        {order.reference} · {formatDateTime(order.placedAt, context)}
      </p>
      <table className="w-full">
        <caption className="sr-only">Items</caption>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td className="py-0.5 pr-2 align-top">
                {item.quantity} × {item.name}
              </td>
              <td className="py-0.5 text-right align-top tabular-nums">{money(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="flex flex-col gap-1 border-t border-dashed border-stone-400 pt-2">
        {rows.map(([label, value, negative]) =>
          value ? (
            <div key={label} className="flex justify-between">
              <dt>{label}</dt>
              <dd className="tabular-nums">
                {negative ? "−" : ""}
                {money(value)}
              </dd>
            </div>
          ) : null
        )}
        <div className="flex justify-between border-t border-dashed border-stone-400 pt-1 text-base font-bold">
          <dt>Total</dt>
          <dd className="tabular-nums">{money(order.charges.total)}</dd>
        </div>
      </dl>
      <p>Payment: {order.paymentMethod === "cash" ? "Cash" : "Online"}</p>
    </section>
  )
}
