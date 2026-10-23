export type LoginField = "email" | "password"

export type LoginFieldErrors = Partial<Record<LoginField, string>>

export type LoginInput = {
  email: string
  password: string
}

// Pragmatic check: one "@", no spaces, and a dot in the domain part.
// The authentication backend remains the source of truth.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_EMAIL_LENGTH = 254

export function validateLoginInput({ email, password }: LoginInput) {
  const errors: LoginFieldErrors = {}
  const trimmedEmail = email.trim()

  if (!trimmedEmail) {
    errors.email = "Enter your email address."
  } else if (
    trimmedEmail.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(trimmedEmail)
  ) {
    errors.email = "Enter a valid email address, like name@restaurant.com."
  }

  if (!password) {
    errors.password = "Enter your password."
  }

  return errors
}
