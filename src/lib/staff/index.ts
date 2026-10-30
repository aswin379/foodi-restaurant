import { connection } from "next/server"

import { loadOpsPreview, opsMode } from "@/lib/ops-preview"

/** Proposed UI roles. They are not the real permission model, which isn't defined yet. */
export const STAFF_ROLES = ["owner", "manager", "cashier", "waiter", "kitchen", "delivery"] as const
export type StaffRole = (typeof STAFF_ROLES)[number]

export const roleLabels: Record<StaffRole, string> = {
  owner: "Owner",
  manager: "Restaurant manager",
  cashier: "Cashier",
  waiter: "Waiter",
  kitchen: "Kitchen staff",
  delivery: "Delivery staff",
}

export const STAFF_STATUSES = ["active", "inactive", "invited"] as const
export type StaffStatus = (typeof STAFF_STATUSES)[number]

/** The areas a role could be allowed into. A proposal for the review of the permission model. */
export const PERMISSION_AREAS = ["Orders", "Menu", "Hours", "POS", "Kitchen display", "Delivery", "Reports", "Settings", "Staff"] as const
export type PermissionArea = (typeof PERMISSION_AREAS)[number]

export type StaffMember = {
  id: string
  name: string
  role: StaffRole
  status: StaffStatus
  /** A masked display value; contact details aren't shown in full. */
  contact: string
  /** Only for staff who have signed in. */
  lastActive: string | null
  invitedAt: string | null
}

export type StaffData = {
  members: StaffMember[]
  /** Proposed access by role, for the overview only. */
  access: Record<StaffRole, PermissionArea[]>
}

export const staffMode = () => opsMode(process.env.FOODI_STAFF_DATA_SOURCE)

const EMPTY: StaffData = { members: [], access: { owner: [], manager: [], cashier: [], waiter: [], kitchen: [], delivery: [] } }

export async function getStaff(scenario?: unknown): Promise<StaffData> {
  await connection()
  return loadOpsPreview(process.env.FOODI_STAFF_DATA_SOURCE, scenario, EMPTY, async () => (await import("./fixtures")).PREVIEW_STAFF)
}
