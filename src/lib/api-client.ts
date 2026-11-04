// Compatibility layer: the old `api()` surface, now backed by the shared client in ./http.
// Services are being moved to `http` directly; this file is deleted once nothing imports it.
import { ApiError } from "@/api-client"
import { authApi, forgotPasswordRequest, resetPasswordRequest } from "@/features/auth/auth-api"
import {
  getAccessToken,
  getActiveRestaurantId,
  http,
  setActiveRestaurantId,
  setSessionLostHandler,
  syncAuthCookies,
} from "./http"

export {
  ApiError,
  forgotPasswordRequest,
  getAccessToken,
  getActiveRestaurantId,
  resetPasswordRequest,
  setActiveRestaurantId,
  setSessionLostHandler,
  syncAuthCookies,
}

export const setAccessToken = http.setAccessToken
export const refreshSession = () => authApi.refresh()
export const loginRequest = (email: string, password: string) => authApi.login({ email, password })
export const logoutRequest = () => authApi.logout()

/** Authenticated JSON request. On 401 the client refreshes once and replays; if that fails the session ends. */
export function api<T>(
  path: string,
  init: { method?: string; body?: unknown; restaurantScoped?: boolean } = {}
): Promise<T> {
  const options = { restaurantScoped: init.restaurantScoped }
  switch ((init.method ?? "GET").toUpperCase()) {
    case "GET":
      return http.get<T>(path, options)
    case "POST":
      return http.post<T>(path, init.body, options)
    case "PUT":
      return http.put<T>(path, init.body, options)
    case "PATCH":
      return http.patch<T>(path, init.body, options)
    case "DELETE":
      return http.delete<T>(path, options)
    default:
      throw new Error(`Unsupported method ${init.method}`)
  }
}
