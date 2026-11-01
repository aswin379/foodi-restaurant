export type PrepUnit = "min" | "hours"

/** The restaurant settings the API returns and accepts (the same keys as the admin Settings tab). */
export type RestaurantSettings = {
  foodSection: boolean
  scheduleOrder: boolean
  reviewsSection: boolean
  posSystem: boolean
  selfDeliverySystem: boolean
  homeDelivery: boolean
  takeAway: boolean
  orderSubscriptionActive: boolean
  instantOrder: boolean
  customDateOrder: boolean
  customerOrderDays: number
  halalTag: boolean
  dineIn: boolean
  roomService: boolean
  dineInMinTime: number
  dineInMinTimeUnit: "min" | "hour" | "day"
  canEditOrder: boolean
  menuType: "veg" | "non_veg" | "both"
  minimumOrder: number
}

/** Options the global admin switches have turned off; those cannot be turned on by an owner. */
export type SettingsGates = {
  scheduleOrder: boolean
  homeDelivery: boolean
  takeAway: boolean
  instantOrder: boolean
  dineIn: boolean
  canEditOrder: boolean
  orderSubscription: boolean
}

/** The selected restaurant's profile as the API returns it (GET /seller/restaurant/profile). */
export type RestaurantProfile = {
  id: number
  status: string
  name: string
  description: string | null
  sellerTypeId: number
  sellerType: string
  cuisines: Array<{ id: number; name: string }>
  tags: string[]
  address: {
    address: string | null
    latitude: number | null
    longitude: number | null
    /** Follows the pin; the owner never chooses it. */
    zone: string | null
  }
  delivery: {
    mode: "SELF" | "FOODI" | "PICKUP" | null
    radiusKm: number | null
    fee: number | null
    freeDeliveryThreshold: number | null
    codEnabled: boolean
  }
  prepTime: { min: number | null; max: number | null; unit: PrepUnit }
  settings: RestaurantSettings & { prepTimeMin: number | null; prepTimeMax: number | null; prepTimeUnit: PrepUnit }
  gates: SettingsGates
  logoUrl: string | null
  coverUrl: string | null
  updatedAt: string
}

/** Saved by section; each body is the one the admin panel sends for the same step. */
export type BusinessChanges = {
  sellerTypeId: number
  name: string
  description: string
  cuisineIds: number[]
  tags: string[]
}

export type AddressChanges = { address: string; latitude: number; longitude: number }

export type DeliveryChanges = {
  deliveryMode: "SELF" | "FOODI" | "PICKUP"
  deliveryRadiusKm: number
  deliveryFee: number
  freeDeliveryThreshold?: number
  codEnabled: boolean
  prepTimeUnit: PrepUnit
  prepTimeMin: number
  prepTimeMax: number
}

export type SettingsChanges = Partial<RestaurantSettings>

export type ImageSlot = "logo" | "cover"
