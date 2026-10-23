import type { MenuAvailability } from "./types"

export const BACKEND_PENDING_MESSAGE =
  "Backend integration pending. Changes can't be saved until the Foodi menu API is connected."

export const availabilityLabels: Record<MenuAvailability, string> = {
  available: "Available",
  unavailable: "Unavailable",
}
