# Restaurant Menu UI (B2)

The Menu screens follow PRD v0.3 §5 with D7 and Q11
(`docs/product/foodi-2-restaurant-panel-prd.md` on the PRD branch). They use
the shared foundations from B0 (`docs/foundations.md`). No menu API exists
yet, so production shows "Menu isn't connected yet". Every change works only
against labelled preview data.

## Routes

| Route | What it is |
|---|---|
| `/menu` | Items with status filters (All, Available, Sold out, Archived), search and category filter |
| `/menu/new` | Add an item |
| `/menu/[itemId]/edit` | Edit an active item (archived items are restored from the list first) |
| `/menu/categories` | Categories in menu order, with reorder, on/off, archive, restore and delete; a category schedule since B3b |
| `/menu/meal-periods` | Reusable meal periods (B3b, see [meal-periods-ui.md](meal-periods-ui.md)) |

## Menu model (PRD §5)

- **Category is mandatory** for every active item (D7). Archived items keep
  their last category for history.
- **Sizes** (optional): the customer picks exactly one, and its price
  **replaces** the base price.
  - Without sizes, the base price is required.
  - With sizes, the list shows "From" the cheapest size.
  - Each size has its own available switch.
- **Option groups** (optional):
  - Each group is One option (single) or Several options (multiple), with
    **Required** on/off.
  - Single choice is always min 0/1, max 1.
  - Multiple choice has "At most" and, when required, "At least". Limits are
    checked against the number of options.
  - Each option has an **added price** (blank or 0 = free) and an available
    switch.
  - A required single-choice group needs at least one available option.
- **Details:**
  - food type (veg, non-veg, egg, vegan), shown as the square food-type mark
  - spice level
  - tags (bestseller, new, chef's special)
  - allergens
  - optional calories
- **Image:** JPG, PNG or WebP, up to 2 MB.
  - The browser centre-crops it to a square and compresses it (WebP, falling
    back to JPEG) before sending, so the request stays under the default 1 MB
    Server Action limit.
  - The server checks the result again (type and size).
  - The real backend still needs an upload endpoint with server-side
    compression.
- **Order types and schedule** section (main column):
  - **Order types** (delivery, takeaway, dine-in; at least one): what the
    item is offered for at all.
  - **Schedule** (see below), which can only narrow those order types.
- **Availability card:**
  - "Available now"; turning it off marks the item **sold out** until next
    opening, end of day, 1, 2 or 4 hours from now, or until switched back on,
    with an optional reason.
  - The note "Hidden from customers while unavailable." (Q11/G5). The panel
    has no visibility setting; hiding happens in the customer app.

## Item schedules (`src/lib/menu/schedule.ts`, PRD §3.2, §3.4, Q12, Q13)

- **Always available** (default) or **Only at set times**.
- Set times: choose days. Each chosen day is **All day**, has **time
  windows** (up to 6), or both (see below).
  - "Add window", remove, **Copy {day} to…** (replaces the chosen days'
    whole schedule, All day included) and a per-window **Copy** (adds that
    window, with its order types, to the chosen days).
  - Pickers step in 15 minutes; the server accepts any minute.
  - Windows must be at least 15 minutes and can't start and end at the same
    time.
  - An end before the start is an **overnight** window that belongs to its
    start day (§3.2): Saturday 22:00–01:00 runs into Sunday. The editor says
    so and summaries show "(+1 day)".
- **Order types per window (Q12, option A):** every window and every All day
  entry names one or more of Delivery, Takeaway and Dine-in.
  - Example: Monday 11:00–15:00 for dine-in and takeaway, 18:00–22:00 for
    delivery only (the sample item "Butter chicken").
  - **Relationship with the item's own order types:** those stay as the outer
    limit (PRD §3.4 Channels, and §3.1 "narrowing only"). They sit directly
    above the schedule. A window can only use order types the item is offered
    for: the others can't be ticked, and if one is already ticked (say,
    delivery was switched off for the item afterwards) validation says so
    instead of dropping it silently.
  - New windows start with the item's order types, minus any already
    available all day that day.
