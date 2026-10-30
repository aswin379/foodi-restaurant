# Restaurant settings UI (B4a)

The Settings screens follow PRD v0.3 §1 module 18 (R1), §6 Settings and the
§4.2 settings list, with the B4a decisions D1–D9. No settings API exists yet,
so production shows "Settings aren't connected yet". Every change works only
against labelled preview data. Everything below about the API is a
**PROPOSAL** awaiting the backend team (PRD §9.1).

## Routes

| Route | What it is |
|---|---|
| `/settings` | Overview, with links to the profile, order settings and the existing `/hours` pages |
| `/settings/profile` | Restaurant name, description, contact phone and email, address and coordinates, logo and cover; time zone, currency and language read-only (D7) |
| `/settings/orders` | Order types offered, one restaurant-wide minimum order (D5), default prep time per order type, and the pickup-code requirement (D2) |

Not in B4a:
- `/settings/charges` (tax and packaging, D4): B4b, after the model is defined.
- Auto-accept (D1): the PRD module map puts it in R2 (module 3), while the
  §4.2 settings list includes it. That conflict is recorded here for later.
- Alarm sound and repeat, auto-print, receipt and ticket layout, QR code,
  payment methods, notification preferences, translations and delivery
  tracking (D8).

## Model (`src/lib/settings/types.ts`)

```ts
type RestaurantProfile = {
  name: string
  description: string | null
  contact: { phone: string | null; email: string | null }
  address: { line1: string; line2: string | null; city: string; region: string | null; postalCode: string }
  /** D3: coordinates only; no map provider. Both or neither. */
  location: { latitude: number; longitude: number } | null
  logoUrl: string | null
  coverUrl: string | null
  /** Read-only here (D7); set by Foodi. */
  timeZone: string
  currency: string
  locale: string
  version: string
  updatedAt: string | null
  updatedBy: string | null
}

type OrderSettings = {
  /** Keyed by every order type; unknown or missing types are integration errors. */
  orderTypes: Record<OrderType, { enabled: boolean; defaultPrepMinutes: number }>
  /** D5: one value for the whole restaurant; null = no minimum. */
  minimumOrder: Money | null
  /** §4.2: a code is checked when completing takeaway and dine-in orders. */
  pickupCodeRequired: boolean
  version: string
  updatedAt: string | null
  updatedBy: string | null
}
```

## Rules

- **Saves are version-aware.** Each save sends the version it was loaded
  at. A stale version is refused with "…changed since you opened this page.
  Reload to see the latest", and nothing is overwritten.
- **Profile validation** (shared by the browser and the server):
  - name required, up to 80 characters; description up to 500
  - phone optional: digits with an optional leading `+`, spaces, dashes or
    brackets, 7–15 digits
  - email optional, one address
  - address line 1, city and postal code required (provisional)
  - latitude −90 to 90 and longitude −180 to 180, both or neither, up to 6
    decimals
- **Images** reuse the menu image checks: JPG, PNG or WebP, up to 2 MB
  chosen, compressed in the browser by `src/components/menu/image-picker.tsx`,
  and checked again on the server.
  - The logo is cropped to a square, like menu images.
  - The cover keeps its shape and is scaled to at most 1600 px wide.
  - Both are provisional: the PRD sets no sizes.
- **Image size and the request limit (B4a hardening):** the preview save
  sends both images inline, base64-encoded, in one Server Action request.
  Next caps that request at 1 MB by default and rejects anything bigger
  (HTTP 413) before our code runs. Two menu-sized images (700 KB each, about
  933 KB each encoded) could reach about 1.5 MB, and that crashed the page.
  The fix:
  - **Per-image budgets:** the logo is compressed to 300 KB or less and the
    cover to 400 KB or less (`LOGO_MAX_BYTES` and `COVER_MAX_BYTES` in
    `src/lib/settings/validation.ts`). A unit test checks that the worst case
    (both images at budget, every text field at its length cap) stays under
    95% of the limit. The global limit is not raised.
  - **Shrinking to fit:** when compression alone can't reach the budget, the
    picker also scales the image down (75%, 50%, 35%). If that still doesn't
    fit, it says "This image is still too large after compression". Menu
    images (B2) keep their 700 KB budget, their compression steps and their
    messages.
  - **Failed requests:** a save whose request fails before the action answers
    (too large, offline, server error) shows "Your change couldn't be sent,
    so nothing was saved…" as an alert. Nothing is reported as saved, and
    retrying reuses the same idempotency key, so it can't apply twice.
  - **Remaining limitation:** uploads aren't production-ready. The backend
    needs an upload endpoint with server-side validation and compression;
    the profile should then send image references, not image data. This is
    the same dependency menu images have.
