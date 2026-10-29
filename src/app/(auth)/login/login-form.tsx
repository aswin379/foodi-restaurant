"use client"

import {
  startTransition,
  useActionState,
  useId,
  useRef,
  useState,
} from "react"
import Link from "next/link"
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authLinks } from "@/lib/auth/routes"
import {
  validateLoginInput,
  type LoginField,
  type LoginFieldErrors,
} from "@/lib/auth/validation"
import { cn } from "@/lib/utils"

import { signIn, type SignInState } from "./actions"

const initialState: SignInState = {}

export function LoginForm() {
  const id = useId()
  const emailId = `${id}-email`
  const passwordId = `${id}-password`
  const rememberId = `${id}-remember`
  const emailErrorId = `${emailId}-error`
  const passwordErrorId = `${passwordId}-error`
  const formErrorId = `${id}-form-error`

  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<LoginFieldErrors>({})

  const [state, formAction, pending] = useActionState(
    async (prevState: SignInState, formData: FormData) => {
      const result = await signIn(prevState, formData)
      setErrors(result.fieldErrors ?? {})
      return result
    },
    initialState
  )

  function focusFirstInvalid(fieldErrors: LoginFieldErrors) {
    if (fieldErrors.email) emailRef.current?.focus()
    else if (fieldErrors.password) passwordRef.current?.focus()
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Dispatch manually so React doesn't reset the form after the action:
    // a failed attempt should leave the user's input in place.
    event.preventDefault()
    if (pending) return

    const fieldErrors = validateLoginInput({ email, password })
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors)
      focusFirstInvalid(fieldErrors)
      return
    }

    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  // Re-check a field when it loses focus, but only once it holds an error,
  // so users aren't scolded while still typing for the first time.
  function revalidate(field: LoginField, values = { email, password }) {
    if (!errors[field]) return
    const next = validateLoginInput(values)
    setErrors((current) => ({ ...current, [field]: next[field] }))
  }

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      aria-busy={pending}
      aria-describedby={state.formError ? formErrorId : undefined}
      className="space-y-5"
    >
      {state.formError && !pending ? (
        <div
          id={formErrorId}
          role="alert"
          className="flex gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p className="leading-relaxed">{state.formError}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={emailId}>Email address</Label>
        <Input
          ref={emailRef}
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="name@restaurant.com"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            if (errors.email) {
              revalidate("email", { email: event.target.value, password })
            }
          }}
          onBlur={() => revalidate("email")}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? emailErrorId : undefined}
          className="h-11 rounded-xl bg-white px-3.5 shadow-none"
        />
        <FieldError id={emailErrorId} message={errors.email} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor={passwordId}>Password</Label>
          {authLinks.forgotPassword ? (
            <Link
              href={authLinks.forgotPassword}
              className="rounded-sm text-sm font-medium text-primary-text underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Forgot password?
            </Link>
          ) : null}
        </div>
        <div className="relative">
          <Input
            ref={passwordRef}
            id={passwordId}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              if (errors.password) {
                revalidate("password", { email, password: event.target.value })
              }
            }}
            onBlur={() => revalidate("password")}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? passwordErrorId : undefined}
            className="h-11 rounded-xl bg-white pr-12 pl-3.5 shadow-none"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            aria-controls={passwordId}
            className="absolute top-1/2 right-1 size-9 -translate-y-1/2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </Button>
        </div>
        <FieldError id={passwordErrorId} message={errors.password} />
      </div>

      <div className="flex items-center gap-2.5">
        <Checkbox
          id={rememberId}
          name="remember"
          checked={remember}
          onCheckedChange={(checked) => setRemember(checked === true)}
          className="size-[18px]"
        />
        <Label
          htmlFor={rememberId}
          className="cursor-pointer font-normal text-muted-foreground"
        >
          Keep me signed in on this device
        </Label>
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="h-11 w-full rounded-xl text-[15px] font-semibold shadow-sm shadow-primary/20 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/20 active:translate-y-px"
      >
        {pending ? (
          <>
            <Loader2 aria-hidden className="animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in to dashboard"
        )}
      </Button>
      <p aria-live="polite" className="sr-only">
        {pending ? "Signing in, please wait." : ""}
      </p>
    </form>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <p
      id={id}
      className={cn(
        "flex items-center gap-1.5 text-sm text-destructive",
        !message && "hidden"
      )}
    >
      {message ? (
        <>
          <AlertCircle aria-hidden className="size-3.5 shrink-0" />
          {message}
        </>
      ) : null}
    </p>
  )
}
