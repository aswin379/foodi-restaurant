import "server-only"

import { PREVIEW_RESTAURANT } from "@/lib/restaurant/context"

import type { SettingsState } from "../rules"

// PREVIEW SAMPLE DATA (development only). A labelled sample profile and order
// settings for the preview restaurant; texts say "(preview)" and the address
// is illustrative, not a real place. Only src/lib/settings/preview-source.ts
// may import this file.

export function buildFixtureSettings(now: number): SettingsState {
  const updatedAt = new Date(now - 2 * 86_400_000).toISOString()
  return {
    profile: {
      name: PREVIEW_RESTAURANT.name ?? "Preview restaurant",
      description: "North and South Indian kitchen (preview)",
      contact: { phone: "+91 98765 43210", email: "owner@example.com" },
      address: { line1: "12 Sample Street (preview)", line2: null, city: "Bengaluru", region: "Karnataka", postalCode: "560001" },
      location: { latitude: 12.9716, longitude: 77.5946 },
      logoUrl: null,
      coverUrl: null,
      // The shared restaurant context stays the source of these (read-only, D7).
      timeZone: PREVIEW_RESTAURANT.timeZone,
      currency: PREVIEW_RESTAURANT.currency,
      locale: PREVIEW_RESTAURANT.locale,
      version: "prv-profile-1",
      updatedAt,
      updatedBy: "Preview staff",
    },
    orderSettings: {
      orderTypes: {
        delivery: { enabled: true, defaultPrepMinutes: 20 },
        takeaway: { enabled: true, defaultPrepMinutes: 15 },
        dine_in: { enabled: true, defaultPrepMinutes: 20 },
      },
      minimumOrder: { amountMinor: 15000, currency: PREVIEW_RESTAURANT.currency },
      pickupCodeRequired: false,
      version: "prv-order-settings-1",
      updatedAt,
      updatedBy: "Preview staff",
    },
  }
}
