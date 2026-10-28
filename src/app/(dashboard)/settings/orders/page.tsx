import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/dashboard/page-header"
import { OrderSettingsForm } from "@/components/settings/order-settings-form"
import { PreviewSettingsControls } from "@/components/settings/preview-settings-controls"
import { SettingsLoadFailure, SettingsSkeleton } from "@/components/settings/settings-states"
import { SettingsNav } from "@/components/settings/settings-nav"
import { PreviewNotice } from "@/components/shared/preview-notice"
import { getOrderSettings, getRestaurantProfile, settingsMode, settingsPreviewRefusesSaves } from "@/lib/settings/service"

export const metadata: Metadata = {
  title: "Order settings",
}

export default function OrderSettingsPage({ searchParams }: PageProps<"/settings/orders">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Order settings" description="The order types you offer, a minimum order, prep times and pickup codes." />
      <SettingsNav current="/settings/orders" />
      <Suspense fallback={<SettingsSkeleton label="Loading order settings" />}>
        <OrderSettingsView searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function OrderSettingsView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { preview } = await searchParams
  let loaded
  try {
    // The profile supplies the restaurant's currency and language for amounts.
    const [settings, profile] = await Promise.all([getOrderSettings(preview), getRestaurantProfile(preview)])
    loaded = { settings, profile }
  } catch (error) {
    return <SettingsLoadFailure error={error} retryHref="/settings/orders" />
  }
  const { settings, profile } = loaded
  const isPreview = settingsMode() === "preview"
  return (
    <div className="flex flex-col gap-5">
      {isPreview ? <PreviewNotice detail="Sample order settings for the preview restaurant." /> : null}
      {isPreview ? <PreviewSettingsControls refusesSaves={settingsPreviewRefusesSaves()} /> : null}
      <OrderSettingsForm key={settings.version} settings={settings} currency={profile.currency} locale={profile.locale} />
    </div>
  )
}
