import type { OrderType } from "@/lib/domain/order-types"
import type { Money } from "@/lib/orders/types"

// Restaurant profile and order settings (PRD v0.3 §1 module 18, §6, §4.2;
// B4a decisions D1–D9). The frontend's working model for the PROPOSED
// contract in docs/settings-ui.md, not a confirmed backend contract.

export type Address = {
  line1: string
  line2: string | null
  city: string
  region: string | null
  postalCode: string
}

/** D3: coordinates only, no map provider. */
export type Coordinates = { latitude: number; longitude: number }

export type RestaurantProfile = {
  name: string
  description: string | null
  contact: { phone: string | null; email: string | null }
  address: Address
  location: Coordinates | null
  logoUrl: string | null
  coverUrl: string | null
  /** Read-only in the panel (D7); set by Foodi. */
  timeZone: string
  currency: string
  locale: string
  /** PROPOSED optimistic-concurrency token. */
  version: string
  updatedAt: string | null
  updatedBy: string | null
}

export type OrderTypeSetting = { enabled: boolean; defaultPrepMinutes: number }

export type OrderSettings = {
  orderTypes: Record<OrderType, OrderTypeSetting>
  /** D5: one value for the whole restaurant; null = no minimum. Enforced at checkout by the backend. */
  minimumOrder: Money | null
  /** §4.2: takeaway and dine-in orders need the customer's code to complete. Checked by the backend. */
  pickupCodeRequired: boolean
  version: string
  updatedAt: string | null
  updatedBy: string | null
}
