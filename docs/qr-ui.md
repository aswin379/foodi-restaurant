# QR codes and the public menu page (seller site)

Locations & QR (`/locations`) and Tables (`/tables`) already existed (`src/features/locations`). Added 2026-11-12:
- A **Delete** action (confirmation) for tables, rooms and seats; API `DELETE /seller/locations/destinations/:id`.
- QR codes now encode `/s/{slug}?loc={token}` (see `server/docs/qr.md`, R5). Download PNG and the printable sheet are unchanged; save as PDF from the print dialog.
- Public pages (no login, noindex): `/s/[slug]` and the old `/q/[token]` (`src/features/public-menu/public-menu.tsx`). They call `GET /customer/qr/entry`, then the public seller and foods endpoints. They show the restaurant, the live menu, "Table N" for a valid table QR, and the message from the server for an invalid or disabled QR. "Place Order" is disabled until the customer site exists.
- Phone testing: set the server `QR_BASE_URL` and this app's `NEXT_PUBLIC_API_URL` to the computer's LAN address (not localhost), and add that origin to the server `CORS_ORIGINS`.
