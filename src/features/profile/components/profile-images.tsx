"use client"

import { useId, useRef, useState } from "react"
import { CircleAlert, Loader2 } from "lucide-react"

import { notify } from "@/components/shared/notifications"
import { Button } from "@/components/ui/button"

import { removeImage, uploadImage } from "../profile-service"
import type { ImageSlot, RestaurantProfile } from "../types"

const MAX_BYTES = 2 * 1024 * 1024
const ACCEPT = "image/jpeg,image/png,image/webp"

const SLOTS: Array<{ slot: ImageSlot; label: string; hint: string; frame: string }> = [
  { slot: "logo", label: "Logo", hint: "3:2, shown on your menu and in lists.", frame: "aspect-[3/2] w-48" },
  { slot: "cover", label: "Cover image", hint: "3:1 banner at the top of your page.", frame: "aspect-[3/1] w-full max-w-md" },
]

/** Logo and cover. The API checks the file, resizes it and replaces the old one. */
export function ProfileImages({
  profile,
  onSaved,
}: {
  profile: RestaurantProfile
  onSaved: (profile: RestaurantProfile) => void
}) {
  return (
    <section aria-label="Images" className="flex flex-col gap-5 rounded-2xl bg-card p-5 shadow-[0_8px_30px_rgb(31_26_23/6%)]">
      <div>
        <h2 className="text-lg font-semibold">Images</h2>
        <p className="mt-1 text-sm text-muted-foreground">JPG, PNG or WebP, up to 2 MB.</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        {SLOTS.map((entry) => (
          <ImageSlotEditor
            key={entry.slot}
            {...entry}
            url={entry.slot === "logo" ? profile.logoUrl : profile.coverUrl}
            name={profile.name}
            onSaved={onSaved}
          />
        ))}
      </div>
    </section>
  )
}

function ImageSlotEditor({
  slot,
  label,
  hint,
  frame,
  url,
  name,
  onSaved,
}: {
  slot: ImageSlot
  label: string
  hint: string
  frame: string
  url: string | null
  name: string
  onSaved: (profile: RestaurantProfile) => void
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<RestaurantProfile>, done: string) {
    setError(null)
    setPending(true)
    try {
      onSaved(await action())
      notify({ kind: "success", title: done, preview: false })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setPending(false)
    }
  }

  function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!ACCEPT.split(",").includes(file.type)) return setError("Choose a JPG, PNG or WebP image.")
    if (file.size > MAX_BYTES) return setError("The image must be 2 MB or smaller.")
    void run(() => uploadImage(slot, file), `${label} updated`)
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      <div className={`${frame} overflow-hidden rounded-xl border bg-muted`}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- presigned storage URL
          <img src={url} alt={`${name} ${slot}`} className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-xs text-muted-foreground">No {slot} yet</div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-danger-foreground">
          <CircleAlert aria-hidden className="size-4" />
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <input ref={input} id={id} type="file" accept={ACCEPT} hidden aria-label={`${label} file`} onChange={choose} />
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => input.current?.click()}>
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
          {url ? `Change ${slot}` : `Upload ${slot}`}
        </Button>
        {url ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => void run(() => removeImage(slot), `${label} removed`)}
          >
            Remove {slot}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
