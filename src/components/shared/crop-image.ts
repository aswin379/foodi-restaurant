export type CropArea = { x: number; y: number; width: number; height: number }

/** The longest side of a cropped image; keeps the JPEG far below the 2 MB upload limit. */
export const MAX_OUTPUT_PX = 1024

/**
 * Where the source image is drawn on the square output canvas. `area` is the crop frame in source-image pixels
 * (it can reach outside the image when the seller zooms out to fit a whole ID card; that part stays white).
 */
export function cropPlan(area: CropArea, imageWidth: number, imageHeight: number) {
  const scale = Math.min(1, MAX_OUTPUT_PX / area.width)
  return {
    size: Math.max(1, Math.round(area.width * scale)),
    dx: -area.x * scale,
    dy: -area.y * scale,
    dw: imageWidth * scale,
    dh: imageHeight * scale,
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("This image could not be read."))
    image.src = src
  })
}

/** Renders the crop frame to a square JPEG file. The canvas is square by construction. */
export async function cropToFile(src: string, area: CropArea, name: string): Promise<File> {
  const image = await loadImage(src)
  const plan = cropPlan(area, image.naturalWidth, image.naturalHeight)
  const canvas = document.createElement("canvas")
  canvas.width = plan.size
  canvas.height = plan.size
  const context = canvas.getContext("2d")
  if (!context) throw new Error("This image could not be processed.")
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, plan.size, plan.size)
  context.drawImage(image, plan.dx, plan.dy, plan.dw, plan.dh)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9))
  if (!blob) throw new Error("This image could not be processed.")
  return new File([blob], name, { type: "image/jpeg" })
}
