/**
 * Centre-crops an image to a square and returns it as a JPEG. The sellers app has no cropper dependency, so
 * the crop is automatic (the same approach as the menu image picker); the server also resizes to 512x512.
 */
export async function squareCrop(file: File, size = 800): Promise<File> {
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error("This image could not be read."))
      element.src = url
    })
    const side = Math.min(image.naturalWidth, image.naturalHeight)
    const out = Math.max(1, Math.min(side, size))
    const canvas = document.createElement("canvas")
    canvas.width = out
    canvas.height = out
    const context = canvas.getContext("2d")
    if (!context) throw new Error("This image could not be processed.")
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, out, out)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85))
    if (!blob) throw new Error("This image could not be processed.")
    return new File([blob], "profile.jpg", { type: "image/jpeg" })
  } finally {
    URL.revokeObjectURL(url)
  }
}
