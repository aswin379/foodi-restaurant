import "server-only"

import { OrdersServiceError } from "../errors"
import { localDateKey } from "../format"
import type {
  OrderDetail,
  OrderListQuery,
  OrderListResult,
  OrderSummary,
} from "../types"
import { buildFixtureOrders } from "./orders"

/**
 * Preview scenarios, so loading, empty and error states can be reviewed
 * without a backend. Only honoured in fixture mode (`?preview=…`).
 */
export type PreviewScenario = "empty" | "error" | "slow" | null

export function parsePreviewScenario(value: unknown): PreviewScenario {
  return value === "empty" || value === "error" || value === "slow" ? value : null
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function applyScenario(scenario: PreviewScenario) {
  await delay(scenario === "slow" ? 2500 : 150)
  if (scenario === "error") throw new OrdersServiceError("unavailable", "Preview scenario: error")
}

function toSummary(order: OrderDetail): OrderSummary {
  return {
    id: order.id,
    reference: order.reference,
    placedAt: order.placedAt,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfilment: order.fulfilment,
    customerName: order.customerName,
    itemCount: order.itemCount,
    itemsPreview: order.itemsPreview,
    total: order.total,
  }
}

// Mimics server-side filtering so the UI can be exercised end to end.
export async function listFixtureOrders(
  query: OrderListQuery,
  scenario: PreviewScenario
): Promise<OrderListResult> {
  await applyScenario(scenario)
  const all = scenario === "empty" ? [] : buildFixtureOrders(Date.now())
  const search = query.search.toLowerCase()

  const matching = all.filter((order) => {
    if (query.status !== "all" && order.status !== query.status) return false
    if (search && !order.reference.toLowerCase().includes(search)) return false
    const day = localDateKey(order.placedAt)
    if (query.from && day < query.from) return false
    if (query.to && day > query.to) return false
    return true
  })

  const totalPages = Math.max(1, Math.ceil(matching.length / query.pageSize))
  const page = Math.min(query.page, totalPages)
  const start = (page - 1) * query.pageSize
  return {
    items: matching.slice(start, start + query.pageSize).map(toSummary),
    page,
    pageSize: query.pageSize,
    totalItems: matching.length,
    totalPages,
  }
}

export async function getFixtureOrder(
  id: string,
  scenario: PreviewScenario
): Promise<OrderDetail | null> {
  await applyScenario(scenario)
  return buildFixtureOrders(Date.now()).find((order) => order.id === id) ?? null
}
