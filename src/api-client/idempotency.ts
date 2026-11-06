/**
 * One key per user action (a form shown, a button pressed), generated before the first attempt
 * and passed to every retry of that action, so the server can drop a duplicate.
 */
export function createIdempotencyKey(): string {
  return globalThis.crypto.randomUUID()
}
