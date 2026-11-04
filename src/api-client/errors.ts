/** field path -> first message for that field (from the backend's `error.details[]`). */
export type FieldErrors = Record<string, string>

export interface ApiErrorInit {
  status: number
  code: string
  message: string
  fieldErrors?: FieldErrors
  requestId: string
  /** The backend's raw `error.details`, kept for callers that read it directly. */
  details?: unknown
}

/** Every rejection from the client is an ApiError. status 0 means no HTTP response (network, timeout, cancel). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors?: FieldErrors
  readonly requestId: string
  readonly details: unknown

  constructor(init: ApiErrorInit) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.fieldErrors = init.fieldErrors
    this.requestId = init.requestId
    this.details = init.details
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}

/** Backend validation details are `[{ path, message }]`. Anything else yields no field errors. */
export function toFieldErrors(details: unknown): FieldErrors | undefined {
  if (!Array.isArray(details)) return undefined
  const out: FieldErrors = {}
  for (const item of details) {
    if (item && typeof item === 'object') {
      const { path, message } = item as { path?: unknown; message?: unknown }
      if (typeof path === 'string' && typeof message === 'string' && !(path in out)) out[path] = message
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}
