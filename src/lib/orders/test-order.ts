import type { OrderDetail } from "./types"

/** Test helper: a minimal valid order, overridden per test. */
export function testOrder(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: "prv-9001",
    reference: "PRV-9001",
    placedAt: "2026-10-23T10:00:00.000Z",
    status: "pending",
    paymentStatus: "paid",
    paymentMethod: "online",
    orderType: "takeaway",
    deliveryMode: null,
    customerName: "Preview customer",
    itemCount: 1,
    itemsPreview: "1× Masala dosa",
    total: { amountMinor: 15000, currency: "INR" },
    scheduledFor: null,
    preparationStartedAt: null,
    prepTimeMinutes: null,
    readyBy: null,
    unavailableLineCount: 0,
    items: [],
    charges: {
      subtotal: { amountMinor: 14000, currency: "INR" },
      discount: null,
      tax: null,
      deliveryFee: null,
      packagingFee: { amountMinor: 1000, currency: "INR" },
      total: { amountMinor: 15000, currency: "INR" },
    },
    deliveryAddress: null,
    tableLabel: null,
    customerNote: null,
    rider: null,
    timeline: [
      { type: "pending", at: "2026-10-23T10:00:00.000Z", actor: "customer", reason: null, note: null, detail: null },
    ],
    closure: null,
    ...overrides,
  }
}
