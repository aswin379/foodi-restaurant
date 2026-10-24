# Restaurant Menu Management UI (RUI-03)

Status: **UI built on a provisional model. Nothing can be saved.** No menu API exists yet, and the menu data model and rules have not been approved.

## Routes

| Route | Purpose |
|---|---|
| `/menu` | Menu items: availability tabs (All items / Available / Unavailable), name search, category filter, clear filters, result count, pagination (10 per page). Table on `md` and up, cards below. Each row has an action menu: Edit item, and a disabled availability change. |
| `/menu/new` | Create-item form. |
| `/menu/[itemId]/edit` | Edit-item form, prefilled; not-found page for unknown items. |
| `/menu/categories` | Categories in display order, with item counts linking to the filtered menu; add/edit in a dialog; reorder controls disabled. |

The sidebar's "Menu Management" and "Categories" items link to `/menu` and `/menu/categories`. The nav now highlights the most specific match, so `/menu/categories` selects "Categories" only.

Filters live in the URL (`availability`, `q`, `category`, `page`), so every view can be shared and works before hydration. Invalid values fall back to defaults (`src/lib/menu/query.ts`).

## What is disabled or local-only

| Control | Behaviour today |
|---|---|
| Save item / Save changes | Validates the form. If it's valid, stops with "Not saved. Backend integration pending…". No request is made. |
| Add / edit category dialog | Same as the item form: validates, then shows the not-saved message. Cancel or Escape closes it without changes. |
| Availability (list action menu) | Disabled menu item, with "Backend integration pending" shown. |
| Availability (form checkbox) | A form field only. It persists nothing. |
| Image | Local preview only (JPG/PNG/WebP). The file never leaves the browser. |
| Category reordering | Up/down buttons are `aria-disabled`, linked to an explanation, and do nothing. |
| Delete / archive | **Omitted** for items and categories until dependency and deletion behaviour are approved. |

## Proposed data model (PROVISIONAL)

Source: `src/lib/menu/types.ts`. Money reuses the Orders module's `Money` type: integer minor units (paise) plus a currency code.

```ts
MenuItem {
  id, name, description: string | null,
  categoryId: string | null, categoryName: string | null,
  price: Money, imageUrl: string | null,
  availability: "available" | "unavailable",
  variants: MenuVariant[], addOns: MenuAddOn[]
}
MenuVariant  { id, name, price: Money }   // relation to item price: undecided (M3)
MenuAddOn    { id, name, price: Money }   // grouping/limits: undecided (M4)
MenuCategory { id, name, description: string | null, position, itemCount }
```

### Form validation

These checks only make sure input is well-formed. They don't enforce business rules.

**Required**
- Item name: up to 120 characters.
- Price: a number up to 999999.99 with at most two decimals.

**Optional**
- Description: up to 500 characters.
- Category.
- Image.
- Variants and add-ons. If a row is added, it needs a name (up to 60 characters) and a valid price.

**Categories**
- Name: required, up to 60 characters.
- Description: optional, up to 500 characters.

## Unresolved decisions

| # | Question | What the UI does today |
|---|---|---|
| M1 | Must every item belong to a category? | Category is optional; items without one show "Uncategorised". |
| M2 | Can an item be in more than one category? | One category per item. |
| M3 | Variant price: does it replace the item price or add to it? Is a default variant required? | Stores a price per variant and states that the semantics are undecided. |
| M4 | Add-ons: are they per item or shared? Grouped (e.g. "Choose up to 2")? Min/max selections? Required add-ons? | Flat optional list per item, with no limits. |
| M5 | Default availability for new items. Scheduled or time-based availability. Stock or "sold out today". | New items default to Available in the form. Nothing is persisted. |
| M6 | Image formats, size limits, dimensions, storage. | Accepts JPG/PNG/WebP for local preview, with no size limit. |
| M7 | Category visibility or active flag. | Not modelled, not shown. |
| M8 | Deleting or archiving items and categories. What happens to items in a deleted category, and to items on open orders? | No delete or archive controls. |
| M9 | Is the category order per restaurant? Is item order within a category supported? | Category position is shown; reordering is disabled. |
| M10 | Other attributes from the legacy admin (veg/non-veg, discount, tax class, prep time, tags). | Not modelled. |
| M11 | Currency and locale per restaurant. | ₹ and `en-IN` formatting (shared with Orders). |

## Architecture

```
src/lib/menu/
  types.ts        provisional domain types
  query.ts        URL params -> validated MenuItemListQuery; link builder
  validation.ts   form drafts, input checks, price parsing helpers
  labels.ts       availability labels, "Backend integration pending" message
  errors.ts       MenuServiceError (not_configured | unavailable)
  service.ts      server-only entry point used by pages; picks the data source
  api-source.ts   INTEGRATION POINT: always "not_configured" today
  fixtures/       development fixtures only (see below)
src/components/menu/          list, toolbar, pagination, states, notices, item form,
                              priced-options editor, image picker, categories list, category dialog
src/components/ui/            + dialog, textarea, native-select (hand-written; no new packages)
src/app/(dashboard)/menu/     list, new, [itemId]/edit (+ not-found), categories
```

## Production safety

- **Default: API.** `api-source.ts` throws `not_configured`, and the pages show "Menu isn't connected yet" or "Categories aren't connected yet". The create form still renders so it can be reviewed, but its category field explains that categories aren't connected, and saving stops with the pending message.
- **Fixtures** are an explicit development opt-in: `FOODI_MENU_DATA_SOURCE=fixtures npm run dev`.
  - They're **refused when `NODE_ENV=production`**, even with the variable set.
  - Pages show an "Illustrative preview data" notice, ids start with `prv-`, and every item description reads "Preview description · illustrative menu item".
- **No fallback.** An API failure shows an error state with "Try again". It never shows fixtures.
- **Preview scenarios** (fixture mode only): `?preview=empty`, `?preview=error` and `?preview=slow`.

## API integration needs (PROPOSED, not implemented)

None of these endpoints exist. Paths assume the seller API proposed in the AUTH-01 audit. Every call is scoped to the restaurant in the session, and none takes a restaurant id from the client.

| Method + path | Purpose |
|---|---|
| GET `/api/v1/seller/menu/items?availability&q&category&page&pageSize` | Paginated list → `{ items, page, pageSize, totalItems, totalPages }` |
| GET `/api/v1/seller/menu/items/:id` | One item (404 if unknown or another restaurant's) |
| POST `/api/v1/seller/menu/items`, PATCH `/api/v1/seller/menu/items/:id` | Create / update (body as `MenuItem` without ids/derived fields) |
| PATCH `/api/v1/seller/menu/items/:id/availability` | `{ availability }` |
| POST `/api/v1/seller/menu/items/:id/image` | Image upload (or a signed-upload flow; see M6) |
| GET / POST / PATCH `/api/v1/seller/menu/categories[/:id]` | List with `itemCount`, create, update |
| PUT `/api/v1/seller/menu/categories/order` | `{ categoryIds: string[] }` |

Also needed:
- server-side validation matching or superseding the client checks
- an ETag or version for concurrent edits
- field-level validation errors the form can map onto its fields

## Not covered by automated tests

The repository has no test runner (adding one needs approval). Behaviour was checked with Playwright scripts only. There are no unit tests for `parseMenuItemListQuery`, `validateMenuItemDraft`, `validateCategoryDraft` or fixture filtering.
