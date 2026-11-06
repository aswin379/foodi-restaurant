import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type CreateAxiosDefaults,
  type InternalAxiosRequestConfig,
} from 'axios'
import { ApiError, toFieldErrors } from './errors'
import { createFileHelpers, type FileHelpers } from './files'
import type { ApiClientConfig, Envelope, RequestOptions, SessionBase, ToastMessage } from './types'

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'

/** Per-request flags carried on the axios config so the interceptors can read them. */
interface Meta {
  skipErrorToast?: boolean
  public?: boolean
  restaurantScoped?: boolean
  _retry?: boolean
  _retryCount?: number
}
type Cfg = InternalAxiosRequestConfig & Meta
export type SendConfig = AxiosRequestConfig & Meta

export interface ApiClient extends FileHelpers {
  get<T>(url: string, options?: RequestOptions): Promise<T>
  post<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T>
  put<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T>
  patch<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T>
  delete<T>(url: string, options?: RequestOptions): Promise<T>
  /**
   * Restores or renews the session from the refresh cookie. Concurrent callers share one request:
   * the server treats a replayed refresh token as theft and ends the session.
   */
  refreshSession<S extends SessionBase>(): Promise<S>
  setAccessToken(token: string | null): void
}

/** Test seam: lets a test attach a mock adapter to both axios instances. */
export interface ClientDeps {
  createAxios?: (defaults: CreateAxiosDefaults) => AxiosInstance
}

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_UPLOAD_TIMEOUT_MS = 120_000
const RETRYABLE_STATUS = new Set([502, 503, 504])

const MSG = {
  network: 'Could not reach the server. Check your connection and try again.',
  timeout: 'The request timed out. Please try again.',
  generic: 'Something went wrong. Please try again.',
  tooMany: 'Too many attempts. Please wait a few minutes and try again.',
  sessionExpired: 'Your session has expired. Please sign in again.',
  badResponse: 'Unexpected response from the server.',
}
const TOAST = {
  forbidden: "You don't have permission",
  tooMany: 'Too many requests. Please wait a moment and try again.',
  server: 'Something went wrong on our side. Please try again.',
}

function newRequestId(): string {
  return globalThis.crypto.randomUUID()
}

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve()
}

function headerOf(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== 'object') return undefined
  const h = headers as { get?: (n: string) => unknown } & Record<string, unknown>
  const value = typeof h.get === 'function' ? h.get(name) : h[name.toLowerCase()]
  return typeof value === 'string' ? value : undefined
}

/** An error body for a blob download arrives as a Blob; read it as JSON if it is one. */
async function readBody(data: unknown): Promise<unknown> {
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      return JSON.parse(await data.text())
    } catch {
      return null
    }
  }
  return data
}

