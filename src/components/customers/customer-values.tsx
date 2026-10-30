import { formatDate, formatMoney, type ZoneAndLocale } from "@/lib/orders/format"
import type { Customer } from "@/lib/customers/types"

export const customerNameOf = (customer: Pick<Customer, "displayName">) => customer.displayName ?? "Name not shared"

/** C9: a missing value is a neutral marker, never zero or a guess. */
export function Unavailable() {
  return (
    <>
      <span aria-hidden>—</span>
      <span className="sr-only">Not available</span>
    </>
  )
}

export function CustomerName({ customer }: { customer: Pick<Customer, "displayName"> }) {
  return customer.displayName === null ? (
    <span className="text-muted-foreground italic">Name not shared</span>
  ) : (
    <>{customer.displayName}</>
  )
}

export function OrderCount({ customer }: { customer: Pick<Customer, "orderCount"> }) {
  return customer.orderCount === null ? <Unavailable /> : <>{customer.orderCount}</>
}

export function LifetimeSpend({ customer, context }: { customer: Pick<Customer, "lifetimeSpend">; context: ZoneAndLocale }) {
  return customer.lifetimeSpend === null ? <Unavailable /> : <>{formatMoney(customer.lifetimeSpend, context.locale)}</>
}

export function InstantValue({ at, context }: { at: string | null; context: ZoneAndLocale }) {
  return at === null ? <Unavailable /> : <time dateTime={at}>{formatDate(at, context)}</time>
}

/** C6: masked text exactly as the backend sent it. Plain text: no tel:, mailto:, copy or reveal. */
export function MaskedContact({ value }: { value: string | null }) {
  return value === null ? <Unavailable /> : <span className="font-mono text-[0.8125rem]">{value}</span>
}
