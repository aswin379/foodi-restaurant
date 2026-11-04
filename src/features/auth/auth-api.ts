import { createAuthApi } from "@/api-client"
import { AUTH_PATHS, http, setActiveRestaurantId } from "@/lib/http"
import type { Session } from "./types"

const base = createAuthApi<Session>(http, AUTH_PATHS)

export const authApi = {
  login: base.login,
  refresh: base.refresh,
  /** Signing out also forgets the active restaurant. */
  async logout() {
    try {
      await base.logout()
    } finally {
      setActiveRestaurantId(null)
    }
  },
}

/** Public calls: no token is sent and a 401 never triggers a session refresh. */
function postPublic(path: string, body: unknown): Promise<void> {
  return http.post<void>(path, body, { public: true })
}

/** Asks for a reset code. The server answers the same whether or not the email has an account. */
export function forgotPasswordRequest(email: string): Promise<void> {
  return postPublic("/seller/auth/forgot-password", { email })
}

export function resetPasswordRequest(input: { email: string; otp: string; password: string }): Promise<void> {
  return postPublic("/seller/auth/reset-password", input)
}
