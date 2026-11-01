"use client"

import { useId, useState } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { ApplicationOptions } from "@/features/restaurants/types"

import { saveBusiness } from "../profile-service"
import type { RestaurantProfile } from "../types"
import { SectionForm, selectClass } from "./section-form"

/** Name, seller type, description, cuisines and tags. */
export function BusinessForm({
  profile,
  options,
  onSaved,
}: {
  profile: RestaurantProfile
  options: ApplicationOptions | null
  onSaved: (profile: RestaurantProfile) => void
}) {
  const id = useId()
  const [name, setName] = useState(profile.name)
  const [sellerTypeId, setSellerTypeId] = useState(profile.sellerTypeId)
  const [description, setDescription] = useState(profile.description ?? "")
  const [cuisineIds, setCuisineIds] = useState(profile.cuisines.map((c) => c.id))
  const [tags, setTags] = useState(profile.tags.join(", "))

  // The restaurant's own type and cuisines stay listed even if the lists have not loaded.
  const sellerTypes = options?.sellerTypes ?? [{ id: profile.sellerTypeId, name: profile.sellerType }]
  const cuisines = options?.cuisines ?? profile.cuisines

  async function save() {
    const cleanName = name.trim()
    if (!cleanName) throw new Error("Enter the restaurant name.")
    const tagList = tags.split(",").map((tag) => tag.trim()).filter(Boolean)
    if (tagList.length > 10) throw new Error("Use at most 10 tags.")
    onSaved(await saveBusiness({ sellerTypeId, name: cleanName, description, cuisineIds, tags: tagList }))
  }

  return (
    <SectionForm title="Restaurant details" description="Name, type, cuisines and description shown to customers." onSave={save}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${id}-name`}>Restaurant name</Label>
          <Input id={`${id}-name`} value={name} maxLength={191} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-type`}>Restaurant type</Label>
          <select
            id={`${id}-type`}
            value={sellerTypeId}
            onChange={(event) => setSellerTypeId(Number(event.target.value))}
            className={selectClass}
          >
            {sellerTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-description`}>Description</Label>
        <Textarea
          id={`${id}-description`}
          value={description}
          maxLength={2000}
          rows={4}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Cuisines</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {cuisines.map((cuisine) => (
            <label key={cuisine.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={cuisineIds.includes(cuisine.id)}
                onCheckedChange={(checked) =>
                  setCuisineIds((current) =>
                    checked === true ? [...current, cuisine.id] : current.filter((value) => value !== cuisine.id)
                  )
                }
              />
              {cuisine.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor={`${id}-tags`}>Tags</Label>
        <Input
          id={`${id}-tags`}
          value={tags}
          placeholder="Family friendly, Late night"
          onChange={(event) => setTags(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">Separate tags with commas (up to 10).</p>
      </div>
    </SectionForm>
  )
}