- **Image controls** are named for their image: "Choose logo image", "Remove
  logo image", "Choose cover image", "Remove cover image". Error-summary links
  for an image go to its visible "Choose …" button, not the hidden file
  input. The menu item form's image link does the same (a small,
  backward-compatible fix in B2's form).
- **Order settings validation:**
  - at least one order type stays on; to stop orders for a while, use Pause
    in Availability & hours (provisional)
  - default prep times are whole minutes from 5 to 180, the same range the
    Accept dialog uses
  - the minimum order is blank (no minimum) or an amount above zero in the
    restaurant's currency, with up to two decimals; an entered 0 is refused
    ("Enter an amount above 0, or leave it blank for no minimum")
- **Turning an order type off (D6)** asks for confirmation first. The dialog
  says that:
  - this saves the order type as off in the restaurant settings;
  - saving doesn't by itself stop customers ordering at checkout, because
    that check belongs to Foodi's ordering service, which isn't connected to
    these settings yet;
  - hours, special dates and menu settings for that order type stay as they
    are;
  - orders already placed aren't changed.

  It promises no enforcement. Nothing else is changed when it's saved: no
  schedule, menu setting, category or order is rewritten (unit-tested
  against the hours, menu, categories and orders preview data). The page
  shows the saved (configured) settings separately from availability, which
  it doesn't claim to know. B4a introduces no new availability-precedence
  rule.
- **Prep defaults aren't used by Orders yet.** The Accept dialog still
  starts at 20 minutes (B1, unchanged). Using the per-order-type default
  there is a later integration task.
- **Pickup code (D2):** only the setting. The B1 Complete workflow is
  unchanged; see "Backend contracts".
- **Permissions (D9):** owner-only is assumed and enforced by the backend.
  A 403 shows "You don't have permission to see or change restaurant
  settings" on load, and the standard permission message on save.

## Shared restaurant context

`src/lib/restaurant/context.ts` stays the one source of the time zone,
currency and locale for every module, unchanged. In preview the profile shows
the same values (`PREVIEW_RESTAURANT`), read-only. Editing the profile name
doesn't change the context in preview. Once the API exists, the context
should be read from the profile endpoint (an integration task), so the
profile becomes its source of truth without a second store.

## Data sources

`src/lib/settings/service.ts` uses `selectAdapter()` with the existing
`FOODI_RESTAURANT_DATA_SOURCE`.

- **API** (default; the only mode in production): the transport reports
  `not_configured`, so pages show "Settings aren't connected yet". There is
  no fallback.
- **Preview** (`FOODI_RESTAURANT_DATA_SOURCE=preview`, development only):
  - one record in the B0 preview store holds the profile and order
    settings, labelled "(preview)";
  - a **Reset sample settings** tool;
  - simulated saves labelled "Preview only, not saved to Foodi";
  - repeated keys are replayed;
  - `?preview=empty|error|slow|forbidden` shows those load states (`empty`
    is the not-connected state for settings);
  - a **Refuse saves, as for someone who isn't the owner** preview tool makes
    every save fail as a backend 403 would, showing the standard permission
    message. Reset turns it off, and production refuses it.

## Proposed API (PROPOSED, for the backend team)

