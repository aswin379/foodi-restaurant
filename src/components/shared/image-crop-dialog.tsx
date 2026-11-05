"use client"

import { useCallback, useEffect, useState } from "react"
import Cropper, { type Area } from "react-easy-crop"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import { cropToFile, loadImage } from "./crop-image"

type Props = {
  /** The picked image; the dialog is open while this is set. */
  file: File | null
  title: string
  /** Shown under the title, e.g. "Image 2 of 3". */
  description?: string
  confirmLabel?: string
  onCancel: () => void
  /** Receives the cropped square image as a JPEG file. */
  onConfirm: (cropped: File) => void
}

/**
 * Square crop with a live frame, so the seller sees exactly what is kept. Zooming out below 1 (or "Fit whole
 * image") keeps the whole picture and pads the rest with white, so an ID card does not lose text at its edges.
 */
function CropBody({ file, title, description, confirmLabel = "Use image", onCancel, onConfirm }: Props & { file: File }) {
  const [src, setSrc] = useState<string | null>(null)
  const [fitZoom, setFitZoom] = useState(1)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // Data URL (not an object URL) so nothing needs revoking; state resets through the `key` on CropBody.
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null
      setSrc(result)
      if (result) {
        loadImage(result)
          .then((image) => {
            // With a square frame the zoom that shows the whole image is short side / long side.
            const ratio = Math.min(image.naturalWidth, image.naturalHeight) / Math.max(image.naturalWidth, image.naturalHeight)
            setFitZoom(Math.min(1, Math.max(0.1, ratio)))
          })
          .catch(() => setError("This image could not be read."))
      }
    }
    reader.readAsDataURL(file)
    return () => reader.abort()
  }, [file])

  const onComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), [])

  async function confirm() {
    if (!src || !area || busy) return
    setBusy(true)
    try {
      onConfirm(await cropToFile(src, area, "image.jpg"))
    } catch {
      setError("Could not crop this image. Try another one.")
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description ?? "Drag to reposition. Use the slider to zoom."}</DialogDescription>
        </DialogHeader>
        <div className="relative h-72 w-full overflow-hidden rounded-lg bg-muted">
          {src ? (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              minZoom={fitZoom}
              maxZoom={3}
              aspect={1}
              cropShape="rect"
              restrictPosition={zoom >= 1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onComplete}
            />
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={fitZoom}
            max={3}
            step={0.05}
            value={zoom}
            aria-label="Zoom"
            onChange={(event) => setZoom(Number(event.target.value))}
            className="w-full"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setZoom(fitZoom)
              setCrop({ x: 0, y: 0 })
            }}
          >
            Fit whole image
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger-foreground">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={!area || busy} onClick={() => void confirm()}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ImageCropDialog(props: Props) {
  const { file } = props
  if (!file) return null
  return <CropBody key={`${file.name}-${file.size}-${file.lastModified}`} {...props} file={file} />
}
