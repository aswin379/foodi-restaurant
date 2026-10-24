import { ImageIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** Decorative: the item name is always shown next to it. */
export function ItemThumbnail({
  imageUrl,
  className,
}: {
  imageUrl: string | null
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted text-muted-foreground",
        className
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote image hosts aren't configured yet
        <img src={imageUrl} alt="" className="size-full object-cover" />
      ) : (
        <ImageIcon className="size-4" />
      )}
    </span>
  )
}
