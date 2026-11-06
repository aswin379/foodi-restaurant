# Feature / Task: Shared API client (sellers)

## Status
Completed (browser-tested by the owner)

## Usage
- Browser HTTP goes through `http` from `@/lib/http`. axios lives only in `src/api-client/`; ESLint `no-restricted-imports` blocks it elsewhere.
- Calls: `http.get<T>(url, opts)`, `http.post/put/patch<T>(url, body, opts)`, `http.delete<T>(url, opts)`. Restaurant-scoped calls pass `{ restaurantScoped: true }` (sends `X-Seller-Id` from the active restaurant).
- Uploads: `uploadForm(url, formData, { method, restaurantScoped })` from `@/lib/upload`, or `http.uploadFile(url, file, { rules, restaurantScoped })`. Downloads: `http.downloadFile(url, opts)` -> `{ blob, filename }`.
- Auth: `authApi.login/refresh/logout` and the public `forgotPasswordRequest` / `resetPasswordRequest` in `src/features/auth/auth-api.ts` (`/seller/auth/*`).
- Errors are always `ApiError { status, code, message, fieldErrors?, requestId, details }` (import from `@/api-client`). `status 0` = network / timeout / cancelled.
- Responses are unwrapped from the backend envelope `{ success, data }` / `{ success: false, error: { code, message, details[] } }`.
- Server code (server actions, route handlers) does NOT use axios: it uses `src/lib/api/transport.ts` (native `fetch`, `server-only`). Both share `src/lib/api/base-url.ts` and the `Envelope` type.

## Injected config (`src/lib/http.ts`)
`baseURL` (`NEXT_PUBLIC_API_URL` + `/api/v1`), `appId: 'seller'`, `appVersion` (`NEXT_PUBLIC_APP_VERSION`), `csrfHeaderValue: 'foodi-admin'` (the only value the server's `requireTrustedOrigin` accepts on refresh/logout), `authPaths`, `getAccessToken` / `setAccessToken` (memory + cookie mirror, below), `getRestaurantId` (active restaurant), `onAuthFailure` (session-lost handler). `onToast` is **not wired**: screens show their own errors and a global toast would double up.

## Behaviour
- 401 (not login/refresh/logout, not `public`): one shared refresh, replay once; on failure the token is cleared, `onAuthFailure` runs once, and all waiting requests reject with `SESSION_EXPIRED`.
- GET only: up to 2 retries (300 ms, doubling) on network error / 502 / 503 / 504. Never POST/PUT/PATCH/DELETE.
- 400/422 -> `fieldErrors` (path -> first message). 403/429/5xx/network toasts only if `onToast` is wired.
- Every request carries `X-App`, `X-App-Version`, `X-Requested-With`, `X-Request-Id`. `Idempotency-Key` is sent only when a caller passes `idempotencyKey`; the backend does not read that header yet, so nothing sends it.
- Upload checks use the API's 10 MB multipart cap (`MAX_UPLOAD_BYTES`); file types and per-route limits are the server's.

## Known security follow-up: `foodi_seller_token` cookie
- **What:** `src/lib/http.ts` (`syncAuthCookies`) writes the access token to `foodi_seller_token` and the active restaurant id to `foodi_seller_restaurant_id` with `document.cookie`.
- **Why it exists:** server actions and `src/lib/api/transport.ts` run on the Next server and must forward the user's token and `X-Seller-Id`; the cookie is how the browser hands them over (also `use-menu-command` passes them explicitly).
- **Flags now:** `path=/; max-age=86400; SameSite=Lax`. NOT HttpOnly (JavaScript-set cookies cannot be), NOT Secure. Lifetime 24 h, re-stamped on every request so it slides.
- **Risk:** any script on the page (XSS, a compromised dependency) can read the access token; without `Secure` it may also travel over plain HTTP. This contradicts "access token in memory only".
- **Safer design (to plan separately):** do not mirror the token. Keep the refresh token as the backend's HttpOnly cookie and have Next server code read an HttpOnly + Secure + SameSite session cookie set by a Next route handler (or by the API itself, same site) and exchange it for an access token server-side per request; the browser keeps only the in-memory access token. Server actions then never receive a token from client JavaScript. The `X-Seller-Id` cookie is not secret but should also move server-side or become a request parameter the server validates. Requires an auth/architecture decision; nothing was changed in this migration.

## Syncing the package
Source of truth: `D:\Foodi\packages\api-client` (own git repo, has the tests). **Never edit `src/api-client/` here.**
```
cd D:\Foodi\packages\api-client
npm test
node scripts/sync.mjs --only=sellers   # copy into sellers/src/api-client
node scripts/sync.mjs --check          # verify both apps match the package
```

## Files
`src/api-client/*` (copy), `src/lib/http.ts`, `src/lib/upload.ts`, `src/lib/api/base-url.ts`, `src/features/auth/auth-api.ts`, the `*-service.ts` modules, `components/menu/menu-export-import.tsx`, `eslint.config.mjs`. Removed: `src/lib/api-client.ts`.

## Remaining
- Cookie follow-up above. `onToast` wiring (only 403 and network/timeout, with `skipErrorToast` where a screen shows its own message).
- Sellers has no TanStack Query; hooks per module were out of scope.
- Package has no modules for orders, POS, reports, plan: no backend endpoints exist yet.
- `transport.ts` still sends `X-Requested-With: foodi-seller` (the server only accepts `foodi-admin`; harmless today because it calls no CSRF-protected endpoint).
- Unused `handleDownloadSample` in `menu-export-import.tsx` (existing lint warning).
