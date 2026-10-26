# Meal periods, category schedules and hours warnings (B3b)

B3b adds three things to the Menu (PRD v0.3 §3.1, §3.2, §3.4, decisions H1,
H6, H10):

- reusable **meal periods**
- **category schedules**
- advisory **restaurant-hours warnings** in the item editor

No menu API exists yet, so production shows "isn't connected yet" and every
change works only against labelled preview data. All shapes, paths and fields
below are **PROPOSED** and need backend agreement (PRD §9.1). The backend
doesn't support any of them yet.

This page was written before the code changed, as the B3b approval asked.

## 1. Schedule shapes

### Before B3b (B2, unchanged)

```ts
// src/lib/menu/schedule.ts
type ItemSchedule =
  | { mode: "always" }
  | {
      mode: "custom"
      timeZone: string // restaurant's IANA zone, stamped by the server
      weekly: Array<{
        days: Weekday[]
        allDay: { channels: OrderType[] } | null // Q13
        windows: Array<{ start: "HH:MM"; end: "HH:MM"; channels: OrderType[] }> // Q12
      }>
    }

type MenuItem = { /* … */ channels: ChannelSettings; schedule: ItemSchedule }
type MenuCategory = { /* … */ channels: ChannelSettings } // no schedule
```

### After B3b

```ts
/** One meal period used by an item or category, for some of its order types (H1). */
type MealPeriodRef = { periodId: string; channels: OrderType[] }

type ItemSchedule =                     // same name; also used for categories
  | { mode: "always" }                  // unchanged
  | { mode: "custom"; timeZone; weekly } // unchanged
  | { mode: "meal_periods"; periods: MealPeriodRef[] } // NEW

type MenuCategory = { /* … */ channels: ChannelSettings; schedule: ItemSchedule } // NEW field

type MealPeriod = {
  id: string
  name: string                // unique among active periods, case-insensitive
  status: "active" | "archived"
  weekly: DayRule[]           // times only: { days, allDay: boolean, windows: { start, end }[] }
  usage: { items: UsageRef[]; categories: UsageRef[] } // computed by the server
  usedOnOrders: boolean       // computed by the server
  version: string             // optimistic concurrency for the shared definition
  updatedAt: string | null
  updatedBy: string | null
}
type UsageRef = { id: string; name: string; archived: boolean }
```

How the shapes behave:

- **One kind of schedule per level.** A schedule is always available, one or
  more meal periods, or custom times. It never mixes meal periods with custom
  windows at the same level; the type makes that impossible.
- **Meal periods hold times only (H1).** Each reference picks which of its
  owner's enabled order types use that period. Lunch can serve dine-in for one
  item and delivery for another.
- **Times use the restaurant's zone.** A meal period's times are in the
  restaurant's IANA zone at evaluation time. They have no stored zone of their
  own (see §6 for DST).
- **Same rules as restaurant hours.** `DayRule` is the type restaurant hours
  use (B3a), and the same rules apply:
  - overnight windows belong to their start day;
  - All day can't be combined with windows on the same day;
  - windows are at least 15 minutes, with at most 6 a day;
  - overlapping windows merge on save.

## 2. Reading and writing legacy schedules

- **`always` and `custom` don't change.**
  - Their validation, merging, display and drafts are untouched. So is
    `scheduleFromApi`'s handling of the older shape (a window without
    `channels` takes the schedule-level `channels`, otherwise the item's order
    types).
  - Saved B2 items read and save byte-for-byte as before; tests prove the
    round-trip.
- **`meal_periods` is parsed strictly.**
  - It needs a `periods` array. Each entry needs a string `periodId` and a
    `channels` array of known order types.
  - It has no legacy form, so nothing falls back. Anything else is an
    integration error ("unavailable"), never guessed.
  - An unknown `mode` is still an error, as in B2.
