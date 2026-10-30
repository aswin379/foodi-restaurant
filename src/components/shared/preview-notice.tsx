import { FlaskConical } from "lucide-react"

import {
  PREVIEW_DATA_DESCRIPTION,
  PREVIEW_ONLY_LABEL,
} from "@/lib/data-source/preview-copy"
import { cn } from "@/lib/utils"

/**
 * Shown on every screen that displays preview data or accepts simulated
 * changes, so neither can pass for real restaurant data (G1).
 */
export function PreviewNotice({
  detail,
  className,
}: {
  /** Optional module-specific sentence, e.g. how sample references look. */
  detail?: string
  className?: string
}) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900",
        className
      )}
    >
      <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p className="leading-relaxed">
        <span className="font-semibold">{PREVIEW_ONLY_LABEL}.</span>{" "}
        {PREVIEW_DATA_DESCRIPTION}
        {detail ? ` ${detail}` : null}
      </p>
    </div>
  )
}
