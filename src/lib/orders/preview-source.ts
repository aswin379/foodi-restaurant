import "server-only"

import { ServiceError } from "@/lib/data-source/errors"
import { getPreviewCollection } from "@/lib/data-source/preview-store"
import { localDateOf } from "@/lib/time/format"
import { PREVIEW_RESTAURANT } from "@/lib/restaurant/context"

import type { OrdersAdapter } from "./adapter"
import { buildFixtureOrders, buildIncomingOrder, PREVIEW_RIDERS } from "./fixtures/orders"
import { applyOrderCommand } from "./lifecycle"
import {
  ACTIVE_ORDER_STATUSES,
  type OrderDetail,
  type OrderListQuery,
  type OrderListResult,
  type OrderStatus,
  type OrderSummary,
} from "./types"

// PREVIEW ADAPTER (development only). Orders live in the in-memory preview
// store: commands change them for real within this server process, nothing
// reaches Foodi, and everything resets when the server restarts. The store
// refuses to run in production.

/** `?preview=empty|error|slow` shows those states without a backend. */
export type PreviewScenario = "empty" | "error" | "slow" | null

export function parsePreviewScenario(value: unknown): PreviewScenario {
  return value === "empty" || value === "error" || value === "slow" ? value : null
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function applyScenario(value: unknown) {
  const scenario = parsePreviewScenario(value)
  await delay(scenario === "slow" ? 2500 : 120)
  if (scenario === "error") throw new ServiceError("unavailable", "Preview scenario: error")
  return scenario
}

const orders = () => getPreviewCollection("orders", () => buildFixtureOrders(Date.now()))
// Results of commands already applied, by idempotency key.
const processed = () =>
  getPreviewCollection<{ id: string; orderId: string; result: OrderDetail }>(
    "orders.idempotency",
    () => []
  )

function toSummary(order: OrderDetail): OrderSummary {
  const { items, charges, deliveryAddress, tableLabel, customerNote, rider, timeline, closure, ...summary } =
    order
  void [items, charges, deliveryAddress, tableLabel, customerNote, rider, timeline, closure]
  return summary
}

const boardOrder: Record<OrderStatus, number> = {
  scheduled: 0,
  pending: 1,
  accepted: 2,
  ready: 3,
  out_for_delivery: 4,
  completed: 5,
  rejected: 5,
  cancelled: 5,
}

// Within a column: oldest new order first, soonest ready-by first.
function boardSortKey(order: OrderDetail) {
  return order.scheduledFor ?? (order.status === "accepted" ? order.readyBy : null) ?? order.placedAt
}

export function createPreviewOrdersAdapter(): OrdersAdapter {
  return {
    async context() {
      return { ...PREVIEW_RESTAURANT }
    },

    async list(query: OrderListQuery, previewScenario?: unknown): Promise<OrderListResult> {
      const scenario = await applyScenario(previewScenario)
      const all = scenario === "empty" ? [] : orders().list()
      const search = query.search.toLowerCase()

      const matching = all
        .filter((order) => {
          if (query.status !== "all" && order.status !== query.status) return false
          if (search && !order.reference.toLowerCase().includes(search)) return false
          const day = localDateOf(order.placedAt, PREVIEW_RESTAURANT.timeZone)
          if (query.from && day < query.from) return false
          if (query.to && day > query.to) return false
          return true
        })
        .sort((a, b) => b.placedAt.localeCompare(a.placedAt))

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
    },

    async board(previewScenario?: unknown) {
      const scenario = await applyScenario(previewScenario)
      if (scenario === "empty") return []
      const active: readonly OrderStatus[] = ACTIVE_ORDER_STATUSES
      return orders()
        .list()
        .filter((order) => active.includes(order.status))
        .sort(
          (a, b) =>
            boardOrder[a.status] - boardOrder[b.status] ||
            boardSortKey(a).localeCompare(boardSortKey(b))
        )
    },

    async get(orderId, previewScenario?: unknown) {
      await applyScenario(previewScenario)
      return orders().get(orderId)
    },

    async riders() {
      return PREVIEW_RIDERS.map((rider) => ({ ...rider }))
    },

    async act(orderId, command, idempotencyKey) {
      await delay(250)
      const replay = processed().get(idempotencyKey)
      if (replay) {
        if (replay.orderId !== orderId) {
          throw new ServiceError("conflict", "This request key was already used for another order.")
        }
        return replay.result
      }
      const result = orders().update(orderId, (order) =>
        applyOrderCommand(order, command, { now: new Date(), riders: PREVIEW_RIDERS })
      )
      processed().insert({ id: idempotencyKey, orderId, result })
      return result
    },
  }
}

/** Preview control: adds a new incoming order so the alarm can be tried. */
export function simulateIncomingPreviewOrder(): OrderDetail {
  const sequence = orders().list().filter((order) => order.reference.startsWith("PRV-2")).length
  return orders().insert(buildIncomingOrder(sequence, Date.now()))
}

/** Preview control: restores the starting sample orders. */
export function resetPreviewOrders() {
  orders().reset()
  processed().reset()
}
