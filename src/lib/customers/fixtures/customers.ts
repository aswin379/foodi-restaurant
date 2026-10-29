import "server-only"

import { buildFixtureOrders } from "@/lib/orders/fixtures/orders"

import type { CustomerDetail, CustomerOrderSummary } from "../types"

// DEVELOPMENT PREVIEW DATA ONLY. Illustrative customers for previewing the UI
// while the customers API is built. Every record is visibly marked as preview
// data ("Preview customer NN"). There are no real or realistic names, phone
// numbers or email addresses: the masked values below are made-up patterns
// that show no more than two digits. Only src/lib/customers/preview-source.ts
// may import this file.
//
// The order history is taken from the Orders preview fixtures, so every
// history row links to a sample order that exists. Which customer "owns" an
// order exists only here: the Orders model has no customer association, and
// orders past index 29 belong to a customer who isn't in the directory (a
// guest checkout, C2).

const CUSTOMER_COUNT = 25
/** Orders are spread over the first 24 customers; the last has none (empty history). */
const CUSTOMERS_WITH_ORDERS = 24
/** Orders from this index on all go to the first customer, so its history has two pages. */
const FIRST_CUSTOMER_FROM_ORDER = 30
const GUEST_ORDER_INDEXES = new Set([29])

export type PreviewCustomer = CustomerDetail & { orders: CustomerOrderSummary[] }

const pad = (value: number) => String(value).padStart(2, "0")

/** Built when the preview store starts, so the dates are relative to now. */
export function buildFixtureCustomers(now: number): PreviewCustomer[] {
  const orders = buildFixtureOrders(now)
  const byCustomer = new Map<number, CustomerOrderSummary[]>()

  orders.forEach((order, index) => {
    if (GUEST_ORDER_INDEXES.has(index)) return
    const owner = index >= FIRST_CUSTOMER_FROM_ORDER ? 0 : index % CUSTOMERS_WITH_ORDERS
    const row: CustomerOrderSummary = {
      id: order.id,
      reference: order.reference,
      placedAt: order.placedAt,
      status: order.status,
      paymentStatus: order.paymentStatus,
      orderType: order.orderType,
      deliveryMode: order.deliveryMode,
      itemCount: order.itemCount,
      total: order.total,
    }
    byCustomer.set(owner, [...(byCustomer.get(owner) ?? []), row])
  })

  return Array.from({ length: CUSTOMER_COUNT }, (_, index) => {
    const history = (byCustomer.get(index) ?? []).sort((a, b) => b.placedAt.localeCompare(a.placedAt))
    // The preview plays the server: completed orders, no refunds in the sample data (C3, C4).
    const completed = history.filter((order) => order.status === "completed")
    const number = pad(index + 1)
    const customer: PreviewCustomer = {
      id: `prv-cus-${number}`,
      displayName: index === 4 ? null : `Preview customer ${number}`,
      phoneMasked: index % 3 === 2 ? null : `•••••• ••${pad(index + 10)}`,
      emailMasked: index % 4 === 1 ? `p•••@e•••••.example` : null,
      orderCount: completed.length,
      lifetimeSpend: { amountMinor: completed.reduce((sum, order) => sum + order.total.amountMinor, 0), currency: "INR" },
      lastOrderAt: history[0]?.placedAt ?? null,
      firstOrderAt: history.at(-1)?.placedAt ?? null,
      orders: history,
    }
    // C9: a source may not supply a metric. These two customers show it as unavailable.
    if (index === 2) return { ...customer, orderCount: null, lifetimeSpend: null }
    if (index === 6) return { ...customer, lastOrderAt: null, firstOrderAt: null }
    return customer
  })
}
