// Shared error type for every module's data source (B0). Module-specific error
// classes (OrdersServiceError, MenuServiceError) move onto this in B1/B2.

export const SERVICE_ERROR_KINDS = [
  /** No backend API exists for this feature yet. */
  "not_configured",
  /** The API exists but the request failed (network, 5xx, bad response). */
  "unavailable",
  /** The server refused the action for this user or restaurant. */
  "forbidden",
  "not_found",
  /** The record changed since it was loaded, or the action no longer applies. */
  "conflict",
  /** The server rejected the submitted values. */
  "validation",
] as const

export type ServiceErrorKind = (typeof SERVICE_ERROR_KINDS)[number]

export class ServiceError extends Error {
  constructor(
    readonly kind: ServiceErrorKind,
    message: string = kind,
    /** Field-level messages from the server, keyed by form field name. */
    readonly fieldErrors?: Record<string, string>
  ) {
    super(message)
    this.name = "ServiceError"
  }
}

export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError
}