- **All day (Q13, option A):** an explicit per-day option, stored as its own
  entry, never as `00:00–00:00` or `00:00–23:45`. It means the whole calendar
  day, midnight to midnight, in the restaurant's time zone (23 or 25 hours on
  a daylight-saving change; the backend works that out). It has its own order
  types.
  - **With timed windows on the same day:** allowed only for other order
    types. Saturday All day for takeaway and dine-in plus 18:00–22:00 for
    delivery is valid (the sample item "Filter coffee"). A timed window for an
    order type that's already available all day is redundant and is refused:
    "Takeaway is already available all day on Saturday."
  - Turning All day on removes only untouched empty window rows; windows with
    times stay and must use other order types. Turning it off keeps the
    windows.
- **Merging on save (§3.2):** overlapping or touching windows are merged
  **per order type**, then order types with identical times share one window.
  Two overlapping delivery windows become one; a dine-in window overlapping a
  delivery window stays separate. The editor shows the result ("Overlapping
  windows will be saved as …") and a "Saves as" summary.
- **Validation** (shared by the browser and the server):
  - at least one day; every chosen day has All day or a window
  - times present and valid, at least 15 minutes, at most 6 windows a day
  - every window and All day entry has at least one order type, all offered by
    the item
  - no timed window repeats an order type that's available all day
- **Time zone:** times are local to the restaurant's IANA zone from the
  restaurant context (preview: `Asia/Kolkata`), never the browser's. The
  server stamps the zone on save; the browser can't set it. If a saved
  schedule's zone differs from the restaurant's current zone, the editor
  warns, and the list names the saved zone.
- **Only narrows availability (§3.1):** restaurant hours, pauses, holidays,
  the category, the item's order types, sold out, stock and server rules
  still apply, All day included. The panel never decides whether an item is
  orderable right now; the backend's availability evaluator does.
- **Display:** the list shows custom schedules under the item name, one line
  per group of days, at most 2 lines and then "+N more". Order types appear in
  brackets only where they narrow the item's own, e.g.
  "Mon–Fri 11:00–15:00 (Takeaway, Dine-in), 18:00–22:00 (Delivery)" or
  "Sat, Sun All day (Takeaway, Dine-in), 18:00–22:00 (Delivery)".

### Schedule shape and backend contract (PROPOSED, needs backend agreement)

Frontend model (`ItemSchedule`), also the proposed wire shape:

```ts
type ItemSchedule =
  | { mode: "always" }
  | {
      mode: "custom"
      timeZone: string // restaurant's IANA zone, set by the server
      weekly: Array<{
        days: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">
        allDay: { channels: OrderType[] } | null // Q13; null = no All day entry
        windows: Array<{ start: "HH:MM"; end: "HH:MM"; channels: OrderType[] }> // Q12
      }>
    }
// OrderType = "delivery" | "takeaway" | "dine_in" (PRD names; API names via src/lib/api/mapping.ts)
```

- This is the PRD §3.2 shape as updated for Q12 and Q13: `channels` moved from
  the schedule to each window, and `allDay` is new. It's a dependency on the
  backend team (PRD §9.1): the evaluator, the menu API and checkout must
  accept and evaluate it before this can go live.
- **Compatibility:** `src/lib/menu/schedule-api.ts` reads the older shape. A
  window without `channels` takes the schedule-level `channels` if present,
  otherwise all of the item's order types (§3.2 "default all", narrowed by
  the item). A missing `allDay` means none. Unknown order types or days are
  integration errors, never guessed.
- **Order-type names** go through `toApiOrderType`/`fromApiOrderType` in
  `src/lib/api/mapping.ts` (see "Order-type names in the API" below).
- **Saving:** `save_item` sends the editor draft (`days` with `enabled`,
  `allDay`, `windows` with `key`, `start`, `end`, `channels`). The server
  validates it with the same rules, merges windows and returns the stored
  shape above.
