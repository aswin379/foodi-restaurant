import type { Session } from "@/features/auth/types"

// Public by design: the browser calls the API directly. No secret belongs in a NEXT_PUBLIC_ variable.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"
const BASE = `${API_URL}/api/v1`
// The backend requires this header on cookie-based endpoints (CSRF defence).
const CSRF_HEADERS = { "X-Requested-With": "foodi-admin" }

export class ApiError extends Error {
  readonly status: number
  readonly details: unknown
  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

type Envelope<T> = {
  success: boolean
  data?: T
  error?: { message?: string; details?: unknown }
}

/** The access token lives in memory only; the refresh token is an HttpOnly cookie. */
let accessToken: string | null = null
let onSessionLost: (() => void) | null = null
/** The restaurant requests act on. The API re-checks that this owner may use it on every request. */
let activeRestaurantId: number | null = null

export function setActiveRestaurantId(id: number | null) {
  activeRestaurantId = id
}

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function setSessionLostHandler(handler: (() => void) | null) {
  onSessionLost = handler
}

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${BASE}${path}`, {
      ...init,
      credentials: "include",
      cache: "no-store",
    })
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0)
  }
}

async function parse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as Envelope<T> | null
  if (!response.ok || !payload?.success) {
    if (response.status === 429) {
      throw new ApiError("Too many attempts. Please wait a few minutes and try again.", 429)
    }
    throw new ApiError(
      payload?.error?.message ?? "Something went wrong. Please try again.",
      response.status,
      payload?.error?.details
    )
  }
  return payload.data as T
}

/**
 * One refresh at a time. The server treats a replayed refresh token as theft and ends the
 * session, so concurrent callers (StrictMode, parallel 401s) must share a single request.
 */
let refreshing: Promise<Session> | null = null

export function refreshSession(): Promise<Session> {
  refreshing ??= send("/seller/auth/refresh", { method: "POST", headers: CSRF_HEADERS })
    .then((response) => parse<Session>(response))
    .then((session) => {
      accessToken = session.accessToken
      return session
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

export async function loginRequest(email: string, password: string): Promise<Session> {
  const response = await send("/seller/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...CSRF_HEADERS },
    body: JSON.stringify({ email, password }),
  })
  const session = await parse<Session>(response)
  accessToken = session.accessToken
  return session
}

async function postPublic(path: string, body: unknown): Promise<void> {
  const response = await send(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  await parse<unknown>(response)
}

/** Asks for a reset code. The server answers the same whether or not the email has an account. */
export function forgotPasswordRequest(email: string): Promise<void> {
  return postPublic("/seller/auth/forgot-password", { email })
}

export function resetPasswordRequest(input: {
  email: string
  otp: string
  password: string
}): Promise<void> {
  return postPublic("/seller/auth/reset-password", input)
}

export async function logoutRequest(): Promise<void> {
  try {
    await send("/seller/auth/logout", { method: "POST", headers: CSRF_HEADERS })
  } finally {
    accessToken = null
  }
}

/**
 * Authenticated JSON request. A 401 means the access token is missing, expired or revoked: refresh
 * once and retry once. If the refresh fails the session ends. Other statuses are never retried.
 */
export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown; restaurantScoped?: boolean } = {}
): Promise<T> {
  // FormData (image uploads) is sent as is; the browser sets the multipart boundary.
  const isForm = init.body instanceof FormData
  const run = () =>
    send(path, {
      method: init.method ?? "GET",
      headers: {
        ...(init.body === undefined || isForm ? {} : { "Content-Type": "application/json" }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(init.restaurantScoped && activeRestaurantId !== null
          ? { "X-Seller-Id": String(activeRestaurantId) }
          : {}),
      },
      body:
        init.body === undefined
          ? undefined
          : isForm
            ? (init.body as FormData)
            : JSON.stringify(init.body),
    })

  let response = await run()
  if (response.status === 401) {
    try {
      await refreshSession()
    } catch {
      accessToken = null
      onSessionLost?.()
      throw new ApiError("Your session has expired. Please sign in again.", 401)
    }
    response = await run()
  }
  return parse<T>(response)
}
