// Product terminology from PRD v0.3 (G6). UI labels and frontend models use
// these names; backend names, where they differ, are translated only in
// src/lib/api/mapping.ts.

/** How the customer receives the order (PRD §3.2 channels). */
export const ORDER_TYPES = ["delivery", "takeaway", "dine_in"] as const
export type OrderType = (typeof ORDER_TYPES)[number]

export const orderTypeLabels: Record<OrderType, string> = {
  delivery: "Delivery",
  takeaway: "Takeaway",
  dine_in: "Dine-in",
}

/** Who delivers a delivery order (PRD §4.2). */
export const DELIVERY_MODES = ["foodi", "restaurant"] as const
export type DeliveryMode = (typeof DELIVERY_MODES)[number]

export const deliveryModeLabels: Record<DeliveryMode, string> = {
  foodi: "Foodi delivery",
  restaurant: "Own rider",
}

export function isOrderType(value: unknown): value is OrderType {
  return typeof value === "string" && (ORDER_TYPES as readonly string[]).includes(value)
}