- The backend evaluator must treat All day as the full local calendar day
  for the listed order types, and apply every higher level (§3.1) on top.

### Added in B3b

- **Meal periods** (§3.4's third option): a schedule can be always available,
  one or more meal periods (each for some of the owner's order types), or
  custom times; never meal periods and custom times together.
- **Category schedules** with the same three options, bounded by the
  category's order types.
- **Restaurant-hours check** in the item editor (§3.2 gap warning), advisory
  only.

`always` and `custom` are unchanged. Shapes, legacy handling, rules and
backend dependencies: [meal-periods-ui.md](meal-periods-ui.md).

## Rules (`src/lib/menu/rules.ts`)

One pure function, `applyMenuCommand()`, applies every change and refuses
anything the rules don't allow. Refusals carry wording written for the
restaurant (`ServiceError.userMessage`), which is the only error text ever
shown.

| Command | Rule |
|---|---|
| Save item | Category must exist and be active (not archived); archived items can't be edited; new sizes, groups and options get server-made ids |
| Sold out / available | Active items only; records until, reason, time and who |
| Archive item | Removes it from the menu, keeps history |
| Restore item | Only into an active category |
| Delete item | Only items never ordered; ordered items can only be archived |
| Save category | Unique name among active categories; renaming updates the items' category name |
| Move category | Swaps with its neighbour; refused at either end |
| Archive category | Only once its items are moved or archived |
| Restore category | Goes to the end of the menu order |
| Delete category | Only with no items (archived ones included) and no order history |

Item status on the list is decided by `itemStatus()`, in this order:
1. Archived.
2. Category off.
3. Sold out (with its until time).
4. Available, noting any order types it's off for, from the item or its category.

## Validation (`src/lib/menu/validation.ts`)

The same functions run in the form and in the Server Action
(`src/app/(dashboard)/menu/actions.ts`). Untrusted input is first turned into a
well-typed draft (`src/lib/menu/commands.ts`: unknown values are dropped, ids
must be `[\w-]`), then validated. Errors are keyed by field path, such as
`groups.<key>.max`; the form uses them for inline errors and for a summary
whose links move focus to the field.

## Provisional values (not approved)

| What | Where |
|---|---|
| Allergen list | `src/lib/menu/types.ts` |
| Spice levels | `src/lib/menu/types.ts` |
| Limits: 10 sizes, 10 groups, 20 options per group, 5,000 calories | `src/lib/menu/validation.ts` |
| Sold-out durations (1, 2, 4 hours) | `src/lib/menu/validation.ts` |
| Image compression: 800 px square, ≤ 700 KB after compression | `src/components/menu/image-picker.tsx`, `validation.ts` |

## Data sources

`src/lib/menu/service.ts` uses the shared `selectAdapter()` from B0.

- **Default: API** (`api-source.ts`). Every call goes through the shared
  transport, which reports `not_configured`.
- **Preview** (`preview-source.ts`) is an explicit development opt-in:
  `FOODI_MENU_DATA_SOURCE=preview npm run dev`. The older value `fixtures`
  also works.
  - Refused in production, even with the variable set.
  - The menu is one record in the B0 in-memory preview store, so each change
    is applied as a whole. Nothing reaches Foodi, and it resets on restart.
  - Repeating a request with the same idempotency key returns the stored
    result; reusing a key for a different change is refused.
  - Every page shows "Preview only, not saved to Foodi", and so does every
    success notification.
  - Sample ids start with `prv-`. "Used on orders" flags are invented to try
    archive and delete.
  - A **Reset sample menu** preview tool. It sits inside the streamed list
    section, so its dialog can't open before the list has hydrated.
  - `?preview=empty|error|slow` shows the empty, error and loading states.
- **No fallback.** If the API errors, the UI shows an error with "Try again".

## Proposed API contract (PROPOSED, for the backend team)

None of these endpoints exist. They're listed in `api-source.ts`. Paths, the
prefix and enum names are §9.1 decisions. Every call is scoped to the
restaurant in the session.

| Method + path | Request | Response |
|---|---|---|
| GET `/seller/menu/items` | `filter`, `q`, `category`, `page`, `pageSize` | `{ items: MenuItem[], page, pageSize, totalItems, totalPages }` |
| GET `/seller/menu/items/:id` | none | `MenuItem`, or 404 |
| GET `/seller/menu/categories` | none | `MenuCategory[]` with active item counts |
| POST `/seller/menu/commands` | a `MenuCommand` (`src/lib/menu/commands.ts`) plus an idempotency key | `MenuCommandResult`; 409 with a user-facing message when a rule refuses; 422 with field errors |

### Order-type names in the API

Order types appear in menu data as **record keys** (item and category
`channels: { delivery, takeaway, dine_in }`) and as **values** (schedule
`channels` arrays). `src/lib/menu/api-mapping.ts` translates both, through
`src/lib/api/mapping.ts`, which is still the only place backend names live:

- responses: items (list, detail, command results) and categories
- requests: `save_item` (item `channels` and the schedule draft) and
  `save_category` (category `channels`)
- unknown, missing or non-boolean order types in a response are integration
  errors ("unavailable"), never guessed
- the mapping table is identity until the backend names are fixed (§9.1);
  tests use a stand-in `takeaway` → `pickup` to prove every path is mapped

The backend also needs:
- an image upload endpoint with server-side compression
- "used on orders" tracking
- resolving "next opening" and "end of day" against restaurant hours (B3)
- the item schedule shape with per-window order types and All day (see
  "Schedule shape and backend contract")
- `menu.item.availability_changed` events (PRD §3.7)

## Deferred

- **Seasonal dates, recurring holidays, size/option schedules, slot
  capacity, last-order time and order-ahead:** not in B3b. (Category
  schedules, meal periods and the restaurant-hours check arrived in B3b.)
- **Channel-specific prices:** Q4 is open.
- **Translations:** B4.
- **Subcategories:** not in §5's requirements.
- **Item order within a category, and drag-and-drop:** the categories page
  has a keyboard-friendly priority list instead.
- **Release 2:** seasonal dates, daily stock counts, reusable option groups,
  maximum quantity per option, bulk edit, CSV import.

## Tests

- **Unit** (`npm test`):
  - validation (sizes, groups, limits, images, categories)
  - schedules: validation, multiple windows, order types per window, All
    day and its combinations with windows, per-order-type merging,
    overnight windows, day grouping and display, editor and parser
    round-trips, untrusted input, the server's time zone
  - the schedule API mapping: round-trips, the older shape, unknown values
  - the API adapter's order-type mapping for items, categories, schedules,
    saves and command results, with a non-identity stand-in name
  - server-side re-validation of schedule order types and All day
  - command parsing of untrusted input
  - the menu rules for every command
  - item status and "From" price
  - the preview adapter: filters, D7, counts, idempotent replay, reset,
    production refusal
  - the service: production refusal (including a scheduled save), no
    fallback, and a preview save stamped with the restaurant's zone
- **Browser** (`npm run test:e2e`):
  - **Production build:** the Menu pages show "not connected" with no preview
    tools or item controls.
  - **Preview, at desktop and mobile:**
    - status filters
    - sold out with a duration and reason, then available in one tap
    - required fields with focusable error links
    - sizes replacing the price, and option-group limits
    - editing keeps sizes and options
    - a schedule with several windows, copy to days, an overnight window,
      the time-zone label, a preview-only save and the list summary
    - schedule validation, merged overlaps and copying one window
    - different order types per window, no order type, All day with timed
      windows for other order types, the redundant-combination error, the
      item's order types as the outer limit, and the round-trip into the
      editor
    - sample schedules with order types and All day in the list
    - image type and size checks, and the square preview
    - archive, restore and delete rules
    - keyboard reordering
    - the category archive rule message
    - add, switch off and delete a category
    - every page passes axe, has no horizontal overflow, and logs no console
      errors