- **Drafts.** `ScheduleDraft` gains
  `{ mode: "meal_periods"; periods: { periodId, channels }[] }`.
  `scheduleDraftFromInput` (untrusted browser input) parses it and drops
  invalid ids and unknown order types. Validation then reports what's missing.
  - **Unchanged on purpose:** any other or missing input still becomes
    "always", exactly as in B2.

## 3. Missing fields

| Field | When missing or `null` | Why |
|---|---|---|
| `MenuItem.schedule` | `always` | Unchanged B2 rule |
| `MenuCategory.schedule` | `always` | B2 categories had no schedule, so "none" is the existing meaning, not a reinterpretation. A backend without category schedules still loads |
| `save_category` draft `schedule` | **The saved schedule is kept** (new category: `always`) | A caller that doesn't send it, like an older client, can't wipe a category's schedule |
| `MealPeriod` fields | Integration error | New type, no legacy data |
| A referenced meal period not in the loaded list | Shown as "Unknown meal period"; warnings say "Unable to evaluate schedule" | Never guessed |

## 4. Rules (`src/lib/menu/rules.ts`, enforced again by the backend)

### Item and category saves

- Every referenced meal period must exist and be active:
  - an unknown period is refused with "This meal period no longer exists.";
  - an archived period is refused with "{name} is archived. Choose another
    meal period or restore it."
- A reference's order types must be on for the owner, using the same check
  as custom windows. For categories the check is against the category's own
  order types.
- Each period can be referenced only once per schedule, with at most 6
  periods.

### Restoring

- Restoring an item or category whose schedule uses an archived meal period
  is refused: "Restore the {name} meal period first."
- This situation can't arise from B2 data, so B2 behaviour doesn't change.

### Meal-period commands

These are new `MenuCommand`s sent to the existing proposed
`POST /seller/menu/commands`.

| Command | Rule |
|---|---|
| `save_meal_period` | Name 1–40 characters, unique among active periods. Valid weekly times. Archived periods can't be edited. Editing needs the `version` that was loaded; a stale one is refused ("changed since you opened it") |
| `archive_meal_period` | Only when no **active** item or category uses it. The refusal names how many do |
| `restore_meal_period` | Refused if an active period now has the same name |
| `delete_meal_period` | Only when nothing uses it (archived items and categories included) and it has no order history. Otherwise archive it |

Other rules:

- **Editing a period** changes the shared definition only, meaning its times
  and name. Every reference keeps its own order types. The editor lists every
  item and category that uses the period before you save.
- **No presets.** The list starts empty.

## 5. Parent and child order types

- **The item editor shows the category's limits.** An order type that's off
  for the item's category is shown as off. You can't tick it (a child never
  enables what its parent disables). If the item already has it ticked, it
  stays ticked and can be unticked.
- **Configured vs effective.** The editor shows both, e.g. "Configured:
  Delivery, Takeaway. Orderable for: Takeaway (Delivery is off for Mains)".
- **No new save-time refusal.** The B2 save rule is unchanged: an item may
  keep an order type its category has turned off. It's simply not orderable
  for it. The setting isn't silently changed, and applies again if the
  category turns that order type back on.
- **Effective availability** for each order type is the intersection of every
  level:

  restaurant hours ∩ category order types ∩ category schedule ∩ item order
  types ∩ item schedule

  It's still decided by the backend's evaluator. The panel never decides it.

## 6. Restaurant-hours warnings (H10, `src/lib/menu/hours-warnings.ts`)

- **When they appear.** The item editor shows them below the schedule. They
  are advisory and never block saving.
- **What they compare.** Clock times on a weekly timeline, for each order type
  the item and its category both offer:
  - **Partly outside:** item ∩ category schedule time outside restaurant hours.
  - **Outside the category:** item schedule time outside the category's
    schedule.
  - **Never for a given order type:** the effective time is empty for that
    order type.
  - **Stronger warning:** the item appears **never orderable**. Either no
    order type has any effective time, or the category turns off every order
    type the item offers.
  - **Nothing outside:** "No conflicts with weekly restaurant hours".
