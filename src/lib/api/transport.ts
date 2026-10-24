import "server-only"

import { ServiceError } from "@/lib/data-source/errors"

/**
 * The single seam for calls to the Foodi API. Module `api-source.ts` files
 * call this; components never do.
 *
 * Nothing is wired up yet: there is no restaurant (seller) session and no
 * seller API, so every request reports `not_configured`. Paths, the API
 * prefix and the idempotency header are backend contracts still to be
 * settled (PRD §9.1), so no module should depend on a concrete path outside
 * its own api-source file.
 */
export type ApiMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"

export type ApiRequest = {
  method: ApiMethod
  /** Relative to the API base, e.g. a path from the module's api-source. */
  path: string
  query?: Record<string, string | number | undefined>
  body?: unknown
  /** Sent with every mutation once the backend contract exists (PRD §7). */
  idempotencyKey?: string
  /** PROPOSED optimistic-concurrency header (If-Match), pending backend agreement. */
  ifMatch?: string
}

export type FoodiApiTransport = {
  request<Response>(request: ApiRequest): Promise<Response>
}

export const notConfiguredTransport: FoodiApiTransport = {
  async request() {
    throw new ServiceError("not_configured")
  },
}

/** Returns the transport for the current request. */
export function getApiTransport(): FoodiApiTransport {
  return notConfiguredTransport
}
