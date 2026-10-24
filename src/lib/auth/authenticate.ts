import "server-only"

export type AuthenticateRequest = {
  email: string
  password: string
  remember: boolean
}

export type AuthenticateResult =
  | { ok: true; redirectTo: string }
  | {
      ok: false
      reason: "invalid_credentials" | "not_configured" | "unavailable"
    }

/**
 * Integration point for the Foodi restaurant authentication backend.
 *
 * No authentication API exists in this repository yet, so this function never
 * signs anyone in. To connect it:
 *   1. Call the real Foodi auth endpoint from here (server-side only).
 *   2. Establish the session using the backend's mechanism, e.g. forwarding its
 *      httpOnly cookie via `cookies()` from `next/headers`. Never return tokens
 *      to the client or store them in localStorage.
 *   3. Honour `remember` only if the backend supports long-lived sessions.
 *   4. Return the restaurant dashboard route the backend authorises for this
 *      user (respecting role / tenant / restaurant access) as `redirectTo`.
 *   5. Map backend failures to `invalid_credentials` or `unavailable` without
 *      leaking backend details.
 */
export async function authenticateRestaurantUser(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _request: AuthenticateRequest
): Promise<AuthenticateResult> {
  return { ok: false, reason: "not_configured" }
}
