import { api } from "@/lib/api-client"

import type {
  ApplicationImages,
  ApplicationOptions,
  EditSlot,
  EditStep,
  Restaurant,
  RestaurantApplication,
  RestaurantDetail,
} from "./types"

// Not restaurant-scoped: this is how the owner learns which restaurants exist, pending ones included.
// The :id routes are checked against the owner's own restaurants by the server.
const PATH = "/seller/restaurants"

export async function listRestaurants(): Promise<Restaurant[]> {
  // First page only (up to 100); the switcher never loads every restaurant's detail.
  return (await api<{ restaurants: Restaurant[] }>(`${PATH}?limit=100`)).restaurants
}

/** Applies for another restaurant. The owner is taken from the sign-in; only restaurant details are sent. */
export async function addRestaurant(
  application: RestaurantApplication,
  images: ApplicationImages
): Promise<Restaurant> {
  const form = new FormData()
  form.append("data", JSON.stringify(application))
  form.append("logo", images.logo)
  form.append("cover", images.cover)
  if (images.idDocument) form.append("idDocument", images.idDocument)
  if (images.taxCertificate) form.append("taxCertificate", images.taxCertificate)
  return (await api<{ restaurant: Restaurant }>(PATH, { method: "POST", body: form })).restaurant
}

export async function getRestaurant(id: number): Promise<RestaurantDetail> {
  return (await api<{ restaurant: RestaurantDetail }>(`${PATH}/${id}`)).restaurant
}

/** Saves one section of an application with requested changes. */
export async function saveSection(id: number, step: EditStep, body: unknown): Promise<RestaurantDetail> {
  return (await api<{ restaurant: RestaurantDetail }>(`${PATH}/${id}/steps/${step}`, { method: "PUT", body })).restaurant
}

export async function uploadFile(id: number, slot: EditSlot, file: File): Promise<RestaurantDetail> {
  const form = new FormData()
  form.append("file", file)
  return (await api<{ restaurant: RestaurantDetail }>(`${PATH}/${id}/files/${slot}`, { method: "PUT", body: form })).restaurant
}

/** A rejected application becomes editable again (status: changes requested). */
export async function reopenRestaurant(id: number): Promise<RestaurantDetail> {
  return (await api<{ restaurant: RestaurantDetail }>(`${PATH}/${id}/reopen`, { method: "POST" })).restaurant
}

/** Sends the corrected application back to review. The restaurant is not approved by this. */
export async function resubmitRestaurant(id: number): Promise<RestaurantDetail> {
  return (await api<{ restaurant: RestaurantDetail }>(`${PATH}/${id}/resubmit`, { method: "POST" })).restaurant
}

/** Which active zone a point is in. Rejects with a 400 `ApiError` when the point is outside every zone. */
export function resolveLocation(latitude: number, longitude: number): Promise<{ zoneId: number; zoneName: string }> {
  return api("/public/restaurant-applications/resolve-location", { method: "POST", body: { latitude, longitude } })
}

/** Seller types, cuisines and zones: the same public lists the application form uses. */
export function getApplicationOptions(): Promise<ApplicationOptions> {
  return api<ApplicationOptions>("/public/restaurant-applications/options")
}
