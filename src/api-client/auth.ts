import type { ApiClient } from './create-client'
import type { AuthPaths, SessionBase } from './types'

export interface AuthApi<S extends SessionBase> {
  login(credentials: { email: string; password: string }): Promise<S>
  /** Restores the session from the refresh cookie (call once on app load). */
  refresh(): Promise<S>
  /** Always clears the in-memory token, even if the request fails. */
  logout(): Promise<void>
}

/**
 * Login/refresh/logout against an app's own auth paths (`/auth/*` for admin, `/seller/auth/*` for sellers).
 * The session type is the app's; the client only needs `accessToken` out of it.
 */
export function createAuthApi<S extends SessionBase>(client: ApiClient, paths: AuthPaths): AuthApi<S> {
  return {
    async login(credentials) {
      // Credentials go in the body only; the client never logs request bodies.
      const session = await client.post<S>(paths.login, credentials, { public: true })
      client.setAccessToken(session.accessToken)
      return session
    },
    refresh: () => client.refreshSession<S>(),
    async logout() {
      try {
        await client.post<void>(paths.logout, undefined, { public: true, skipErrorToast: true })
      } finally {
        client.setAccessToken(null)
      }
    },
  }
}
