import { api } from "@/lib/api-client"

import type { ApplicationOptions } from "@/features/restaurants/types"

import type {
  AddressChanges,
  BusinessChanges,
  DeliveryChanges,
  ImageSlot,
  RestaurantProfile,
  SettingsChanges,
} from "./types"

// Scoped to the active restaurant (X-Seller-Id); the API checks the owner may use it and that it is approved.
const PATH = "/seller/restaurant/profile"
const SCOPED = { restaurantScoped: true } as const

type ProfileReply = { profile: RestaurantProfile }

export async function getProfile(): Promise<RestaurantProfile> {
  return (await api<ProfileReply>(PATH, SCOPED)).profile
}

/** Seller types, cuisines and zones: the same public lists the application form uses. */
export function getProfileOptions(): Promise<ApplicationOptions> {
  return api<ApplicationOptions>("/public/restaurant-applications/options")
}

/** The zone a pin falls in; rejects when the pin is outside every zone. */
export function resolveLocation(latitude: number, longitude: number): Promise<{ zoneId: number; zoneName: string }> {
  return api(`${PATH}/resolve-location`, { method: "POST", body: { latitude, longitude }, ...SCOPED })
}

async function save(path: string, body: unknown): Promise<RestaurantProfile> {
  return (await api<ProfileReply>(`${PATH}/${path}`, { method: "PATCH", body, ...SCOPED })).profile
}

export const saveBusiness = (changes: BusinessChanges) => save("business", changes)
export const saveAddress = (changes: AddressChanges) => save("address", changes)
export const saveDelivery = (changes: DeliveryChanges) => save("delivery", changes)
export const saveSettings = (changes: SettingsChanges) => save("settings", changes)

export async function uploadImage(slot: ImageSlot, file: File): Promise<RestaurantProfile> {
  const form = new FormData()
  form.append("file", file)
  return (await api<ProfileReply>(`${PATH}/files/${slot}`, { method: "PUT", body: form, ...SCOPED })).profile
}

export async function removeImage(slot: ImageSlot): Promise<RestaurantProfile> {
  return (await api<ProfileReply>(`${PATH}/files/${slot}`, { method: "DELETE", ...SCOPED })).profile
}
