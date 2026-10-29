import "server-only"

import { connection } from "next/server"

import { selectAdapter, type DataSourceMode } from "@/lib/data-source/mode"
import type { RestaurantContext } from "@/lib/restaurant/context"

import type { CustomersAdapter } from "./adapter"
import { apiCustomersAdapter } from "./api-source"
import { createPreviewCustomersAdapter } from "./preview-source"
import type {
  CustomerDetail,
  CustomerListQuery,
  CustomerListResult,
  CustomerOrdersQuery,
  CustomerOrdersResult,
} from "./types"

/**
 * Preview data is an explicit development opt-in
 * (FOODI_CUSTOMERS_DATA_SOURCE=preview) and is refused in production builds:
 * there it resolves to the API whatever the variable says. There is no
 * fallback: if the API fails, the UI shows an error.
 */
function customers(): { mode: DataSourceMode; adapter: CustomersAdapter } {
  return selectAdapter({
    modeValue: process.env.FOODI_CUSTOMERS_DATA_SOURCE,
    api: apiCustomersAdapter,
    preview: createPreviewCustomersAdapter,
  })
}

export function customersMode(): DataSourceMode {
  return customers().mode
}

export async function getCustomersContext(): Promise<RestaurantContext> {
  await connection()
  return customers().adapter.context()
}

export async function listCustomers(query: CustomerListQuery, previewScenario?: unknown): Promise<CustomerListResult> {
  await connection()
  return customers().adapter.list(query, previewScenario)
}

/** Returns null when the customer isn't in this restaurant's customer scope. */
export async function getCustomer(customerId: string, previewScenario?: unknown): Promise<CustomerDetail | null> {
  await connection()
  return customers().adapter.get(customerId, previewScenario)
}

/** Returns null when the customer isn't in this restaurant's customer scope. */
export async function listCustomerOrders(
  customerId: string,
  query: CustomerOrdersQuery,
  previewScenario?: unknown
): Promise<CustomerOrdersResult | null> {
  await connection()
  return customers().adapter.orders(customerId, query, previewScenario)
}
