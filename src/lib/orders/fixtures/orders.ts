import "server-only"

import type { DeliveryMode, OrderType } from "@/lib/domain/order-types"

import type {
  Money,
  OrderDetail,
  OrderItem,
  OrderStatus,
  OrderTimelineEvent,
  PaymentMethod,
  PaymentStatus,
  Rider,
} from "../types"

// DEVELOPMENT PREVIEW DATA ONLY. Illustrative orders for previewing the UI
// while the orders API is built. Every record is visibly marked as preview
// data (PRV- references, "Preview customer" names, no real addresses or
// phones). Only src/lib/orders/preview-source.ts may import this file.

const CURRENCY = "INR"
const FIXTURE_COUNT = 42
const MINUTE = 60_000

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

export const PREVIEW_RIDERS: Rider[] = [
  { id: "prv-rider-a", name: "Preview rider A" },
  { id: "prv-rider-b", name: "Preview rider B" },
]

type Channel = { orderType: OrderType; deliveryMode: DeliveryMode | null }

const CHANNELS: Channel[] = [
  { orderType: "delivery", deliveryMode: "foodi" },
  { orderType: "takeaway", deliveryMode: null },
  { orderType: "delivery", deliveryMode: "restaurant" },
  { orderType: "delivery", deliveryMode: "foodi" },
  { orderType: "dine_in", deliveryMode: null },
]

// The newest orders are still active and cover every board state; older
// ones are closed.
function statusFor(index: number): OrderStatus {
  if (index < 2) return "scheduled"
  if (index < 5) return "pending"
  if (index < 9) return "accepted"
  if (index < 12) return "ready"
  if (index < 14) return "out_for_delivery"
  if (index % 9 === 0) return "rejected"
  if (index % 7 === 0) return "cancelled"
  return "completed"
}

function channelFor(index: number, status: OrderStatus): Channel {
  // Out for delivery needs a delivery order: one own rider, one Foodi rider.
  if (status === "out_for_delivery") {
    return { orderType: "delivery", deliveryMode: index % 2 === 0 ? "restaurant" : "foodi" }
  }
  // Make sure the Ready column has an own-rider order to dispatch.
  if (index === 9) return { orderType: "delivery", deliveryMode: "restaurant" }
  return CHANNELS[index % CHANNELS.length]
}

// Small deterministic PRNG so the data is stable between restarts.
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

const money = (amountMinor: number): Money => ({ amountMinor, currency: CURRENCY })
const iso = (ms: number) => new Date(ms).toISOString()

function paymentFor(status: OrderStatus, method: PaymentMethod): PaymentStatus {
  if (method === "cash") return status === "completed" ? "paid" : "unpaid"
  if (status === "rejected") return "refunded"
  if (status === "cancelled") return "refund_pending"
  return "paid"
}

function timelineFor(
  status: OrderStatus,
  channel: Channel,
  placedAtMs: number,
  acceptedAtMs: number,
  prepTimeMinutes: number
): OrderTimelineEvent[] {
  const step = (type: OrderTimelineEvent["type"], at: number, extra: Partial<OrderTimelineEvent> = {}) => ({
    type,
    at: iso(at),
    actor: "restaurant" as const,
    reason: null,
    note: null,
    detail: null,
    ...extra,
  })
  const placed = step("pending", placedAtMs, { actor: "customer" })
  if (status === "scheduled" || status === "pending") return [placed]
  if (status === "rejected") {
    return [placed, step("rejected", placedAtMs + 3 * MINUTE, { reason: "Too busy", note: "Preview reason" })]
  }
  const accepted = step("accepted", acceptedAtMs, { detail: `Prep time ${prepTimeMinutes} min` })
  if (status === "cancelled") {
    return [
      placed,
      accepted,
      step("cancelled", acceptedAtMs + 6 * MINUTE, {
        reason: "Kitchen issue",
        note: "Preview reason",
        detail: "Stock not returned",
      }),
    ]
  }
  const events = [placed, accepted]
  if (status === "accepted") return events
  const readyAt = acceptedAtMs + prepTimeMinutes * MINUTE
  events.push(step("ready", readyAt))
  if (status === "ready") return events
  if (channel.orderType === "delivery") {
    events.push(
      step("out_for_delivery", readyAt + 4 * MINUTE, {
        actor: channel.deliveryMode === "foodi" ? "foodi" : "restaurant",
        detail: channel.deliveryMode === "foodi" ? "Foodi rider" : `Rider: ${PREVIEW_RIDERS[0].name}`,
      })
    )
  }
  if (status === "completed") events.push(step("completed", readyAt + 25 * MINUTE, { actor: "system" }))
  return events
}

