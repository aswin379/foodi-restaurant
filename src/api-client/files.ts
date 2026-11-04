import type { AxiosResponse } from 'axios'
import { ApiError } from './errors'
import type { SendConfig } from './create-client'
import type { RequestOptions } from './types'

export interface FileRules {
  /** MIME types, `image/*` style wildcards allowed. Omit to accept any type. */
  allowedTypes?: string[]
  maxBytes?: number
}

export interface UploadOptions extends RequestOptions {
  method?: 'post' | 'put' | 'patch'
  /** Form field name when `body` is a single File/Blob. */
  fieldName?: string
  /** Extra text fields sent next to a single file. */
  fields?: Record<string, string>
  rules?: FileRules
  /** Percent 0-100. */
  onProgress?: (percent: number) => void
}

export interface DownloadResult {
  blob: Blob
  /** From Content-Disposition when the browser is allowed to read it; otherwise null (use your own name). */
  filename: string | null
}

export interface FileHelpers {
  uploadFile<T = void>(url: string, body: File | Blob | FormData, options?: UploadOptions): Promise<T>
  downloadFile(url: string, options?: RequestOptions): Promise<DownloadResult>
}

function typeAllowed(type: string, allowed: string[]): boolean {
  return allowed.some((rule) => (rule.endsWith('/*') ? type.startsWith(rule.slice(0, -1)) : type === rule))
}

function megabytes(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`
}

/** Checks type and size before anything is sent. Throws ApiError(status 0, FILE_INVALID) with a per-field message. */
export function validateFile(file: Blob & { name?: string }, field: string, rules: FileRules = {}): void {
  const fail = (message: string): never => {
    throw new ApiError({ status: 0, code: 'FILE_INVALID', message, fieldErrors: { [field]: message }, requestId: '' })
  }
  if (rules.allowedTypes && !typeAllowed(file.type, rules.allowedTypes)) {
    fail(`${file.name ?? 'This file'} is not an allowed file type.`)
  }
  if (rules.maxBytes !== undefined && file.size > rules.maxBytes) {
    fail(`${file.name ?? 'This file'} is larger than ${megabytes(rules.maxBytes)}.`)
  }
}

function filenameFrom(disposition: unknown): string | null {
  if (typeof disposition !== 'string') return null
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1])
    } catch {
      return star[1]
    }
  }
  return /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? null
}

export function createFileHelpers(
  send: <T>(config: SendConfig) => Promise<AxiosResponse<T>>,
  uploadTimeoutMs: number,
): FileHelpers {
  return {
    async uploadFile<T>(url: string, body: File | Blob | FormData, options: UploadOptions = {}): Promise<T> {
      const field = options.fieldName ?? 'file'
      let form: FormData
      if (body instanceof FormData) {
        form = body
        if (options.rules) {
          const rules = options.rules
          form.forEach((value, name) => {
            if (typeof value !== 'string') validateFile(value, name, rules)
          })
        }
      } else {
        validateFile(body, field, options.rules)
        form = new FormData()
        form.append(field, body)
        for (const [name, value] of Object.entries(options.fields ?? {})) form.append(name, value)
      }
      const headers = { ...options.headers }
      if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey
      const onProgress = options.onProgress
      const response = await send<T>({
        method: options.method ?? 'post',
        url,
        data: form,
        params: options.params,
        signal: options.signal,
        timeout: options.timeout ?? uploadTimeoutMs,
        headers,
        skipErrorToast: options.skipErrorToast,
        public: options.public,
        restaurantScoped: options.restaurantScoped,
        onUploadProgress: onProgress
          ? (event) => {
              if (event.total) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
            }
          : undefined,
      })
      return response.data
    },

    async downloadFile(url: string, options: RequestOptions = {}): Promise<DownloadResult> {
      const response = await send<Blob>({
        method: 'get',
        url,
        responseType: 'blob',
        params: options.params,
        signal: options.signal,
        timeout: options.timeout ?? uploadTimeoutMs,
        headers: options.headers,
        skipErrorToast: options.skipErrorToast,
        public: options.public,
        restaurantScoped: options.restaurantScoped,
      })
      return { blob: response.data, filename: filenameFrom(response.headers['content-disposition']) }
    },
  }
}
