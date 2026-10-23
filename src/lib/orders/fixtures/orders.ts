import "server-only"

import type {
  FulfilmentMethod,
  Money,
  OrderDetail,
  OrderItem,
  OrderStatus,
  OrderTimelineEvent,
  PaymentMethod,
  PaymentStatus,
} from "../types"

// DEVELOPMENT FIXTURES ONLY. Illustrative orders for previewing the UI while
// the orders API is built. Every record is visibly marked as preview data
// (PRV- references, "Preview customer" names, no real addresses or phones).
// Never import this file outside src/lib/orders/fixtures.

const CURRENCY = "INR"
const FIXTURE_COUNT = 42

const MENU: { name: string; priceMinor: number; options?: string[] }[] = [
  { name: "Paneer tikka", priceMinor: 26000 },
  { name: "Veg biryani", priceMinor: 22000, options: ["Medium spice"] },
  { name: "Butter naan", priceMinor: 6000 },
  { name: "Masala dosa", priceMinor: 14000 },
  { name: "Filter coffee", priceMinor: 5000 },
  { name: "Gulab jamun (2 pcs)", priceMinor: 9000 },
  { name: "Lemon rice", priceMinor: 12000 },
  { name: "Dal makhani", priceMinor: 19000, options: ["Extra butter"] },
]

const FULFILMENT_CYCLE: FulfilmentMethod[] = [
  "foodi_delivery",
  "pickup",
  "restaurant_delivery",
  "foodi_delivery",
  "dine_in",
]

// Newest orders are still in progress; older ones are closed.
function statusFor(index: number): OrderStatus {
  if (index < 4) return "pending"
  if (index < 7) return "accepted"
  if (index < 10) return "preparing"
  if (index < 12) return "ready"
  if (index < 14) return "out_for_delivery"
  if (index % 9 === 0) return "rejected"
  if (index % 7 === 0) return "cancelled"
  return "completed"
}

// Small deterministic PRNG so fixtures are stable between reloads.
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

const money = (amountMinor: number): Money => ({ amountMinor, currency: CURRENCY })

function pathTo(status: OrderStatus, fulfilment: FulfilmentMethod): OrderStatus[] {
  const delivery = fulfilment === "foodi_delivery" || fulfilment === "restaurant_delivery"
  const happy: OrderStatus[] = delivery
    ? ["pending", "accepted", "preparing", "ready", "out_for_delivery", "completed"]
    : ["pending", "accepted", "preparing", "ready", "completed"]
  if (status === "rejected") return ["pending", "rejected"]
  if (status === "cancelled") return ["pending", "accepted", "cancelled"]
  const end = happy.indexOf(status)
  // out_for_delivery never applies to non-delivery orders.
  return end === -1 ? happy.slice(0, 4) : happy.slice(0, end + 1)
}

const ACTOR: Record<OrderStatus, OrderTimelineEvent["actor"]> = {
  pending: "customer",
  accepted: "restaurant",
  preparing: "restaurant",
  ready: "restaurant",
  out_for_delivery: "restaurant",
  completed: "system",
  rejected: "restaurant",
  cancelled: "customer",
}

function paymentFor(
  status: OrderStatus,
  method: PaymentMethod
): PaymentStatus {
  if (method === "cash") return status === "completed" ? "paid" : "unpaid"
  if (status === "rejected") return "refunded"
  if (status === "cancelled") return "refund_pending"
  return "paid"
}

function buildOrder(index: number, now: number): OrderDetail {
  const random = seeded(index + 7)
  const fulfilment = FULFILMENT_CYCLE[index % FULFILMENT_CYCLE.length]
  const status = statusFor(index)
  // Roughly 25 minutes apart, so recent days and older days both have orders.
  const placedAtMs = now - (index * 25 + Math.floor(random() * 15) + 2) * 60_000

  const itemCount = 1 + Math.floor(random() * 3)
  const firstMenuIndex = Math.floor(random() * MENU.length)
  const items: OrderItem[] = Array.from({ length: itemCount }, (_, itemIndex) => {
    // Step through the menu so one order never lists the same dish twice.
    const menuItem = MENU[(firstMenuIndex + itemIndex * 3) % MENU.length]
    const quantity = 1 + Math.floor(random() * 2)
    return {
      id: `prv-${index + 1}-${itemIndex + 1}`,
      name: menuItem.name,
      quantity,
      unitPrice: money(menuItem.priceMinor),
      lineTotal: money(menuItem.priceMinor * quantity),
      options: menuItem.options ?? [],
      note: itemIndex === 0 && index % 6 === 1 ? "Less oil (preview note)" : null,
    }
  })

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal.amountMinor, 0)
  const discount = index % 4 === 2 ? Math.round(subtotal * 0.1) : 0
  const tax = Math.round((subtotal - discount) * 0.05)
  const isDelivery = fulfilment === "foodi_delivery" || fulfilment === "restaurant_delivery"
  const deliveryFee = isDelivery ? (fulfilment === "foodi_delivery" ? 4000 : 3000) : 0
  const packagingFee = fulfilment === "dine_in" ? 0 : 1000
  const total = subtotal - discount + tax + deliveryFee + packagingFee

  const paymentMethod: PaymentMethod = index % 5 === 3 ? "cash" : "online"
  const path = pathTo(status, fulfilment)
  const timeline = path.map<OrderTimelineEvent>((step, stepIndex) => ({
    status: step,
    at: new Date(placedAtMs + stepIndex * 6 * 60_000).toISOString(),
    actor: ACTOR[step],
    reason:
      step === "rejected"
        ? "Item unavailable (preview reason)"
        : step === "cancelled"
          ? "Customer changed their mind (preview reason)"
          : null,
  }))

  const reference = `PRV-${String(1001 + index)}`
  return {
    id: reference.toLowerCase(),
    reference,
    placedAt: new Date(placedAtMs).toISOString(),
    status,
    paymentStatus: paymentFor(status, paymentMethod),
    fulfilment,
    customerName: `Preview customer ${String(index + 1).padStart(2, "0")}`,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    itemsPreview: items.map((item) => `${item.quantity}× ${item.name}`).join(", "),
    total: money(total),
    items,
    charges: {
      subtotal: money(subtotal),
      discount: discount ? money(discount) : null,
      tax: money(tax),
      deliveryFee: deliveryFee ? money(deliveryFee) : null,
      packagingFee: packagingFee ? money(packagingFee) : null,
      total: money(total),
    },
    paymentMethod,
    deliveryAddress: isDelivery ? "Preview address · not a real location" : null,
    tableLabel: fulfilment === "dine_in" ? `Table ${(index % 8) + 1}` : null,
    customerNote: index % 8 === 5 ? "Please ring the bell (preview note)" : null,
    timeline,
    closureReason: timeline.find((event) => event.reason)?.reason ?? null,
  }
}

/** Generated per request so relative times ("today") stay meaningful. */
export function buildFixtureOrders(now: number): OrderDetail[] {
  return Array.from({ length: FIXTURE_COUNT }, (_, index) => buildOrder(index, now))
}