function buildOrder(index: number, now: number): OrderDetail {
  const random = seeded(index + 7)
  const status = statusFor(index)
  const channel = channelFor(index, status)

  const prepTimeMinutes = [15, 20, 25][index % 3]
  // Active orders are recent and each board state is represented; one
  // accepted order (index 8) is running late. Closed orders go back about 25
  // minutes each.
  let placedAtMs: number
  let acceptedAtMs: number
  if (status === "accepted") {
    acceptedAtMs = now - (index === 8 ? prepTimeMinutes + 6 : (index - 4) * 3) * MINUTE
    placedAtMs = acceptedAtMs - 2 * MINUTE
  } else {
    placedAtMs =
      status === "scheduled"
        ? now - (index + 1) * 30 * MINUTE
        : status === "pending"
          ? now - ((index - 2) * 4 + 1) * MINUTE
          : status === "ready" || status === "out_for_delivery"
            ? now - (index * 4 + 10) * MINUTE
            : now - (index * 25 + Math.floor(random() * 15) + 2) * MINUTE
    acceptedAtMs = placedAtMs + 3 * MINUTE
  }
  const started = !["scheduled", "pending", "rejected"].includes(status)

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
      // PRD §3.10: one accepted order has a dish marked sold out afterwards.
      unavailableAfterPlacement:
        index === 6 && itemIndex === 0
          ? { at: iso(acceptedAtMs + MINUTE), by: "Preview staff" }
          : null,
    }
  })

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal.amountMinor, 0)
  const discount = index % 4 === 2 ? Math.round(subtotal * 0.1) : 0
  const tax = Math.round((subtotal - discount) * 0.05)
  const isDelivery = channel.orderType === "delivery"
  const deliveryFee = isDelivery ? (channel.deliveryMode === "foodi" ? 4000 : 3000) : 0
  const packagingFee = channel.orderType === "dine_in" ? 0 : 1000
  const total = subtotal - discount + tax + deliveryFee + packagingFee
  const paymentMethod: PaymentMethod = index % 5 === 3 ? "cash" : "online"
  const timeline = timelineFor(status, channel, placedAtMs, acceptedAtMs, prepTimeMinutes)
  const closingEvent = timeline.find((event) => event.type === "rejected" || event.type === "cancelled")

  const reference = `PRV-${String(1001 + index)}`
  return {
    id: reference.toLowerCase(),
    reference,
    placedAt: iso(placedAtMs),
    status,
    paymentStatus: paymentFor(status, paymentMethod),
    paymentMethod,
    ...channel,
    customerName: `Preview customer ${String(index + 1).padStart(2, "0")}`,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    itemsPreview: items.map((item) => `${item.quantity}× ${item.name}`).join(", "),
    total: money(total),
    scheduledFor: status === "scheduled" ? iso(now + (index === 0 ? 90 : 26 * 60) * MINUTE) : null,
    preparationStartedAt: started ? iso(acceptedAtMs) : null,
    prepTimeMinutes: started ? prepTimeMinutes : null,
    readyBy: started ? iso(acceptedAtMs + prepTimeMinutes * MINUTE) : null,
    unavailableLineCount: items.filter((item) => item.unavailableAfterPlacement).length,
    items,
    charges: {
      subtotal: money(subtotal),
      discount: discount ? money(discount) : null,
      tax: money(tax),
      deliveryFee: deliveryFee ? money(deliveryFee) : null,
      packagingFee: packagingFee ? money(packagingFee) : null,
      total: money(total),
    },
    deliveryAddress: isDelivery ? "Preview address · not a real location" : null,
    tableLabel: channel.orderType === "dine_in" ? `Table ${(index % 8) + 1}` : null,
    customerNote: index % 8 === 5 ? "Please ring the bell (preview note)" : null,
    rider:
      status === "out_for_delivery" && channel.deliveryMode === "restaurant" ? PREVIEW_RIDERS[0] : null,
    timeline,
    closure: closingEvent
      ? {
          actor: closingEvent.actor,
          reason: closingEvent.reason ?? "",
          note: closingEvent.note,
          at: closingEvent.at,
        }
      : null,
  }
}

/** Built when the preview store starts, so relative times are meaningful. */
export function buildFixtureOrders(now: number): OrderDetail[] {
  return Array.from({ length: FIXTURE_COUNT }, (_, index) => buildOrder(index, now))
}

/** A new incoming order for the "simulate a new order" preview control. */
export function buildIncomingOrder(sequence: number, now: number): OrderDetail {
  const template = buildOrder(2 + (sequence % 3), now)
  const reference = `PRV-${String(2001 + sequence)}`
  return {
    ...template,
    id: reference.toLowerCase(),
    reference,
    placedAt: iso(now),
    customerName: `Preview customer N${sequence + 1}`,
    items: template.items.map((item) => ({ ...item, id: `${reference.toLowerCase()}-${item.id}` })),
    timeline: [{ ...template.timeline[0], at: iso(now) }],
  }
}

