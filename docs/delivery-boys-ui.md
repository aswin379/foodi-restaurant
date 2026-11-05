# Delivery boys (seller panel)

Restaurants that deliver their own orders register their delivery boys here. There is no Foodi approval for
them: a delivery boy is active as soon as the seller registers them, and the seller switches them on or off. API and storage rules are in `server/docs/delivery-men.md` ("Seller
registration").

## Where things are

| What | Where | Code |
|---|---|---|
| Choose "We deliver ourselves", fee, radius, prep time | Restaurant profile → Delivery and timing (a plain form) | `features/profile/components/delivery-form.tsx` |
| Sidebar **Delivery** dropdown: Activity, History, Delivery boys | Sidebar | `components/dashboard/navigation.ts`, `sidebar-nav.tsx` |
| Activity / History of deliveries | `/delivery` and `/delivery?view=history` (the Active/History tabs on the page stay) | `app/(dashboard)/delivery/page.tsx` |
| List, edit (side panel), files, activate/deactivate, delete | `/delivery-boys` | `features/delivery-men/components/delivery-boys-manager.tsx` |
| Registration page (not a pop-up) | `/delivery-boys/new`, from the **Add delivery boy** button | `register-delivery-boy.tsx`, `rider-form.tsx`, `square-image-picker.tsx`, `validation.ts` |
| Square crop dialog | shared | `components/shared/image-crop-dialog.tsx`, `crop-image.ts` |

## Flow

1. The owner chooses **We deliver ourselves** in Restaurant profile and saves. The server no longer asks for a
   delivery boy first.
2. The sidebar **Delivery** item is a dropdown: **Activity**, **History**, and **Delivery boys**. Delivery boys is
   shown only while the saved mode is `SELF` (`own-delivery.ts`, updated without a reload after saving the
   profile). The dropdown opens by itself on any of its pages and can be closed. On the collapsed rail Delivery
   links straight to Activity. Staff need the `delivery` permission for all three (cosmetic; the API enforces it).
3. On **Delivery boys** the owner clicks **Add delivery boy**, which opens the registration page
   (`/delivery-boys/new`, with a "Back to delivery boys" link; after registering it returns to the list). A new delivery boy is **approved and active immediately**
   (no admin approval, and not in the admin approval queue).
4. **Active switch** (`active-switch.tsx`): every row of the list, and the details panel, has a toggle for the delivery
   boy. It is **green when Active and red when Inactive** (the label beside it uses the same colours), calls
   `PATCH /seller/delivery-men/:id/status` and reloads the list. A delivery boy that Foodi suspended or rejected is
   locked with "Suspended by Foodi" / "Rejected by Foodi", because the seller cannot override an admin decision.
   An older row that was still pending is approved when the seller first switches it on.
5. Until at least one delivery boy is switched on, the server refuses own-delivery orders (`placeOrder`, 409 "This
   restaurant has no active delivery boy yet"). The page says so: "No delivery boys yet, add one to start
   delivering" when empty, and "No delivery boy is switched on. Turn one on to receive your own delivery orders."

## Registration form

- Fields: first name, last name, email, phone, password, delivery type (freelance / salary based), vehicle,
  identity type and number.
- **No Zone field.** The server places the delivery boy in the restaurant's own zone (never from the request). A
  restaurant without a zone cannot register anyone: the page shows "Set your restaurant location in Restaurant
  profile first..." and the Add button is disabled.
- **Images, all square, images only (no PDF):** profile photo (required), identity images (up to 5), additional
  documents (optional, up to 5). Layout: a large square **upload box for the profile photo at the top**, then the
  fields, then a dashed box each for identity images and additional documents (cropped thumbnails with a remove
  button, plus an "Add image" tile until the limit). A box is the label of the hidden file input, so a click or
  keyboard Enter opens the file picker.
- **Crop step:** each picked JPG/PNG/WebP (up to 5 MB) opens a crop dialog with a square frame, one image at a time
  ("Image 2 of 3"). Zoom goes below 1 and **Fit whole image** keeps the entire picture with white padding, so an
  ID card does not lose text at its edges. Output is a JPEG, at most 1024 px, under the 2 MB limit.
  Library: `react-easy-crop` (same version as admin). Kept images show as thumbnails that can be removed.
- The same crop runs for **Replace photo** and **Add identity images / other documents** in a delivery boy's
  files panel (uploaded straight after each crop).
- The server re-checks every image is square and rejects anything else before storing (seller requests only).

## Decisions

- Registration is a full page, not a dialog. Viewing and editing an existing delivery boy stays a side panel.
- The Self delivery switch and the in-page registration panel were removed: the profile is the one place that
  chooses the delivery mode.
- "My delivery boys" is no longer a separate sidebar item; it is the **Delivery boys** sub-link.
- Orders are guarded in the backend (`placeOrder`), not in the profile form, so Self delivery can be saved first.
- Centre-crop fallback (`square-crop.ts`) was deleted; a blind crop could cut ID text.
- No database migration.
