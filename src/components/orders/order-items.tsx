import { TriangleAlert } from "lucide-react"

import { formatDateTime, formatMoney, type ZoneAndLocale } from "@/lib/orders/format"
import type { Money, OrderCharges, OrderItem } from "@/lib/orders/types"

export function OrderItems({
  items,
  charges,
  context,
}: {
  items: OrderItem[]
  charges: OrderCharges
  context: ZoneAndLocale
}) {
  const money = (value: Money) => formatMoney(value, context.locale)
  return (
    <div className="flex flex-col gap-5">
      <ul className="divide-y">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0">
            <span className="grid h-7 min-w-7 place-items-center rounded-md bg-muted px-1.5 text-xs font-semibold tabular-nums">
              {item.quantity}×
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{item.name}</p>
              {item.options.length > 0 ? (
                <p className="text-xs text-muted-foreground">{item.options.join(", ")}</p>
              ) : null}
              {item.note ? (
                <p className="mt-1 text-xs text-amber-900">Note: {item.note}</p>
              ) : null}
              {item.unavailableAfterPlacement ? (
                // PRD §3.10: the order stays valid; this explains the flag.
                <p className="mt-1 flex items-start gap-1 text-xs font-medium text-red-700">
                  <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
                  <span>
                    Marked unavailable after this order was placed, by {item.unavailableAfterPlacement.by},{" "}
                    <time dateTime={item.unavailableAfterPlacement.at}>
                      {formatDateTime(item.unavailableAfterPlacement.at, context)}
                    </time>
                  </span>
                </p>
              ) : null}
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {money(item.unitPrice)} each
              </p>
            </div>
            <span className="text-sm font-medium tabular-nums">{money(item.lineTotal)}</span>
          </li>
        ))}
      </ul>

      <dl className="flex flex-col gap-2 border-t pt-4 text-sm">
        <ChargeRow label="Subtotal" value={charges.subtotal} format={money} />
        <ChargeRow label="Discount" value={charges.discount} format={money} negative />
        <ChargeRow label="Taxes" value={charges.tax} format={money} />
        <ChargeRow label="Delivery fee" value={charges.deliveryFee} format={money} />
        <ChargeRow label="Packaging" value={charges.packagingFee} format={money} />
        <div className="mt-1 flex items-center justify-between border-t pt-3 text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{money(charges.total)}</dd>
        </div>
      </dl>
    </div>
  )
}

function ChargeRow({
  label,
  value,
  format,
  negative = false,
}: {
  label: string
  value: Money | null
  format: (value: Money) => string
  negative?: boolean
}) {
  // Charges that don't apply to this order are omitted rather than shown as zero.
  if (!value) return null
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd className="tabular-nums">
        {negative ? "−" : ""}
        {format(value)}
      </dd>
    </div>
  )
}
