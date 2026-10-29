import "server-only"

import { ServiceError } from "@/lib/data-source/errors"
import { getPreviewCollection } from "@/lib/data-source/preview-store"
import { PREVIEW_RESTAURANT } from "@/lib/restaurant/context"

import type { CustomersAdapter } from "./adapter"
import { buildFixtureCustomers, type PreviewCustomer } from "./fixtures/customers"
import type { CustomerDetail, CustomerListResult, CustomerOrdersResult, PageInfo } from "./types"

// PREVIEW ADAPTER (development only). Read-only sample customers in the
// in-memory preview store, which refuses to run in production. It plays the
// server for search, sorting and pagination so the screens can be tried; none
// of it is evidence of how the real backend behaves.

/** `?preview=empty|error|slow|forbidden` shows those states without a backend. */
export function parsePreviewScenario(value: unknown) {
  return value === "empty" || value === "error" || value === "slow" || value === "forbidden" ? value : null
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function applyScenario(value: unknown) {
  const scenario = parsePreviewScenario(value)
  await delay(scenario === "slow" ? 2500 : 80)
  if (scenario === "error") throw new ServiceError("unavailable", "Preview scenario: error")
  if (scenario === "forbidden") throw new ServiceError("forbidden", "Preview scenario: forbidden")
  return scenario
}

const customers = () => getPreviewCollection<PreviewCustomer>("customers", () => buildFixtureCustomers(Date.now()))

const byName = (a: PreviewCustomer, b: PreviewCustomer) => {
  if (a.displayName === null || b.displayName === null) {
    return a.displayName === b.displayName ? a.id.localeCompare(b.id) : a.displayName === null ? 1 : -1
  }
  return a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id)
}

// C8: last order newest first (no date last), then name A–Z.
const byRecent = (a: PreviewCustomer, b: PreviewCustomer) => {
  if (a.lastOrderAt !== b.lastOrderAt) {
    if (a.lastOrderAt === null) return 1
    if (b.lastOrderAt === null) return -1
    return b.lastOrderAt.localeCompare(a.lastOrderAt)
  }
  return byName(a, b)
}

function paged<Item>(all: Item[], requestedPage: number, pageSize: number): { items: Item[] } & PageInfo {
  const totalPages = Math.max(1, Math.ceil(all.length / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const start = (page - 1) * pageSize
  return {
    items: all.slice(start, start + pageSize),
    page,
    pageSize,
    totalItems: all.length,
    totalPages,
    hasNextPage: page < totalPages,
  }
}

/** The directory fields only: the stored order history stays out of list and detail results. */
function withoutOrders(customer: PreviewCustomer): CustomerDetail {
  const { orders, ...detail } = customer
  void orders
  return detail
}

export function createPreviewCustomersAdapter(): CustomersAdapter {
  return {
    async context() {
      return { ...PREVIEW_RESTAURANT }
    },

    async list(query, previewScenario) {
      const scenario = await applyScenario(previewScenario)
      const needle = query.search.toLowerCase()
      const matching = (scenario === "empty" ? [] : customers().list())
        .filter((customer) => !needle || (customer.displayName?.toLowerCase().includes(needle) ?? false))
        .sort(query.sort === "name" ? byName : byRecent)
      const result: CustomerListResult = {
        ...paged(matching.map(withoutOrders), query.page, query.pageSize),
        supportedSorts: ["recent", "name"],
      }
      return result
    },

    async get(customerId, previewScenario) {
      const scenario = await applyScenario(previewScenario)
      const customer = scenario === "empty" ? null : customers().get(customerId)
      return customer ? withoutOrders(customer) : null
    },

    async orders(customerId, query, previewScenario) {
      const scenario = await applyScenario(previewScenario)
      const customer = scenario === "empty" ? null : customers().get(customerId)
      if (!customer) return null
      const result: CustomerOrdersResult = paged(customer.orders, query.page, query.pageSize)
      return result
    },
  }
}
