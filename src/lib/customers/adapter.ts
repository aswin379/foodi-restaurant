import type { RestaurantContext } from "@/lib/restaurant/context"

import type {
  CustomerDetail,
  CustomerListQuery,
  CustomerListResult,
  CustomerOrdersQuery,
  CustomerOrdersResult,
} from "./types"

/**
 * What the Customers screens need from a data source (read-only: B6b has no
 * customer writes). Two implementations: the Foodi API (api-source.ts) and
 * labelled preview data (preview-source.ts). `previewScenario` is ignored by
 * the API adapter.
 */
export type CustomersAdapter = {
  context(): Promise<RestaurantContext>
  list(query: CustomerListQuery, previewScenario?: unknown): Promise<CustomerListResult>
  /** Null when the customer doesn't exist in this restaurant's customer scope. */
  get(customerId: string, previewScenario?: unknown): Promise<CustomerDetail | null>
  /** Null when the customer doesn't exist in this restaurant's customer scope. */
  orders(customerId: string, query: CustomerOrdersQuery, previewScenario?: unknown): Promise<CustomerOrdersResult | null>
}
