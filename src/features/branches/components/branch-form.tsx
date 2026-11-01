"use client"

import { useId, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { createBranch, updateBranch } from "../branch-service"
import type { Branch } from "../types"

const MIN_LENGTH = 2
const MAX_LENGTH = 120

function validateName(value: string): string | null {
  const name = value.trim()
  if (!name) return "Enter the branch name."
  if (name.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters.`
  if (name.length > MAX_LENGTH) return `Use at most ${MAX_LENGTH} characters.`
  return null
}

type BranchFormProps = {
  /** The branch being edited; omit to add a new one. */
  branch?: Branch
  onSaved: (branch: Branch) => void
  onCancel: () => void
}

export function BranchForm({ branch, onSaved, onCancel }: BranchFormProps) {
  const id = useId()
  const nameId = `${id}-name`
  const errorId = `${nameId}-error`

  const [name, setName] = useState(branch?.name ?? "")
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const invalid = validateName(name)
    setFieldError(invalid)
    setFormError(null)
    if (invalid) return

    setPending(true)
    try {
      const trimmed = name.trim()
      const saved = branch
        ? await updateBranch(branch.id, { name: trimmed })
        : await createBranch({ name: trimmed })
      onSaved(saved)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Something went wrong. Please try again.")
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={pending} className="space-y-5">
      {formError ? (
        <div
          role="alert"
          className="flex gap-3 rounded-2xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger-foreground"
        >
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p className="leading-relaxed">{formError}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={nameId}>Branch name</Label>
        <Input
          id={nameId}
          name="name"
          autoComplete="off"
          maxLength={MAX_LENGTH}
          required
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            if (fieldError) setFieldError(validateName(event.target.value))
          }}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? errorId : undefined}
          className="h-11 rounded-xl bg-white px-3.5 shadow-none"
        />
        {fieldError ? (
          <p id={errorId} className="flex items-center gap-1.5 text-sm text-danger-foreground">
            <AlertCircle aria-hidden className="size-3.5 shrink-0" />
            {fieldError}
          </p>
        ) : null}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 aria-hidden className="animate-spin" />
              Saving…
            </>
          ) : branch ? (
            "Save changes"
          ) : (
            "Add branch"
          )}
        </Button>
      </div>
    </form>
  )
}
