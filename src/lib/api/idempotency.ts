// Every mutation form carries one idempotency key, generated when the form is
// shown, so a double submit or a retry can't apply the same change twice
// (PRD §7). The key format the backend accepts is still a §9.1 contract.

export const IDEMPOTENCY_FIELD = "idempotencyKey"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function createIdempotencyKey(): string {
  return crypto.randomUUID()
}

export function isIdempotencyKey(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value)
}

/** The key submitted with a form, or null if it's missing or malformed. */
export function readIdempotencyKey(formData: FormData): string | null {
  const value = formData.get(IDEMPOTENCY_FIELD)
  return isIdempotencyKey(value) ? value : null
}
