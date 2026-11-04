import type { UploadOptions } from "@/api-client"
import { http } from "@/lib/http"

/** Hard cap the API's multipart parser enforces; type and per-route size checks are the server's. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/** Multipart upload with the size check done before anything is sent. */
export function uploadForm<T = void>(
  url: string,
  form: FormData,
  options: Pick<UploadOptions, "method" | "onProgress" | "signal" | "restaurantScoped"> & { maxBytes?: number } = {}
): Promise<T> {
  const { maxBytes = MAX_UPLOAD_BYTES, ...rest } = options
  return http.uploadFile<T>(url, form, { ...rest, rules: { maxBytes } })
}
