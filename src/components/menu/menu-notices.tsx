import { FlaskConical, PlugZap } from "lucide-react"

/** Shown whenever fixture data is on screen, so it can't pass for a live menu. */
export function MenuPreviewNotice() {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p className="leading-relaxed">
        <span className="font-semibold">Illustrative preview data.</span> This
        is a generated sample menu, not your restaurant&apos;s menu. The menu
        API isn&apos;t connected yet, so nothing here can be saved.
      </p>
    </div>
  )
}

/** Persistent reminder that edits on this screen are not saved anywhere. */
export function BackendPendingNotice({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-lg border bg-muted/60 px-4 py-3 text-sm text-muted-foreground"
    >
      <PlugZap aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p className="leading-relaxed">{children}</p>
    </div>
  )
}
