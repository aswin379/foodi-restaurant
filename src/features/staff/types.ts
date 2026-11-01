export type StaffStatus = "active" | "inactive"

export type StaffMember = {
  id: number
  name: string
  email: string
  mobile: string | null
  restaurant: { id: number; name: string }
  designation: { id: number; name: string }
  rolePreset: string
  status: StaffStatus
  permissions: string[]
  createdAt: string
}

export type StaffPage = {
  items: StaffMember[]
  page: number
  pageSize: number
  total: number
}

export type PermissionGroup = {
  key: string
  label: string
  permissions: ReadonlyArray<{ key: string; label: string }>
}

export type RolePreset = { key: string; label: string; permissions: string[] }
export type Designation = { id: number; name: string; custom: boolean; sellerId: number | null }

/** Everything the staff form and filters need, from `/seller/staff/meta`. */
export type StaffMeta = {
  permissionGroups: PermissionGroup[]
  rolePresets: RolePreset[]
  restaurants: Array<{ id: number; name: string; isOperational: boolean }>
  designations: Designation[]
}

export type StaffListQuery = {
  q: string
  sellerId: string
  designationId: string
  status: "" | StaffStatus
  sort: "name" | "designation" | "createdAt"
  order: "asc" | "desc"
  page: number
}

/** Create/edit payload. Exactly one of designationId / customDesignation is set. */
export type StaffInput = {
  name: string
  mobile?: string | null
  rolePreset: string
  permissions: string[]
  designationId?: number
  customDesignation?: string
}

export type CreateStaffInput = StaffInput & { email: string; password: string; sellerId?: number }
