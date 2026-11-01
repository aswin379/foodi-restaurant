"use client"

import { useId, useState } from "react"
import { AlertCircle, KeyRound, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/features/auth/auth-context"

import { changeOwnPassword } from "../staff-service"
import { PASSWORD_MIN } from "../validation"

/**
 * Shown instead of the dashboard while a staff member still has the password an owner chose for them.
 * The server does not block other requests meanwhile; this only guides the person to set their own.
 */
export function ChangePasswordGate({ children }: { children: React.ReactNode }) {
  const { user, markPasswordChanged } = useAuth()
  const id = useId()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!(user?.role === "staff" && user.mustChangePassword)) return <>{children}</>

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    if (next.length < PASSWORD_MIN) {
      setError(`Use at least ${PASSWORD_MIN} characters for the new password.`)
      return
    }
    setPending(true)
    setError(null)
    try {
      await changeOwnPassword(current, next)
      markPasswordChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change the password.")
      setPending(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4">
      <form onSubmit={submit} noValidate aria-busy={pending} className="w-full max-w-md space-y-5 rounded-3xl bg-card p-6 shadow-[0_8px_30px_rgb(31_26_23/6%)]">
        <div className="space-y-1.5">
          <span className="grid size-10 place-items-center rounded-xl bg-sage-soft text-sage-foreground">
            <KeyRound aria-hidden className="size-5" />
          </span>
          <h1 className="text-xl font-semibold">Choose your password</h1>
          <p className="text-sm text-muted-foreground">Your restaurant owner set a temporary password. Choose your own to continue.</p>
        </div>
        {error ? (
          <div role="alert" className="flex gap-3 rounded-2xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger-foreground">
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor={`${id}-current`}>Temporary password</Label>
          <Input id={`${id}-current`} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="h-11 rounded-xl bg-white px-3.5 shadow-none" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-new`}>New password</Label>
          <Input id={`${id}-new`} type="password" autoComplete="new-password" maxLength={128} value={next} onChange={(e) => setNext(e.target.value)} className="h-11 rounded-xl bg-white px-3.5 shadow-none" />
          <p className="text-xs text-muted-foreground">At least {PASSWORD_MIN} characters.</p>
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? (
            <>
              <Loader2 aria-hidden className="animate-spin" />
              Saving…
            </>
          ) : (
            "Save and continue"
          )}
        </Button>
      </form>
    </main>
  )
}