export function createApiClient(config: ApiClientConfig, deps: ClientDeps = {}): ApiClient {
  const createAxios = deps.createAxios ?? ((defaults) => axios.create(defaults))
  const timeout = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const retryMax = config.retry?.max ?? 2
  const retryBaseMs = config.retry?.baseDelayMs ?? 300
  const uploadTimeoutMs = config.uploadTimeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS

  const baseHeaders = {
    Accept: 'application/json',
    'X-App': config.appId,
    'X-App-Version': config.appVersion ?? 'unknown',
    'X-Requested-With': config.csrfHeaderValue,
  }
  const defaults: CreateAxiosDefaults = {
    baseURL: config.baseURL,
    timeout,
    withCredentials: true,
    headers: baseHeaders,
  }

  const instance = createAxios(defaults)
  // The refresh call must not pass through the interceptors below (no 401 loop, no token attach).
  const plain = createAxios(defaults)

  const isAuthPath = (url: string | undefined) =>
    url === config.authPaths.login || url === config.authPaths.refresh || url === config.authPaths.logout

  async function toApiError(error: unknown, sentRequestId: string): Promise<ApiError> {
    if (error instanceof ApiError) return error
    if (!axios.isAxiosError(error)) {
      return new ApiError({ status: 0, code: 'UNKNOWN', message: MSG.generic, requestId: sentRequestId })
    }
    const sent = headerOf(error.config?.headers, 'X-Request-Id') ?? sentRequestId
    if (axios.isCancel(error)) {
      return new ApiError({ status: 0, code: 'CANCELED', message: 'Request cancelled.', requestId: sent })
    }
    const response = error.response
    if (!response) {
      const timedOut = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
      return new ApiError({
        status: 0,
        code: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: timedOut ? MSG.timeout : MSG.network,
        requestId: sent,
      })
    }
    const body = (await readBody(response.data)) as Envelope<unknown> | null
    const status = response.status
    return new ApiError({
      status,
      code: body?.error?.code ?? `HTTP_${status}`,
      message: status === 429 ? MSG.tooMany : (body?.error?.message ?? MSG.generic),
      fieldErrors: status === 400 || status === 422 ? toFieldErrors(body?.error?.details) : undefined,
      // The server echoes X-Request-Id, but CORS only exposes it if the server lists it; it also reuses ours.
      requestId: headerOf(response.headers, 'X-Request-Id') ?? sent,
      details: body?.error?.details,
    })
  }

  function toastFor(e: ApiError): ToastMessage | null {
    const make = (type: ToastMessage['type'], message: string): ToastMessage => ({
      type,
      message,
      status: e.status,
      code: e.code,
    })
    if (e.code === 'CANCELED') return null
    if (e.status === 403) return make('error', TOAST.forbidden)
    if (e.status === 429) return make('warning', TOAST.tooMany)
    if (e.status >= 500) return make('error', TOAST.server)
    if (e.status === 0) return make('error', e.message)
    return null
  }

  /** Reads `{ success, data }` out of a response body; throws ApiError for anything else. */
  function unwrap<T>(response: AxiosResponse): T {
    const requestId = headerOf(response.headers, 'X-Request-Id') ?? headerOf(response.config?.headers, 'X-Request-Id') ?? ''
    const body = response.data as Envelope<T> | '' | null | undefined
    if (response.status === 204 || body === '') return undefined as T
    if (body && typeof body === 'object' && body.success === true) return body.data as T
    const failed = body && typeof body === 'object' ? body.error : undefined
    throw new ApiError({
      status: response.status,
      code: failed?.code ?? 'BAD_ENVELOPE',
      message: failed?.message ?? MSG.badResponse,
      requestId,
      details: failed?.details,
    })
  }

  instance.interceptors.request.use((cfg) => {
    const c = cfg as Cfg
    if (!c.headers.has('X-Request-Id')) c.headers.set('X-Request-Id', newRequestId())
    if (c.public) {
      c.headers.delete('Authorization')
    } else {
      const token = config.getAccessToken()
      if (token) c.headers.set('Authorization', `Bearer ${token}`)
      else c.headers.delete('Authorization')
    }
    if (c.restaurantScoped) {
      const id = config.getRestaurantId?.()
      if (id !== null && id !== undefined) c.headers.set('X-Seller-Id', String(id))
    }
    return c
  })

  instance.interceptors.response.use(
    (response) => {
      const type = response.config.responseType
      if (type === 'blob' || type === 'arraybuffer') return response
      response.data = unwrap(response)
      return response
    },
    async (error: unknown) => {
      const cfg = axios.isAxiosError(error) ? (error.config as Cfg | undefined) : undefined
      const status = axios.isAxiosError(error) ? error.response?.status : undefined

      // Refresh once, then replay the request with the new token. Queued 401s all await the same refresh.
      if (cfg && status === 401 && !cfg.public && !cfg._retry && !isAuthPath(cfg.url)) {
        cfg._retry = true
        try {
          await refreshForRetry()
        } catch {
          throw new ApiError({
            status: 401,
            code: 'SESSION_EXPIRED',
            message: MSG.sessionExpired,
            requestId: headerOf(cfg.headers, 'X-Request-Id') ?? '',
          })
        }
        return instance.request(cfg)
      }

      // Only idempotent reads are retried, and only when the failure is transient.
      if (cfg && axios.isAxiosError(error) && canRetry(cfg, error)) {
        const attempt = (cfg._retryCount ?? 0) + 1
        cfg._retryCount = attempt
        await sleep(retryBaseMs * 2 ** (attempt - 1))
        return instance.request(cfg)
      }

      const apiError = await toApiError(error, headerOf(cfg?.headers, 'X-Request-Id') ?? '')
      if (!cfg?.skipErrorToast) {
        const toast = toastFor(apiError)
        if (toast) config.onToast?.(toast)
      }
      throw apiError
    },
  )

  function canRetry(cfg: Cfg, error: { response?: AxiosResponse; code?: string }): boolean {
    if (cfg.method?.toLowerCase() !== 'get') return false
    if ((cfg._retryCount ?? 0) >= retryMax) return false
    if (cfg.signal?.aborted) return false
    // No response and not a timeout/cancel: the connection failed (axios error codes vary by environment).
    if (!error.response) return error.code !== 'ECONNABORTED' && error.code !== 'ETIMEDOUT' && error.code !== 'ERR_CANCELED'
    return RETRYABLE_STATUS.has(error.response.status)
  }

  let refreshing: Promise<SessionBase> | null = null

  function refreshSession<S extends SessionBase>(): Promise<S> {
    refreshing ??= plain
      .post(config.authPaths.refresh, undefined, { headers: { 'X-Request-Id': newRequestId() } })
      .then((response) => {
        const session = unwrap<SessionBase>(response)
        config.setAccessToken(session.accessToken)
        return session
      })
      .catch(async (error: unknown) => {
        throw await toApiError(error, '')
      })
      .finally(() => {
        refreshing = null
      })
    return refreshing as Promise<S>
  }

  // A failed refresh ends the session once, however many requests were waiting on it.
  const failureHandled = new WeakSet<Promise<unknown>>()
  function refreshForRetry(): Promise<SessionBase> {
    const pending = refreshSession<SessionBase>()
    if (!failureHandled.has(pending)) {
      failureHandled.add(pending)
      pending.catch(() => {
        config.setAccessToken(null)
        config.onAuthFailure()
      })
    }
    return pending
  }

  async function send<T>(cfg: SendConfig): Promise<AxiosResponse<T>> {
    return instance.request<T>(cfg)
  }

  function call<T>(method: Method, url: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    const headers = { ...options.headers }
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey
    return send<T>({
      method,
      url,
      data: body,
      params: options.params,
      signal: options.signal,
      // A multipart body is a file upload: it gets the longer timeout unless the caller says otherwise.
      timeout: options.timeout ?? (body instanceof FormData ? uploadTimeoutMs : undefined),
      headers,
      skipErrorToast: options.skipErrorToast,
      public: options.public,
      restaurantScoped: options.restaurantScoped,
    }).then((response) => response.data)
  }

  return {
    get: (url, options) => call('get', url, undefined, options),
    post: (url, body, options) => call('post', url, body, options),
    put: (url, body, options) => call('put', url, body, options),
    patch: (url, body, options) => call('patch', url, body, options),
    delete: (url, options) => call('delete', url, undefined, options),
    refreshSession,
    setAccessToken: config.setAccessToken,
    ...createFileHelpers(send, uploadTimeoutMs),
  }
}
