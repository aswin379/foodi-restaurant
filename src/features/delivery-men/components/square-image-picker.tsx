"use client"

import { useEffect, useState } from "react"
import { ImagePlus, X } from "lucide-react"

import { ImageCropDialog } from "@/components/shared/image-crop-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { IMAGE_SOURCE_TYPES, checkSourceImage } from "../validation"

function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!file) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the object URL only exists on the client
      setUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])
  return url
}

const boxBase =
  "flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-primary hover:bg-primary-faint"

function Thumb({ file, label, onRemove }: { file: File; label: string; onRemove: () => void }) {
  const url = useObjectUrl(file)
  return (
    <li className="relative">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob preview
        <img src={url} alt={label} className="size-24 rounded-xl border object-cover" />
      ) : (
        <span className="block size-24 rounded-xl border bg-muted" />
      )}
      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="absolute -top-2 -right-2 size-6 rounded-full"
      >
        <X aria-hidden />
      </Button>
    </li>
  )
}

/**
 * Picks images and crops each one to a square before it is kept, so the seller sees what is sent. Images are
 * cropped one at a time. `avatar` is one large square box (the profile photo; a new pick replaces it);
 * `gallery` is a dashed box of square thumbnails with an "Add image" tile until `max` is reached.
 */
export function SquareImagePicker({
  variant,
  id,
  name,
  files,
  max,
  onChange,
}: {
  variant: "avatar" | "gallery"
  id: string
  /** What the images are, e.g. "Identity image"; used in the crop title and the thumbnail labels. */
  name: string
  files: File[]
  max: number
  onChange: (files: File[]) => void
}) {
  const [queue, setQueue] = useState<File[]>([])
  const [batch, setBatch] = useState(0)
  const [pickError, setPickError] = useState<string | null>(null)
  const photoUrl = useObjectUrl(variant === "avatar" ? (files[0] ?? null) : null)

  function pick(input: HTMLInputElement) {
    const picked = Array.from(input.files ?? [])
    input.value = "" // lets the same file be picked again
    if (picked.length === 0) return
    const room = max === 1 ? 1 : max - files.length
    if (picked.length > room) {
      setPickError(room <= 0 ? `You already added ${max} images.` : `You can add ${room} more ${room === 1 ? "image" : "images"}.`)
      return
    }
    const problem = picked.map(checkSourceImage).find((message) => message !== null)
    if (problem) {
      setPickError(problem)
      return
    }
    setPickError(null)
    setBatch(picked.length)
    setQueue(picked)
  }

  const current = queue[0] ?? null
  const position = batch - queue.length + 1
  const full = files.length >= max

  return (
    <div className="flex flex-col gap-2 rounded-2xl focus-within:ring-2 focus-within:ring-ring">
      {/* The real input is visually hidden; the box below is its label, so a click or Enter opens the file picker. */}
      <input
        id={id}
        type="file"
        multiple={max > 1}
        accept={IMAGE_SOURCE_TYPES.join(",")}
        onChange={(event) => pick(event.target)}
        className="sr-only"
      />
      {variant === "avatar" ? (
        <div className="flex items-center gap-4">
          <label htmlFor={id} className={cn(boxBase, "relative size-40 shrink-0 flex-col gap-2 overflow-hidden")}>
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              <img src={photoUrl} alt={name} className="size-full object-cover" />
            ) : (
              <>
                <ImagePlus aria-hidden className="size-8" />
                <span className="px-2 text-center text-sm font-medium">Click to upload photo</span>
              </>
            )}
          </label>
          {files[0] ? (
            <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground">
              <span>Click the photo to change it.</span>
              <Button type="button" variant="outline" size="sm" onClick={() => onChange([])}>
                Remove photo
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-border p-4">
          <ul className="flex flex-wrap gap-4">
            {files.map((file, index) => (
              <Thumb
                key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                file={file}
                label={`${name} ${index + 1}`}
                onRemove={() => onChange(files.filter((_, i) => i !== index))}
              />
            ))}
            {!full ? (
              <li>
                <label htmlFor={id} className={cn(boxBase, "size-24 flex-col gap-1")}>
                  <ImagePlus aria-hidden className="size-6" />
                  <span className="text-xs font-medium">Add image</span>
                </label>
              </li>
            ) : null}
          </ul>
          <p className="text-xs text-muted-foreground">
            {files.length} of {max} added. Each image is cropped to a square.
          </p>
        </div>
      )}
      {pickError ? (
        <p role="alert" className="text-xs text-danger-foreground">
          {pickError}
        </p>
      ) : null}
      <ImageCropDialog
        file={current}
        title={`Crop ${name.toLowerCase()}`}
        description={batch > 1 ? `Image ${position} of ${batch}. Drag to reposition, use the slider to zoom.` : undefined}
        onCancel={() => setQueue((q) => q.slice(1))}
        onConfirm={(cropped) => {
          onChange(max === 1 ? [cropped] : [...files, cropped])
          setQueue((q) => q.slice(1))
        }}
      />
    </div>
  )
}
