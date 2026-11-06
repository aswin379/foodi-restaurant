"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { AlertCircle, CircleCheck, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { validateEmail } from "@/lib/auth/validation"
import { forgotPasswordRequest, resetPasswordRequest } from "@/features/auth/auth-api"

// Same rule as the API (shared password policy).
const MIN_PASSWORD_LENGTH = 10

type Step = "email" | "reset" | "done"
type Errors = Partial<Record<"email" | "otp" | "password", string>>

function validateReset(otp: string, password: string): Errors {
  const errors: Errors = {}
  if (!/^\d{6}$/.test(otp.trim())) errors.otp = "Enter the 6-digit code."
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  return errors
}

export function ForgotPasswordForm() {
  const id = useId()
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function run(action: () => Promise<void>, next: Step) {
    setFormError(null)
    setPending(true)
    try {
      await action()
      setStep(next)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Something went wrong. Please try again.")
    } finally {
      setPending(false)
    }
  }

  function handleEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const emailError = validateEmail(email)
    setErrors(emailError ? { email: emailError } : {})
    if (emailError) return
    void run(() => forgotPasswordRequest(email.trim()), "reset")
  }

  function handleReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const next = validateReset(otp, password)
    setErrors(next)
    if (Object.keys(next).length > 0) return
    void run(
      () => resetPasswordRequest({ email: email.trim(), otp: otp.trim(), password }),
      "done"
    )
  }

  if (step === "done") {
    return (
      <div className="space-y-5">
        <p role="status" className="flex gap-3 rounded-2xl border border-success-line bg-success-soft px-4 py-3 text-sm text-success-foreground">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          Your password has been reset. You can now sign in.
        </p>
        <Button asChild size="lg" className="h-11 w-full rounded-xl">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    )
  }

  const errorBanner = formError ? (
    <div role="alert" className="flex gap-3 rounded-2xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger-foreground">
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p className="leading-relaxed">{formError}</p>
    </div>
  ) : null

  if (step === "email") {
    return (
      <form onSubmit={handleEmail} noValidate aria-busy={pending} className="space-y-5">
        {errorBanner}
        <Field id={`${id}-email`} label="Email address" error={errors.email}>
          <Input
            id={`${id}-email`}
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="name@restaurant.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? `${id}-email-error` : undefined}
            className="h-11 rounded-xl bg-white px-3.5 shadow-none"
          />
        </Field>
        <SubmitButton pending={pending} label="Send code" pendingLabel="Sending…" />
        <BackToSignIn />
      </form>
    )
  }

  return (
    <form onSubmit={handleReset} noValidate aria-busy={pending} className="space-y-5">
      {errorBanner}
      <p className="text-sm text-muted-foreground">
        If an account exists for <span className="font-medium text-foreground">{email.trim()}</span>, a
        6-digit code has been sent.
      </p>
      <Field id={`${id}-otp`} label="6-digit code" error={errors.otp}>
        <Input
          id={`${id}-otp`}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
          aria-invalid={errors.otp ? true : undefined}
          aria-describedby={errors.otp ? `${id}-otp-error` : undefined}
          className="h-11 rounded-xl bg-white px-3.5 tracking-widest shadow-none"
        />
      </Field>
      <Field id={`${id}-password`} label="New password" error={errors.password}>
        <Input
          id={`${id}-password`}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? `${id}-password-error` : undefined}
          className="h-11 rounded-xl bg-white px-3.5 shadow-none"
        />
      </Field>
      <SubmitButton pending={pending} label="Reset password" pendingLabel="Resetting…" />
      <BackToSignIn />
    </form>
  )
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-sm text-danger-foreground">
          <AlertCircle aria-hidden className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  )
}

function SubmitButton({
  pending,
  label,
  pendingLabel,
}: {
  pending: boolean
  label: string
  pendingLabel: string
}) {
  return (
    <Button type="submit" size="lg" disabled={pending} className="h-11 w-full rounded-xl text-[15px] font-semibold">
      {pending ? (
        <>
          <Loader2 aria-hidden className="animate-spin" />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  )
}

function BackToSignIn() {
  return (
    <p className="text-center text-sm">
      <Link href="/login" className="font-medium text-primary-text underline-offset-4 hover:underline">
        Back to sign in
      </Link>
    </p>
  )
}