- **What they leave out.** The label says so:
  - special dates, pauses and sold out;
  - the category being switched off;
  - daylight-saving changes (clock times only).
- **Not authoritative.** The panel says "Foodi decides actual availability".
- **"Unable to evaluate schedule"** is shown instead of guessing when:
  - restaurant hours or meal periods couldn't be loaded;
  - menu and hours come from different data sources;
  - the hours, restaurant or saved schedule time zones differ;
  - a referenced meal period is unknown or archived;
  - the item's category isn't in the loaded list.
- **No warning yet:** if the schedule has errors, or no category is chosen,
  the panel asks you to fix or choose first.

## 7. Convert to custom times

- **What it does.** In the editor, a meal-period schedule offers **Convert to
  custom times**. It copies each period's current times into custom windows
  with the reference's order types.
  - Windows already covered by an All day entry for the same order type are
    left out, so validation stays clean. The effective schedule is unchanged
    at the moment of conversion.
- **Checking for changes first.** Before converting, the editor re-reads the
  periods (Server Action `readMealPeriods`).
  - If one changed or disappeared since the page loaded, it says so and
    shows the current times. You confirm before it converts, using the
    current version.
  - If the check fails, nothing is converted.
- **The shared period isn't touched.** Only this item's or category's draft
  changes. Nothing is saved until Save.

## 8. API mapping (`src/lib/menu/api-mapping.ts`, `schedule-api.ts`)

- **Order types are mapped both ways.** `meal_periods` references carry them
  as values, so they go through `toApiOrderType`/`fromApiOrderType`:
  - in `scheduleToApi`/`scheduleDraftToApi`;
  - in `scheduleFromApi`, which refuses unknown order types.
- **Categories:**
  - `categoryFromApi` reads `schedule` against the category's own order types
    (missing → `always`);
  - `commandToApi` maps the `save_category` draft schedule;
  - `commandResultFromApi` maps the new `meal_period` result.
- **Meal periods** (`mealPeriodFromApi`) are parsed strictly:
  - a known `status`;
  - valid days and `HH:MM` times;
  - boolean `allDay`/`usedOnOrders`;
  - string `version`;
  - usage lists of `{ id, name, archived }`.

  They hold no order types.
- **Proposed endpoint**, new in `api-source.ts`:
  `GET /seller/menu/meal-periods` returns `MealPeriod[]`, archived included.
  Changes use the existing proposed `POST /seller/menu/commands`. Like every
  menu path, it reports `not_configured` until the API exists.

## 9. Data source

Meal periods are part of the menu, so they use `FOODI_MENU_DATA_SOURCE` and
the menu adapter. That keeps references and usage checks consistent, and
in preview they live in the same atomic preview record. The B3b proposal
mentioned a separate `FOODI_MEAL_PERIODS_DATA_SOURCE`; one menu source
avoids mixing preview periods with API items. The rest follows B2/B3a:

- production refuses preview data;
- there is no fallback;
- preview saves are labelled "Preview only, not saved to Foodi".

## 10. Backend dependencies (open)

None of these exist yet; production integration is not complete.

- **Meal-period storage on the server:** persistence, the reference and
  usage checks, order-history protection (`usedOnOrders`) and `version`
  checks, with the rules in §4 enforced there.
- **API fields:** support for the `meal_periods` item schedule and the
  category `schedule` field in the menu API (the paths in §8 are proposals).
- **Availability:** evaluation by the backend's availability evaluator, and
  enforcement at checkout, across every level in §5.
- **Daylight saving:** how meal-period times behave on DST changes. They're
  wall-clock times in the restaurant's zone, like custom schedules, and the
  warnings don't model the change.
- **H4** (overnight windows running into a special date) stays unresolved and
  isn't part of the warnings, which leave out special dates entirely.
- **P-2** (scheduled orders during a pause) stays unresolved; the warnings
  leave out pauses and make no claim about scheduled orders.
