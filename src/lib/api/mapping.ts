import { ServiceError } from "@/lib/data-source/errors"
import {
  DELIVERY_MODES,
  ORDER_TYPES,
  type DeliveryMode,
  type OrderType,
} from "@/lib/domain/order-types"

/**
 * The only place where backend enum names meet Foodi's product names (G6).
 *
 * ASSUMPTION: the backend's names are not decided yet (PRD §9.1, e.g.
 * `takeaway` vs `pickup`), so each API name below currently equals the PRD
 * name. When the backend contract is fixed, change the right-hand values
 * here and nothing else.
 */
const API_ORDER_TYPES: Record<OrderType, string> = {
  delivery: "delivery",
  takeaway: "takeaway",
  dine_in: "dine_in",
}

const API_DELIVERY_MODES: Record<DeliveryMode, string> = {
  foodi: "foodi",
  restaurant: "restaurant",
}

function reverse<Key extends string>(
  keys: readonly Key[],
  table: Record<Key, string>
): ReadonlyMap<string, Key> {
  return new Map(keys.map((key) => [table[key], key]))
}

const ORDER_TYPES_FROM_API = reverse(ORDER_TYPES, API_ORDER_TYPES)
const DELIVERY_MODES_FROM_API = reverse(DELIVERY_MODES, API_DELIVERY_MODES)

export function toApiOrderType(value: OrderType): string {
  return API_ORDER_TYPES[value]
}

/** Unknown API values are an integration error, never guessed at. */
export function fromApiOrderType(value: string): OrderType {
  const mapped = ORDER_TYPES_FROM_API.get(value)
  if (!mapped) throw new ServiceError("unavailable", `Unknown order type from API: ${value}`)
  return mapped
}

export function toApiDeliveryMode(value: DeliveryMode): string {
  return API_DELIVERY_MODES[value]
}

export function fromApiDeliveryMode(value: string): DeliveryMode {
  const mapped = DELIVERY_MODES_FROM_API.get(value)
  if (!mapped) throw new ServiceError("unavailable", `Unknown delivery mode from API: ${value}`)
  return mapped
}
