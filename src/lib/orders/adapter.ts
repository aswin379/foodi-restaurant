import type { RestaurantContext } from "@/lib/restaurant/context"

import type { OrderCommand } from "./commands"
import type { OrdersDaySummary } from "./summary"
import type { OrderDetail, OrderListQuery, OrderListResult, Rider } from "./types"

/**
 * What the Orders screens need from a data source. Two implementations:
 * the Foodi API (api-source.ts) and labelled preview data (preview-source.ts).
 * `previewScenario` is ignored by the API adapter.
 */
export type OrdersAdapter = {
  context(): Promise<RestaurantContext>
  list(query: OrderListQuery, previewScenario?: unknown): Promise<OrderListResult>
  /** Active orders for the live board (scheduled through out for delivery). */
  board(previewScenario?: unknown): Promise<OrderDetail[]>
  /** Null when the order doesn't exist for this restaurant. */
  get(orderId: string, previewScenario?: unknown): Promise<OrderDetail | null>
  /**
   * B5a: orders placed on a restaurant-local date, counted by status (the
   * dashboard's "today"). Counted by the server; an estimate in preview mode.
   */
  daySummary(date: string, previewScenario?: unknown): Promise<OrdersDaySummary>
  /** The restaurant's own riders, for Dispatch. */
  riders(): Promise<Rider[]>
  /** Applies a restaurant command. Replays the stored result for a repeated key. */
  act(orderId: string, command: OrderCommand, idempotencyKey: string): Promise<OrderDetail>
}