| Method + path | Request | Response |
|---|---|---|
| GET `/seller/restaurant/profile` | none | `RestaurantProfile` |
| PATCH `/seller/restaurant/profile` | profile draft, with `logo` and `cover` as `{ kind: "keep" \| "remove" \| "replace", dataUrl? }`; `If-Match: version`; idempotency key | `RestaurantProfile` |
| GET `/seller/restaurant/order-settings` | none | `OrderSettings`, `orderTypes` keyed by API order-type names |
| PUT `/seller/restaurant/order-settings` | order-settings draft, keyed by API names; `If-Match`; idempotency key | `OrderSettings` |

Responses:
- `409` for a stale version;
- `422` with field errors;
- `403` when the user isn't the owner.

Order-type keys go through `src/lib/api/mapping.ts`.

## Backend contracts and dependencies (open)

- **Storage and enforcement:**
  - persistence and versioning for the profile and order settings;
  - owner-only authorization;
  - an audit log entry per change;
  - a `restaurant.settings.updated` event, so other surfaces refresh.
- **Image upload:** an endpoint with server-side validation and
  compression, then the URL in the profile.
- **Order types:** checkout and the availability evaluator must refuse a
  turned-off order type, and decide how it combines with hours and menu
  channels. That is not decided here (D6).
- **Minimum order:** enforced at checkout, against an order total
  definition (before or after discounts, tax and charges) that the backend
  and product still have to fix.
- **Prep defaults:**
  - served with the order (or settings) to pre-fill Accept;
  - the B1 Accept dialog change is a later integration task.
- **Pickup code (D2):**
  - generating the code and showing it to the customer;
  - an order field saying a code is required;
  - server-side verification on Complete for takeaway and dine-in;
  - the B1 Complete change is a later integration task.

  No such field or endpoint is invented here.
- **Restaurant context:** read the time zone, currency and locale from the
  profile once it exists. Changing them stays with Foodi (D7).
- **Auto-accept** (D1, the R1/R2 conflict) and tax and packaging (D4, B4b)
  are unresolved.

## Provisional values (not approved)

| What | Where |
|---|---|
| Required address fields (line 1, city, postal code) | `src/lib/settings/validation.ts` |
| Name 80, description 500, phone 7–15 digits | `src/lib/settings/validation.ts` |
| Logo square, cover up to 1600 px wide keeping its shape | `src/components/menu/image-picker.tsx` (`shape`) |
| Logo 300 KB and cover 400 KB after compression (request-size budget) | `src/lib/settings/validation.ts`, `image-picker.tsx` (`maxBytes`) |
| Minimum order must be above zero when entered | `src/lib/settings/validation.ts` |
| At least one order type on | `src/lib/settings/validation.ts` |
| Prep default range 5–180 minutes (Accept dialog range) | `src/lib/orders/commands.ts` |

## Tests

- **Unit:**
  - validation of the profile, coordinates, image types and budgets, the
    worst-case request size, minimum order (blank, zero, positive, invalid)
    and prep defaults;
  - command parsing of untrusted input;
  - the rules, with stale versions refused and nothing outside settings
    changed;
  - API mapping, with the stand-in `takeaway` → `pickup` name and unknown
    order types refused;
  - the service:
    - production refusal and no fallback;
    - preview replay and reset;
    - the save-refusal tool;
    - turning an order type off leaves hours, menu, categories and orders
      unchanged;
    - the pickup code leaves the B1 lifecycle unchanged.
- **Component:**
  - a request that fails before the action answers becomes a recoverable
    failure, never a success, and the retry keeps its key;
  - image controls are named per image;
  - error-summary links focus the visible image button.
- **Browser:**
  - production shows "not connected" on the settings routes with no sample
    data or controls;
  - in preview, at desktop and mobile:
    - profile edit with validation links, a stale-version conflict, image
      checks, and replacing and removing both images;
    - realistic logo and cover photos saved together, with the request
      measured under 1 MB;
    - worst-case images with no oversized request and no crash;
    - a rejected request with a recoverable error;
    - a permission refusal on save;
    - keyboard order, image controls and error-summary links;
    - order settings with the turn-off warning, hours and menu unchanged
      afterwards, and the zero minimum refused;
    - the permission state on load;
    - layouts at 820 px;
  - axe, no overflow and no console errors on every page.
