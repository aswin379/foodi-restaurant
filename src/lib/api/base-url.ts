// One definition of the API location for browser (lib/http.ts) and server (lib/api/transport.ts) code.
// Public by design: the browser calls the API directly. No secret belongs in a NEXT_PUBLIC_ variable.
export const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
export const API_PREFIX = "/api/v1"
export const API_BASE_URL = `${API_ORIGIN}${API_PREFIX}`
