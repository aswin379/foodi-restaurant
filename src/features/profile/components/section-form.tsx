"use client"

import { useState } from "react"
import { CircleAlert, Loader2 } from "lucide-react"

import { notify } from "@/components/shared/notifications"
import { Button } from "@/components/ui/button"

export const selectClass = "h-9 w-full rounded-md border bg-white px-3 text-sm"

/** A whole number from a text field, or NaN when it is empty or not a number. */
export const toNumber = (value: string): number => (value.trim() === "" ? Number.NaN : Number(value))

/**
 * One card of the profile with its own Save button. `onSave` throws an Error with a message the owner can read
 * (a failed check or the API's answer); it is shown above the button and the card stays editable.
 */
export function SectionForm({
  title,
  description,
  onSave,
  children,
}: {
  title: string
  description?: string
  onSave: () => Promise<void>
  children: React.ReactNode
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setError(null)
    setPending(true)
    try {
      await onSave()
      notify({ kind: "success", title: `${title} saved`, preview: false })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-busy={pending}
      aria-label={title}
      className="flex flex-col gap-5 rounded-2xl bg-card p-5 shadow-[0_8px_30px_rgb(31_26_23/6%)]"
    >
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-danger-foreground">
          <CircleAlert aria-hidden className="size-4" />
          {error}
        </p>
      ) : null}
      {children}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 aria-hidden className="animate-spin" />
              Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </form>
  )
}
