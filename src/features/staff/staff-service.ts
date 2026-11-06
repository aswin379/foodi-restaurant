import { http } from "@/lib/http"

import type {
  CreateStaffInput,
  StaffInput,
  StaffListQuery,
  StaffMember,
  StaffMeta,
  StaffPage,
  StaffStatus,
} from "./types"

// Owner-only API. The restaurant is chosen in the body (or implied when the owner has one); the server
// checks the owner owns it, so these requests are not restaurant-scoped.
const PATH = "/seller/staff"

export const PAGE_SIZE = 10

export function getStaffMeta(): Promise<StaffMeta> {
  return http.get<StaffMeta>(`${PATH}/meta`)
}

export function listStaff(query: StaffListQuery): Promise<StaffPage> {
  const params = new URLSearchParams({
    sort: query.sort,
    order: query.order,
    page: String(query.page),
    pageSize: String(PAGE_SIZE),
  })
  if (query.q.trim()) params.set("q", query.q.trim())
  if (query.sellerId) params.set("sellerId", query.sellerId)
  if (query.designationId) params.set("designationId", query.designationId)
  if (query.status) params.set("status", query.status)
  return http.get<StaffPage>(`${PATH}?${params}`)
}

export async function createStaff(input: CreateStaffInput): Promise<StaffMember> {
  return (await http.post<{ staff: StaffMember }>(PATH, input)).staff
}

export async function updateStaff(id: number, input: StaffInput): Promise<StaffMember> {
  return (await http.patch<{ staff: StaffMember }>(`${PATH}/${id}`, input)).staff
}

export async function setStaffStatus(id: number, status: StaffStatus): Promise<StaffMember> {
  return (await http.patch<{ staff: StaffMember }>(`${PATH}/${id}/status`, { status })).staff
}

export async function resetStaffPassword(id: number, password: string): Promise<void> {
  await http.post(`${PATH}/${id}/reset-password`, { password })
}

/** A signed-in staff member replaces the password the owner chose. */
export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  await http.post("/seller/staff-auth/change-password", { currentPassword, newPassword })
}
