import { http } from "@/lib/http"
import { uploadForm } from "@/lib/upload"

import type { DeliveryBoy, DeliveryBoyFile, DeliveryBoyPage, DeliveryLookups } from "./types"

// Seller API: the restaurant is the signed-in session's (X-Seller-Id is checked server side); the API
// answers 404 for any rider this restaurant did not register.
const PATH = "/seller/delivery-men"
const SCOPED = { restaurantScoped: true } as const

export function getDeliveryLookups(): Promise<DeliveryLookups> {
  return http.get<DeliveryLookups>(`${PATH}/lookups`, SCOPED)
}

export function listDeliveryBoys(): Promise<DeliveryBoyPage> {
  return http.get<DeliveryBoyPage>(`${PATH}?pageSize=100`, SCOPED)
}

/** One multipart request: the fields, the profile photo and the identity and additional documents. */
export async function createDeliveryBoy(form: FormData): Promise<DeliveryBoy> {
  return (await uploadForm<{ deliveryMan: DeliveryBoy }>(PATH, form, { ...SCOPED, maxBytes: 10 * 1024 * 1024 })).deliveryMan
}

export async function updateDeliveryBoy(id: number, fields: Record<string, string>): Promise<DeliveryBoy> {
  return (await http.patch<{ deliveryMan: DeliveryBoy }>(`${PATH}/${id}`, fields, SCOPED)).deliveryMan
}

export async function setDeliveryBoyStatus(id: number, accountStatus: "active" | "inactive"): Promise<DeliveryBoy> {
  return (await http.patch<{ deliveryMan: DeliveryBoy }>(`${PATH}/${id}/status`, { account_status: accountStatus }, SCOPED)).deliveryMan
}

export async function deleteDeliveryBoy(id: number): Promise<void> {
  await http.delete(`${PATH}/${id}`, SCOPED)
}

export async function listDeliveryBoyFiles(id: number): Promise<DeliveryBoyFile[]> {
  return (await http.get<{ files: DeliveryBoyFile[] }>(`${PATH}/${id}/files`, SCOPED)).files
}

export async function replaceDeliveryBoyPhoto(id: number, file: File): Promise<void> {
  const form = new FormData()
  form.append("file", file)
  await uploadForm(`${PATH}/${id}/profile-image`, form, { method: "put", ...SCOPED })
}

export async function uploadDeliveryBoyDocument(id: number, documentType: "identity" | "other", file: File): Promise<void> {
  const form = new FormData()
  form.append("document_type", documentType)
  form.append("file", file)
  await uploadForm(`${PATH}/${id}/documents`, form, SCOPED)
}

export async function deleteDeliveryBoyDocument(id: number, fileId: number): Promise<void> {
  await http.delete(`${PATH}/${id}/documents/${fileId}`, SCOPED)
}

/** A short-lived presigned URL for a private file; the caller opens it straight away. */
export async function getDeliveryBoyFileUrl(id: number, fileId: number): Promise<string> {
  return (await http.get<{ url: string }>(`${PATH}/${id}/file-url/${fileId}`, SCOPED)).url
}
