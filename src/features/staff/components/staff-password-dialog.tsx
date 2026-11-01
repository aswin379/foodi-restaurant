"use client"

import { useId, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { resetStaffPassword } from "../staff-service"
import type { StaffMember } from "../types"
import { PASSWORD_MIN } from "../validation"

/** The owner chooses a new temporary password; the staff member must replace it at next sign-in. */
export function StaffPasswordDialog({
  staff,
  onClose,
  onDone,
}: {
  staff: StaffMember | null
  onClose: () => void
  onDone: (staff: StaffMember) => void
}) {
  return (
    <Dialog open={staff !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {staff ? <PasswordForm key={staff.id} staff={staff} onClose={onClose} onDone={onDone} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function PasswordForm({ staff, onClose, onDone }: { staff: StaffMember; onClose: () => void; onDone: (staff: StaffMember) => void }) {
  const id = useId()
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    if (password.length < PASSWORD_MIN) {
      setError(`Use at least ${PASSWORD_MIN} characters.`)
      return
    }
    setPending(true)
    setError(null)
    try {
      await resetStaffPassword(staff.id, password)
      onDone(staff)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset the password.")
      setPending(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Reset password</DialogTitle>
        <DialogDescription>
          Set a new temporary password for {staff.name}. They will be signed out everywhere and must choose their own password next time.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} noValidate aria-busy={pending} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${id}-password`}>Temporary password</Label>
          <Input
            id={`${id}-password`}
            type="password"
            autoComplete="new-password"
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className="h-11 rounded-xl bg-white px-3.5 shadow-none"
          />
          {error ? (
            <p id={`${id}-error`} role="alert" className="flex items-center gap-1.5 text-sm text-danger-foreground">
              <AlertCircle aria-hidden className="size-3.5 shrink-0" />
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Loader2 aria-hidden className="animate-spin" />
                Saving…
              </>
            ) : (
              "Reset password"
            )}
          </Button>
        </div>
      </form>
    </>
  )
}
