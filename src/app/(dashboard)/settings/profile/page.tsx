import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/dashboard/page-header"
import { PreviewSettingsControls } from "@/components/settings/preview-settings-controls"
import { ProfileForm } from "@/components/settings/profile-form"
import { SettingsLoadFailure, SettingsSkeleton } from "@/components/settings/settings-states"
import { SettingsNav } from "@/components/settings/settings-nav"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { getRestaurantProfile, settingsMode, settingsPreviewRefusesSaves } from "@/lib/settings/service"

export const metadata: Metadata = {
  title: "Restaurant profile",
}

export default function ProfilePage({ searchParams }: PageProps<"/settings/profile">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Restaurant profile" description="How your restaurant appears to customers and to Foodi." />
      <SettingsNav current="/settings/profile" />
      <Suspense fallback={<SettingsSkeleton label="Loading profile" />}>
        <ProfileView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function ProfileView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { preview } = await searchParams
  let profile
  try {
    profile = await getRestaurantProfile(preview)
  } catch (error) {
    // No fallback data: a failed request is shown as a failure.
    return <SettingsLoadFailure error={error} retryHref="/settings/profile" />
  }
  const isPreview = settingsMode() === "preview"
  return (
    <div className="flex flex-col gap-5">
      {isPreview ? <PreviewNotice detail="The sample profile is marked (preview); images stay on this preview server." /> : null}
      {isPreview ? <PreviewSettingsControls refusesSaves={settingsPreviewRefusesSaves()} /> : null}
      {/* Keyed by version so a save (or someone else's change) reloads the form. */}
      <ProfileForm key={profile.version} profile={profile} />
    </div>
  )
}
