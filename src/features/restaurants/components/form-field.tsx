import { Label } from "@/components/ui/label"

/** Accessibility attributes that tie a control to its error message. */
export function ariaFor(htmlId: string, error?: string) {
  return {
    id: htmlId,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${htmlId}-error` : undefined,
  }
}

/** A labelled control with its validation message; shared by every section of the restaurant forms. */
export function Field({
  htmlId,
  label,
  error,
  required,
  hint,
  children,
}: {
  htmlId: string
  label: string
  error?: string
  /** Marks the label with an asterisk; the rules themselves are checked by the form. */
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlId}>
        {label}
        {required ? <span aria-hidden className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p id={`${htmlId}-error`} className="text-xs text-danger-foreground">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** A titled card holding one section of a restaurant form; the same look as the profile sections. */
export function FormCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-5 rounded-2xl bg-card p-5 shadow-[0_8px_30px_rgb(31_26_23/6%)] sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}
