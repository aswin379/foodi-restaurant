import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { customerHref } from "@/lib/customers/query"
import type { Customer, CustomerListQuery } from "@/lib/customers/types"
import type { ZoneAndLocale } from "@/lib/orders/format"

import { CustomerName, InstantValue, LifetimeSpend, MaskedContact, OrderCount, customerNameOf } from "./customer-values"

/** Table from md up, cards below, both rendered from the same customers. */
export function CustomersList({
  customers,
  query,
  context,
}: {
  customers: Customer[]
  /** The list's search, sort and page, carried to the profile so "back" returns to the same view. */
  query: CustomerListQuery
  context: ZoneAndLocale
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-3xl bg-card shadow-[0_8px_30px_rgb(31_26_23/6%)] lg:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Customer</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Lifetime spend</TableHead>
              <TableHead>Last order</TableHead>
              <TableHead className="pr-6 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="pl-4 font-medium">
                  <CustomerName customer={customer} />
                </TableCell>
                <TableCell>
                  <ContactLines customer={customer} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <OrderCount customer={customer} />
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  <LifetimeSpend customer={customer} context={context} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <InstantValue at={customer.lastOrderAt} context={context} />
                </TableCell>
                <TableCell className="pr-6 text-right">
                  <Link
                    href={customerHref(customer.id, query)}
                    className="inline-flex items-center gap-2 rounded-full text-sm font-semibold text-primary-text outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    View <span className="sr-only">customer {customerNameOf(customer)}</span>
                    <span aria-hidden className="grid size-7 place-items-center rounded-full bg-primary-soft"><ArrowRight className="size-3.5" /></span>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
        {customers.map((customer) => (
          <li key={customer.id}>
            <Link
              href={customerHref(customer.id, query)}
              className="block h-full rounded-2xl bg-card p-4 shadow-[0_8px_30px_rgb(31_26_23/6%)] outline-none transition-shadow hover:shadow-[0_12px_36px_rgb(214_63_8/16%)] focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <p className="font-medium">
                <CustomerName customer={customer} />
              </p>
              <div className="mt-1 text-xs text-muted-foreground">
                <ContactLines customer={customer} />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-3 border-t pt-3 text-sm">
                <Metric label="Orders">
                  <OrderCount customer={customer} />
                </Metric>
                <Metric label="Lifetime spend">
                  <LifetimeSpend customer={customer} context={context} />
                </Metric>
                <Metric label="Last order">
                  <InstantValue at={customer.lastOrderAt} context={context} />
                </Metric>
              </dl>
            </Link>
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
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  )
}

/** Masked contact lines when supplied; "No contact details shared" otherwise. */
function ContactLines({ customer }: { customer: Pick<Customer, "phoneMasked" | "emailMasked"> }) {
  if (customer.phoneMasked === null && customer.emailMasked === null) {
    return <span className="text-muted-foreground">No contact details shared</span>
  }
  return (
    <span className="flex flex-col gap-0.5">
      {customer.phoneMasked !== null ? <MaskedContact value={customer.phoneMasked} /> : null}
      {customer.emailMasked !== null ? <MaskedContact value={customer.emailMasked} /> : null}
    </span>
  )
}
