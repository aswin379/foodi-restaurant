import { FlaskConical } from "lucide-react"

/** Shown whenever fixture data is on screen, so it can't pass for live orders. */
export function PreviewDataNotice() {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p className="leading-relaxed">
        <span className="font-semibold">Illustrative preview data.</span> These
        are generated sample orders (references start with PRV-), not real
        restaurant orders. The orders API isn&apos;t connected yet.
      </p>
    </div>
  )
}
