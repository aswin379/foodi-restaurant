import { createApiClient, type SessionBase } from "@/api-client"
import { API_BASE_URL } from "@/lib/api/base-url"

export const AUTH_PATHS = {
  login: "/seller/auth/login",
  refresh: "/seller/auth/refresh",
  logout: "/seller/auth/logout",
}

/** The access token lives in memory; the refresh token is an HttpOnly cookie the browser sends itself. */
let accessToken: string | null = null
let onSessionLost: (() => void) | null = null
let activeRestaurantId: number | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function getActiveRestaurantId(): number | null {
  return activeRestaurantId
}

/**
 * Mirrors the token and active restaurant into cookies so server-side code (the API transport used by
 * server actions) can forward them. `undefined` keeps the current value, `null` clears it.
 */
export function syncAuthCookies(token?: string | null, restaurantId?: number | null) {
  if (typeof document === "undefined") return
  const tokenToSet = token !== undefined ? token : accessToken
  const idToSet = restaurantId !== undefined ? restaurantId : activeRestaurantId

  if (tokenToSet) {
    document.cookie = `foodi_seller_token=${tokenToSet}; path=/; max-age=86400; SameSite=Lax`
  } else if (token === null) {
    document.cookie = "foodi_seller_token=; path=/; max-age=0; SameSite=Lax"
  }

  if (idToSet !== undefined && idToSet !== null) {
    document.cookie = `foodi_seller_restaurant_id=${idToSet}; path=/; max-age=86400; SameSite=Lax`
  } else if (restaurantId === null) {
    document.cookie = "foodi_seller_restaurant_id=; path=/; max-age=0; SameSite=Lax"
  }
}

/** The restaurant requests act on. The API re-checks that this owner may use it on every request. */
export function setActiveRestaurantId(id: number | null) {
  activeRestaurantId = id
  syncAuthCookies(accessToken, id)
}

export function setSessionLostHandler(handler: (() => void) | null) {
  onSessionLost = handler
}

/** The one HTTP client for the sellers app (browser only; server code uses lib/api/transport.ts). */
export const http = createApiClient({
  baseURL: API_BASE_URL,
  appId: "seller",
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
  // The server's CSRF check on refresh/logout accepts only this value (also for the seller routes).
  csrfHeaderValue: "foodi-admin",
  authPaths: AUTH_PATHS,
  getAccessToken: () => {
    // Re-stamping the cookie on every request keeps its 24 h lifetime sliding, as before.
    if (accessToken) syncAuthCookies(accessToken, activeRestaurantId)
    return accessToken
  },
  setAccessToken: (token) => {
    accessToken = token
    syncAuthCookies(token, token === null ? undefined : activeRestaurantId)
  },
  onAuthFailure: () => onSessionLost?.(),
  getRestaurantId: () => activeRestaurantId,
  // onToast is intentionally not wired yet: screens still show their own errors (would double-toast).
})

export type { SessionBase }
