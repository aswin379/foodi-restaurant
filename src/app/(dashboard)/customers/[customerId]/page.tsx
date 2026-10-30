import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Inbox } from "lucide-react"

import { CustomerOrdersList, CustomerHeading, CustomerProfile } from "@/components/customers/customer-profile"
import { CustomersPagination } from "@/components/customers/customers-pagination"
import {
  CustomerDetailSkeleton,
  CustomersError,
  CustomersListSkeleton,
  CustomersLoadFailure,
  CustomersPastEnd,
} from "@/components/customers/customers-states"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PreviewNotice } from "@/components/shared/preview-notice"
import {
  customerHref,
  customersHref,
  parseCustomerListQuery,
  parseCustomerOrdersQuery,
  type RawSearchParams,
} from "@/lib/customers/query"
import { customersMode, getCustomer, getCustomersContext, listCustomerOrders } from "@/lib/customers/service"
import type { CustomerListQuery, CustomerOrdersQuery } from "@/lib/customers/types"
import type { ZoneAndLocale } from "@/lib/orders/format"

export const metadata: Metadata = {
  title: "Customer",
}

export default function CustomerDetailPage({ params, searchParams }: PageProps<"/customers/[customerId]">) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<CustomerDetailSkeleton />}>
        <CustomerDetailView params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function CustomerDetailView({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>
  searchParams: Promise<RawSearchParams>
}) {
  const { customerId } = await params
  const rawParams = await searchParams
  // The list's search, sort and page arrive in the URL, so "back" returns to the same view.
  const listQuery = parseCustomerListQuery(rawParams)

  const back = (
    <Link
      href={customersHref(listQuery)}
      className="inline-flex w-fit items-center gap-2 rounded-full text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span aria-hidden className="grid size-8 place-items-center rounded-full bg-card shadow-[0_8px_30px_rgb(31_26_23/6%)]"><ArrowLeft className="size-4" /></span>
      All customers
    </Link>
  )

  // A malformed percent-encoding can't name a customer. The ID is only ever an
  // opaque value for the API: it never decides which restaurant's data is shown (C7).
  let id: string
  try {
    id = decodeURIComponent(customerId)
  } catch {
    notFound()
  }

  let loaded
  try {
    const [context, customer] = await Promise.all([getCustomersContext(), getCustomer(id, rawParams.preview)])
    loaded = { context, customer }
  } catch (error) {
    return (
      <>
        {back}
        <CustomersLoadFailure error={error} retryHref={customerHref(id, listQuery)} what="this customer" />
      </>
    )
  }
  const customer = loaded.customer
  if (!customer) notFound()
  const context: ZoneAndLocale = { timeZone: loaded.context.timeZone, locale: loaded.context.locale }
  const ordersQuery = parseCustomerOrdersQuery(rawParams)

  return (
    <>
      {back}
      {customersMode() === "preview" ? (
        <PreviewNotice detail="Sample customers are made up, and their contact details are placeholders." />
      ) : null}
      <header>
        <CustomerHeading customer={customer} />
        <p className="mt-1 text-sm text-muted-foreground">Customer of your restaurant</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <CustomerProfile customer={customer} context={context} />
        </div>
        <section aria-labelledby="customer-orders-heading" className="flex flex-col gap-4 lg:col-span-2">
          <h2 id="customer-orders-heading" className="text-base font-semibold">
            Order history
          </h2>
          <Suspense key={ordersQuery.page} fallback={<CustomersListSkeleton />}>
            <CustomerOrders
              customerId={id}
              listQuery={listQuery}
              ordersQuery={ordersQuery}
              context={context}
              preview={rawParams.preview}
            />
          </Suspense>
        </section>
      </div>
    </>
  )
}

/** The history loads and fails on its own, so a failure here never hides the profile. */
async function CustomerOrders({
  customerId,
  listQuery,
  ordersQuery,
  context,
  preview,
}: {
  customerId: string
  listQuery: CustomerListQuery
  ordersQuery: CustomerOrdersQuery
  context: ZoneAndLocale
  preview: unknown
}) {
  const retryHref = customerHref(customerId, listQuery, ordersQuery.page)
  let result
  try {
    result = await listCustomerOrders(customerId, ordersQuery, preview)
  } catch (error) {
    return <CustomersLoadFailure error={error} retryHref={retryHref} what="order history" />
  }
  if (!result) return <CustomersError retryHref={retryHref} what="order history" />

  if (result.items.length === 0 && result.page === 1) {
    return (
      <EmptyState
        icon={Inbox}
        title="No orders yet"
        description="Orders from this customer will appear here."
        className="min-h-48 rounded-3xl border-border bg-card"
      />
    )
  }
  if (result.items.length === 0) {
    return <CustomersPastEnd firstPageHref={customerHref(customerId, listQuery, 1)} />
  }

  return (
    <>
      <CustomerOrdersList orders={result.items} context={context} />
      <CustomersPagination
        label="Order history pagination"
        noun="order"
        nounPlural="orders"
        page={result}
        itemCount={result.items.length}
        hrefFor={(page) => customerHref(customerId, listQuery, page)}
      />
    </>
  )
}
