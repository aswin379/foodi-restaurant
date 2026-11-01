"use client"

import { useCallback, useEffect, useState } from "react"
import { CircleAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { BranchList } from "@/features/branches/components/branch-list"
import { useRestaurants } from "@/features/restaurants/restaurant-context"
import type { ApplicationOptions } from "@/features/restaurants/types"

import { getProfile, getProfileOptions } from "../profile-service"
import type { RestaurantProfile } from "../types"
import { BusinessForm } from "./business-form"
import { DeliveryForm } from "./delivery-form"
import { LocationForm } from "./location-form"
import { OptionsForm } from "./options-form"
import { ProfileImages } from "./profile-images"

/**
 * The selected restaurant's real profile, editable by section. The dashboard remounts this when the owner
 * switches restaurant (RequireRestaurant keys on the id), so it can never show another restaurant's data.
 */
export function RestaurantProfileView() {
  const { active } = useRestaurants()
  const [profile, setProfile] = useState<RestaurantProfile | null>(null)
  const [options, setOptions] = useState<ApplicationOptions | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setProfile(await getProfile())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the restaurant profile.")
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    void load()
    // The lists only fill the pickers; the forms still work with the restaurant's own values if they fail.
    getProfileOptions().then(setOptions, () => setOptions(null))
  }, [load])

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-danger-line bg-danger-soft px-4 py-4 text-sm text-danger-foreground">
        <p className="flex items-center gap-2">
          <CircleAlert aria-hidden className="size-4" />
          {error}
        </p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    )
  }

  if (!profile) {
    return (
      <div role="status" aria-label="Loading profile" className="flex flex-col gap-3">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    )
  }

  // The forms keep their own text while the owner types; each save replaces `profile` with the saved version.
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="truncate text-lg font-semibold">{profile.name}</h2>
        <Badge variant={profile.status === "APPROVED" ? "secondary" : "outline"}>
          {profile.status === "APPROVED" ? "Approved" : profile.status}
        </Badge>
        <p className="text-sm text-muted-foreground">
          {[profile.sellerType, profile.cuisines.map((c) => c.name).join(", "), profile.address.zone]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <ProfileImages profile={profile} onSaved={setProfile} />
      <BusinessForm profile={profile} options={options} onSaved={setProfile} />
      <LocationForm profile={profile} onSaved={setProfile} />
      <DeliveryForm profile={profile} onSaved={setProfile} />
      <OptionsForm profile={profile} onSaved={setProfile} />
      <BranchList embedded key={active?.id} />
    </div>
  )
}
