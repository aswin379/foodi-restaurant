export type AppId = 'admin' | 'seller'

/** The backend envelope: `{ success: true, data }` or `{ success: false, error }`. */
export interface Envelope<T> {
  success: boolean
  data?: T
  error?: { code?: string; message?: string; details?: unknown }
}

export interface ToastMessage {
  type: 'error' | 'warning'
  message: string
  status: number
  code: string
}

/** What `/auth/refresh` and login return that the client itself needs. Apps extend it with the user. */
export interface SessionBase {
  accessToken: string
}

export interface AuthPaths {
  login: string
  refresh: string
  logout: string
}

export interface ApiClientConfig {
  /** Full API base including the version prefix, e.g. `${VITE_API_URL}/api/v1`. */
  baseURL: string
  appId: AppId
  appVersion?: string
  /** Value of `X-Requested-With`; the server's CSRF check on refresh/logout decides which value is accepted. */
  csrfHeaderValue: string
  authPaths: AuthPaths
  /** The access token lives in memory only; the app owns the store. */
  getAccessToken: () => string | null
  setAccessToken: (token: string | null) => void
  /** Called once when a refresh fails after a 401: the session is over (clear user state, go to login). */
  onAuthFailure: () => void
  /** Global toast for 403, 429, 5xx, network and timeout. Omit to disable global toasts. */
  onToast?: (toast: ToastMessage) => void
  /** Seller panel: the active restaurant, sent as `X-Seller-Id` on `restaurantScoped` requests. */
  getRestaurantId?: () => number | string | null
  timeoutMs?: number
  uploadTimeoutMs?: number
  /** GET retry policy. Defaults: 2 retries, 300ms base, doubling. */
  retry?: { max?: number; baseDelayMs?: number }
}

export interface RequestOptions {
  params?: Record<string, unknown>
  /** Pass on list/search calls so a stale request can be cancelled. */
  signal?: AbortSignal
  headers?: Record<string, string>
  timeout?: number
  /** The screen handles this error itself; the interceptor must not toast. */
  skipErrorToast?: boolean
  /** No Authorization header and no 401 refresh (login, password reset, public forms). */
  public?: boolean
  /** Send `X-Seller-Id` from `getRestaurantId`. */
  restaurantScoped?: boolean
  /** Created once per user action (`createIdempotencyKey`), so a retry reuses it. Only for endpoints that honour it. */
  idempotencyKey?: string
}
