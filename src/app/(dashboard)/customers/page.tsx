import { Suspense } from "react"
import type { Metadata } from "next"

import { CustomersList } from "@/components/customers/customers-list"
import { CustomersPagination } from "@/components/customers/customers-pagination"
import {
  CustomersEmpty,
  CustomersListSkeleton,
  CustomersLoadFailure,
  CustomersNoResults,
  CustomersPastEnd,
} from "@/components/customers/customers-states"
import { CustomersToolbar } from "@/components/customers/customers-toolbar"
import { isServiceError } from "@/lib/data-source/errors"
import { PageHeader } from "@/components/dashboard/page-header"
import { PreviewNotice } from "@/components/shared/preview-notice"
import {
  customersHref,
  hasActiveCustomerSearch,
  parseCustomerListQuery,
  type RawSearchParams,
} from "@/lib/customers/query"
import { customersMode, getCustomersContext, listCustomers } from "@/lib/customers/service"
import type { CustomerListQuery } from "@/lib/customers/types"

export const metadata: Metadata = {
  title: "Customers",
}

export default function CustomersPage({ searchParams }: PageProps<"/customers">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="hero"
        title="Customers"
        description="The people who have ordered from your restaurant, with their order history. Contact details are hidden."
      />
      <Suspense fallback={<CustomersListSkeleton />}>
        <CustomersView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function CustomersView({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = await searchParams
  const query = parseCustomerListQuery(params)
  const preview = customersMode() === "preview"

  return (
    <div className="flex flex-col gap-4">
      {preview ? <PreviewNotice detail="Sample customers are made up, and their contact details are placeholders." /> : null}
      {/* Keyed so a new search, sort or page shows the loading state instead of stale rows. */}
      <Suspense
        key={customersHref(query)}
        fallback={
          <>
            <CustomersToolbar query={query} supportedSorts={null} />
            <CustomersListSkeleton />
          </>
        }
      >
        <CustomersResults query={query} preview={params.preview} />
      </Suspense>
    </div>
  )
}

async function CustomersResults({ query, preview }: { query: CustomerListQuery; preview: unknown }) {
  let loaded
  try {
    const [context, result] = await Promise.all([getCustomersContext(), listCustomers(query, preview)])
    loaded = { context, result }
  } catch (error) {
    // No fallback data: a failed request is shown as a failure.
    // Nothing to search or sort while no customer service is connected.
    const connected = !(isServiceError(error) && error.kind === "not_configured")
    return (
      <>
        {connected ? <CustomersToolbar query={query} supportedSorts={null} /> : null}
        <CustomersLoadFailure error={error} retryHref={customersHref(query)} />
      </>
    )
  }
  const { context, result } = loaded
  // The page may have been clamped (an out-of-range ?page=), so links use the page actually shown.
  const shown = { ...query, page: result.page }

  let content
  if (result.items.length === 0 && result.page === 1) {
    content = hasActiveCustomerSearch(query) ? (
      <CustomersNoResults clearHref={customersHref({ ...query, search: "", page: 1 })} />
    ) : (
      <CustomersEmpty />
    )
  } else if (result.items.length === 0) {
    content = <CustomersPastEnd firstPageHref={customersHref(query, { page: 1 })} />
  } else {
    content = (
      <>
        <CustomersList customers={result.items} query={shown} context={{ timeZone: context.timeZone, locale: context.locale }} />
        <CustomersPagination
          label="Customers pagination"
          noun="customer"
          nounPlural="customers"
          page={result}
          itemCount={result.items.length}
          hrefFor={(page) => customersHref(shown, { page })}
        />
      </>
    )
  }

  return (
    <>
      <CustomersToolbar query={query} supportedSorts={result.supportedSorts} />
      {content}
    </>
  )
}
