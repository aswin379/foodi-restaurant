import type { Metadata } from "next"

import { PageHeader } from "@/components/dashboard/page-header"
import { SettingsNav } from "@/components/settings/settings-nav"
import { RestaurantProfileView } from "@/features/profile/components/restaurant-profile-view"

export const metadata: Metadata = {
  title: "Restaurant profile",
}

// The profile is fetched in the browser: the owner's access token lives in memory, so the server cannot call
// the API on their behalf.
export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="hero"
        title="Restaurant profile"
        description="How your restaurant appears to customers and to Foodi."
        actions={<SettingsNav current="/settings/profile" />}
      />
      <RestaurantProfileView />
    </div>
  )
}
