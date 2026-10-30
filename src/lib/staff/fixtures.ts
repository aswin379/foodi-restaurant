import type { StaffData } from "./index"

// Preview-only sample staff. Names are placeholders and contact details are masked; nothing here is a real person.
export const PREVIEW_STAFF: StaffData = {
  members: [
    { id: "prv-stf-1", name: "Preview owner", role: "owner", status: "active", contact: "o•••@•••.example", lastActive: "2026-10-30T08:12:00+05:30", invitedAt: null },
    { id: "prv-stf-2", name: "Preview manager", role: "manager", status: "active", contact: "m•••@•••.example", lastActive: "2026-10-30T07:48:00+05:30", invitedAt: null },
    { id: "prv-stf-3", name: "Preview cashier A", role: "cashier", status: "active", contact: "•••• ••41", lastActive: "2026-10-29T21:30:00+05:30", invitedAt: null },
    { id: "prv-stf-4", name: "Preview cashier B", role: "cashier", status: "inactive", contact: "•••• ••77", lastActive: "2026-09-12T18:05:00+05:30", invitedAt: null },
    { id: "prv-stf-5", name: "Preview waiter", role: "waiter", status: "active", contact: "•••• ••02", lastActive: "2026-10-29T22:10:00+05:30", invitedAt: null },
    { id: "prv-stf-6", name: "Preview chef", role: "kitchen", status: "active", contact: "•••• ••58", lastActive: "2026-10-30T06:55:00+05:30", invitedAt: null },
    { id: "prv-stf-7", name: "Preview rider", role: "delivery", status: "active", contact: "•••• ••90", lastActive: "2026-10-29T20:41:00+05:30", invitedAt: null },
    { id: "prv-stf-8", name: "Invited waiter", role: "waiter", status: "invited", contact: "w•••@•••.example", lastActive: null, invitedAt: "2026-10-28T11:00:00+05:30" },
  ],
  access: {
    owner: ["Orders", "Menu", "Hours", "POS", "Kitchen display", "Delivery", "Reports", "Settings", "Staff"],
    manager: ["Orders", "Menu", "Hours", "POS", "Kitchen display", "Delivery", "Reports"],
    cashier: ["Orders", "POS"],
    waiter: ["Orders", "POS"],
    kitchen: ["Orders", "Kitchen display"],
    delivery: ["Orders", "Delivery"],
  },
}
