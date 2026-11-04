import "server-only"

import { AsyncLocalStorage } from "node:async_hooks"
import { cookies, headers } from "next/headers"
import type { Envelope } from "@/api-client"
import { API_BASE_URL, API_PREFIX } from "@/lib/api/base-url"
import { ServiceError } from "@/lib/data-source/errors"

export type ApiMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"

export type ApiRequest = {
  method: ApiMethod
  /** Relative to the API base, e.g. a path from the module's api-source. */
  path: string
  query?: Record<string, string | number | undefined>
  body?: unknown
  /** Sent with every mutation once the backend contract exists (PRD A 7). */
  idempotencyKey?: string
  /** Optimistic-concurrency header (If-Match). */
  ifMatch?: string
}

export type FoodiApiTransport = {
  request<Response>(request: ApiRequest): Promise<Response>
}

export type RequestAuthContext = {
  accessToken?: string
  restaurantId?: number | string
}

const authStorage = new AsyncLocalStorage<RequestAuthContext>()

export function withRequestAuth<T>(auth: RequestAuthContext, fn: () => Promise<T>): Promise<T> {
  return authStorage.run(auth, fn)
}

export const notConfiguredTransport: FoodiApiTransport = {
  async request() {
    throw new ServiceError("not_configured")
  },
}

// Server code may reach the API on an internal address (FOODI_API_URL); otherwise the public one.
const API_BASE = process.env.FOODI_API_URL ? `${process.env.FOODI_API_URL}${API_PREFIX}` : API_BASE_URL

export const httpApiTransport: FoodiApiTransport = {
  async request<Response>(req: ApiRequest): Promise<Response> {
    const url = new URL(`${API_BASE}${req.path.startsWith("/") ? req.path : `/${req.path}`}`)
    if (req.query) {
      for (const [key, val] of Object.entries(req.query)) {
        if (val !== undefined) url.searchParams.set(key, String(val))
      }
    }

    let cookieHeader = ""
    let tokenHeader = ""
    let sellerIdHeader = ""

    try {
      const cookieStore = await cookies()
      cookieHeader = cookieStore.toString()
      const tokenCookie = cookieStore.get("foodi_seller_token")?.value
      if (tokenCookie) tokenHeader = `Bearer ${tokenCookie}`
      const idCookie = cookieStore.get("foodi_seller_restaurant_id")?.value
      if (idCookie) sellerIdHeader = idCookie
    } catch {
      // Running outside request context (e.g. tests or build)
    }

    try {
      const headerStore = await headers()
      const auth = headerStore.get("authorization")
      if (auth && !tokenHeader) tokenHeader = auth
      const sellerId = headerStore.get("x-seller-id")
      if (sellerId && !sellerIdHeader) sellerIdHeader = sellerId
    } catch {
      // Running outside request context
    }

    const explicitAuth = authStorage.getStore()
    if (explicitAuth?.accessToken) {
      tokenHeader = `Bearer ${explicitAuth.accessToken}`
    }
    if (explicitAuth?.restaurantId) {
      sellerIdHeader = String(explicitAuth.restaurantId)
    }

    const reqHeaders: Record<string, string> = {
      "X-Requested-With": "foodi-seller",
      "X-App": "seller",
      "X-App-Version": process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
      "X-Request-Id": crypto.randomUUID(),
    }

    if (cookieHeader) {
      reqHeaders["Cookie"] = cookieHeader
    }
    if (tokenHeader) {
      reqHeaders["Authorization"] = tokenHeader
    }
    if (sellerIdHeader) {
      reqHeaders["X-Seller-Id"] = sellerIdHeader
    }
    if (req.idempotencyKey) {
      reqHeaders["Idempotency-Key"] = req.idempotencyKey
    }
    if (req.ifMatch) {
      reqHeaders["If-Match"] = req.ifMatch
    }
    if (req.body !== undefined) {
      reqHeaders["Content-Type"] = "application/json"
    }

    let res: globalThis.Response
    try {
      res = await fetch(url.toString(), {
        method: req.method,
        headers: reqHeaders,
        body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
        cache: "no-store",
      })
    } catch {
      throw new ServiceError("unavailable", "Could not connect to Foodi backend API.")
    }

    if (res.status === 401) {
      throw new ServiceError("forbidden", "Authentication required.")
    }
    if (res.status === 403) {
      throw new ServiceError("forbidden", "Access denied.")
    }
    if (res.status === 404) {
      throw new ServiceError("not_found", "Resource not found.")
    }
    if (res.status === 409) {
      const errorJson = (await res.json().catch(() => null)) as Envelope<unknown> | null
      const message = errorJson?.error?.message || "Conflict."
      throw new ServiceError("conflict", message)
    }

    if (!res.ok) {
      const errorJson = (await res.json().catch(() => null)) as Envelope<unknown> | null
      const message = errorJson?.error?.message || `API error: ${res.statusText}`
      throw new ServiceError("unavailable", message)
    }

    const json = await res.json().catch(() => null)
    let payload: unknown = json
    if (payload && typeof payload === "object" && "data" in payload) {
      payload = (payload as { data: unknown }).data
    }
    if (payload && typeof payload === "object" && !Array.isArray(payload) && "periods" in payload) {
      payload = (payload as { periods: unknown }).periods
    }
    if (payload && typeof payload === "object" && !Array.isArray(payload) && "categories" in payload) {
      payload = (payload as { categories: unknown }).categories
    }
    return payload as Response
  },
}

/**
 * Returns the active transport. In real application runtime with FOODI_API_ENABLED=true,
 * uses the real HTTP transport connected to the Foodi backend.
 */
export function getApiTransport(): FoodiApiTransport {
  if (process.env.FOODI_API_ENABLED === "true") {
    return httpApiTransport
  }
  return notConfiguredTransport
}
