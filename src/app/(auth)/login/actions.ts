"use server"

import { redirect } from "next/navigation"

import { authenticateRestaurantUser } from "@/lib/auth/authenticate"
import { validateLoginInput, type LoginFieldErrors } from "@/lib/auth/validation"

export type SignInState = {
  fieldErrors?: LoginFieldErrors
  formError?: string
}

const FAILURE_MESSAGES = {
  invalid_credentials:
    "That email and password combination didn't match our records. Check your details and try again.",
  not_configured:
    "Sign-in isn't available yet. The Foodi authentication service hasn't been connected to this app.",
  unavailable:
    "We couldn't sign you in right now. Please try again in a moment.",
} as const

export async function signIn(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const remember = formData.get("remember") === "on"

  // Re-validate on the server; client-side checks are only a convenience.
  const fieldErrors = validateLoginInput({ email, password })
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors }
  }

  let result
  try {
    result = await authenticateRestaurantUser({ email, password, remember })
  } catch {
    return { formError: FAILURE_MESSAGES.unavailable }
  }

  if (!result.ok) {
    return { formError: FAILURE_MESSAGES[result.reason] }
  }

  redirect(result.redirectTo)
}
