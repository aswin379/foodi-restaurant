# Reviews UI (B6a)

The Reviews screens follow PRD v0.3 §1 module 13 (R1: view and reply) and §6
Reviews (list, filters by rating and replied/unreplied, reply, report abuse),
with the B6a decisions R1–R9 below. No reviews API exists yet, so production
shows "Reviews aren't connected yet". Everything works only against labelled
preview data. Everything below about the API is a **PROPOSAL** awaiting the
backend team (PRD §9.1): none of it is implemented, approved or agreed.

The panel manages reviews that already exist. Creating a review is not part of
it, and nothing here changes the PRD's R2/R3 scope (review alerts, Google
reviews, sentiment insights).

## Decisions applied

| # | Decision | Where it shows |
|---|---|---|
| R1 | Five stars, whole numbers 1–5 | `isReviewRating` (`types.ts`); the API mapping refuses anything else; stars are announced as "4 out of 5 stars" |
| R2 | A rating is required, the text is optional | `Review.text` is `string \| null`; a rating-only review says "Rating only, no written review" in the list and the detail |
| R3 | Display name only | `Review.reviewerName`; the mapping reads no other customer field, so a phone or email in a response can't reach the screen; without a name the UI says "Name not shared" |
| R4 | An order link only for a real order reference | `Review.order` is `{ id, reference } \| null`; a malformed reference is an error, a missing one means no link; nothing is inferred |
| R5 | Replies are at most 1,000 characters | `REVIEW_REPLY_MAX_LENGTH`, shared by the form and the Server Action (see "Validation") |
| R6 | No edit or delete of a reply; one reply per review | `canReply` (`rules.ts`); the form is replaced by the saved reply, with no edit, delete or second-reply control |
| R7 | Moderation and publication status only when the source supplies it | `Review.moderation` and `ReviewReply.publication` are `null` unless given; the UI says nothing about visibility or approval otherwise |
| R8 | Reports need a reason, "Other" needs a note, and a report never hides a review | `parseReviewCommand`; a report only records the report |
| R9 | Owner-only UI for now | no staff or role features; the backend must still authorise every request |

Not decided by R1–R9 and assumed here, so please confirm or change:
- A reply's text is stored trimmed, with line breaks kept.
- The 1,000-character limit counts characters as a person does (an emoji is
  one), on the trimmed text.
- One report per review from this restaurant. Once the source shows a report,
  the Report button is replaced by its details.
- The status names below and the report reasons are proposals.

## Routes

| Route | What it is |
|---|---|
| `/reviews` | The list: rating filter, reply-status filter, pagination, a reset action |
| `/reviews/[reviewId]` | One review: the full text, a reply form or the saved reply, the order link, and report abuse |

Filters live in the URL, so they survive a reload, the back and forward
buttons, and sharing:

`/reviews?rating=<1-5>&replied=<replied|unreplied>&page=<n>`

- URL parameters are untrusted. Only an exact `1`–`5`, `replied`, `unreplied`
  or a positive whole number is accepted. Anything else ("3.5", "03", "5abc",
  "0", "-1") falls back to the default, like the Orders and Menu lists.
- Changing a filter returns to page 1. A page past the end shows the last page.
- A review's link carries the list's filters (`/reviews/prv-rev-005?rating=5&replied=unreplied`),
  so "All reviews" on the detail page returns to the same view.
- Dates are shown in the restaurant's time zone and locale, from the shared
  restaurant context (not a second one).
- Nothing counts or averages reviews: no totals beyond "Showing 1–10 of 28",
  no averages, no trends. Those are analytics (B5b, Reports).

The list is a table from `md` up and cards below, like the order history. An
unknown review id shows "Review not found", never another review.

## Model (`src/lib/reviews/types.ts`, PROPOSED)

```ts
type Review = {
  id: string
  rating: 1 | 2 | 3 | 4 | 5
  text: string | null                 // R2
  reviewerName: string | null         // R3: a display name only
  createdAt: string                   // UTC instant
  reply: { text: string; repliedAt: string; publication: ReplyPublicationStatus | null } | null
  moderation: "published" | "under_review" | "hidden" | null   // R7
  report: { reportedAt: string; reason: string; note: string | null } | null
  order: { id: string; reference: string } | null              // R4
}
type ReplyPublicationStatus = "published" | "pending_approval" | "not_published"
```

The PRD names no review fields. These are the smallest shape R1–R9 need.
The status values are placeholders for what the backend may provide:
- When `moderation` or `publication` is `null`, the screens say nothing about
  visibility or approval.
- An unknown value is an integration error, never guessed.
- The panel never sets either one: a new reply has `publication: null`, and a
  report leaves `moderation` as it was.

## Reply (R5, R6, R7)

- The form is "Write a reply" with a character counter, a note that a reply
  can't be edited or deleted after sending, and field errors tied to the
  textbox (`aria-invalid`, `aria-describedby`).
- Empty or blank replies are refused. 1,000 characters are accepted and 1,001
  are refused ("It is 1 over."). The same `validateReply` runs in the browser
  and in the Server Action.
- After a reply is recorded, the form disappears and the reply is shown with
  its date. There is no edit, delete or second-reply control, and a second
  reply is refused by the rules (and must be refused by the backend).
- The message on success is "Reply submitted", never "published" or "visible
  to customers". The reply's publication status is shown only when the source
  provides one.
- Every attempt carries an idempotency key. A failed request keeps its key, so
  retrying the same reply can't apply it twice; an edited reply gets a new key.
- A request that fails before the action answers (offline, server error) shows
  "Your request couldn't be sent, so nothing was changed…" as an alert. The
  text stays in the form, and no success notification is shown.

## Report abuse (R8)

- "Report abuse" opens a confirmation dialog (`ConfirmDialog`) with the shared
  `ReasonPicker`. A reason is required, and "Other" needs a non-empty note.
  The user must press "Submit report".
- The dialog says the report doesn't hide or remove the review and isn't a
  moderation decision. After a report, the page says "You reported this
  review" with the reason, and that it isn't a moderation decision. Nothing
  says the review was removed, hidden, looked into or judged abusive.
- The review stays visible and unchanged unless the source says otherwise.
- Escape and Cancel close the dialog without sending anything and return focus
  to the button. A failed request stays inside the dialog as an alert, and the
  retry reuses the key.

**Proposed report reasons** (`src/lib/reviews/reasons.ts`). No taxonomy exists
in the PRD or the shared code (the shared lists are for rejecting and
cancelling orders), so this starting list is provisional, not a backend
contract:

| Value | Label |
|---|---|
| `spam_or_fake` | Spam or a fake review |
| `abusive_language` | Offensive or abusive language |
| `personal_information` | Contains personal information |
| `not_about_restaurant` | Not about this restaurant |
| `other` | Other (a note is required) |

## Validation

| Rule | Where |
|---|---|
| Reply: trimmed, not empty, at most 1,000 characters (counted as characters, not UTF-16 units) | `validation.ts` |
| Report: a reason from the list; a note for Other; a note of at most 500 characters (the shared limit) | `commands.ts` with `@/lib/forms/reasons` |
| Commands: only `reply` and `report_abuse` are accepted; unknown fields are dropped | `commands.ts` |
| Idempotency key: a UUID, required for every command | the Server Action |
| Review id in a command: `[\w-]{1,100}` | the Server Action |

The backend must enforce the authoritative limits, rules and permissions: the
UI's copies are a convenience, and a hidden control is not security.

## Data sources

`src/lib/reviews/service.ts` uses `selectAdapter()` with the new
`FOODI_REVIEWS_DATA_SOURCE`.

- **API** (default; the only mode in production): the transport reports
  `not_configured`, so the pages show "Reviews aren't connected yet". There is
  no fallback. A permission refusal shows "You don't have permission to see or
  answer reviews".
- **Preview** (`FOODI_REVIEWS_DATA_SOURCE=preview`, development only):
  - 28 isolated sample reviews in the B0 preview store, with made-up names;
  - replies and reports are simulated, idempotent (a repeated key replays the
    stored result; a key reused for a different request is refused), and
    labelled "Preview only, not saved to Foodi";
  - **Reset sample reviews** restores the starting data and clears replayed
    keys;
  - a **Refuse replies and reports, as for someone who isn't the owner** tool
    makes every reply and report fail as a backend 403 would;
  - `?preview=empty|error|slow|forbidden` shows those load states;
  - it never touches orders, menu, hours or settings data.

Production refuses preview mode whatever the variable or URL says. The preview
store, the preview tools and the scenario parameters all refuse to run there,
and the API adapter ignores scenarios.

Preview sample reviews link to completed sample orders (`PRV-1016` and so on),
and a test keeps those links in step with the orders fixtures.

## Proposed API (PROPOSED, not implemented, not agreed with the backend team)

Paths are in `src/lib/reviews/api-source.ts`; the response mapping that
refuses malformed data is `src/lib/reviews/api-mapping.ts`.

| Operation | Request | Response |
|---|---|---|
| List | `GET /seller/reviews?rating=<1-5>&hasReply=<true\|false>&page=<n>&pageSize=<n>` (a filter is left out when not set) | `{ items: Review[], page, pageSize, totalItems, totalPages }`, newest first |
| Detail | `GET /seller/reviews/{id}` | `Review`, or 404 |
| Reply | `POST /seller/reviews/{id}/reply` with `{ text }` and an idempotency key | the updated `Review` |
| Report abuse | `POST /seller/reviews/{id}/reports` with `{ reason, note \| null }` and an idempotency key | the updated `Review` |

The client refuses the response, and the screen shows its error state, when:
- an item has a rating outside 1–5 or not a whole number;
- an id, date, reply or report is malformed;
- a moderation or publication status is unknown;
- a text or name is an empty string (use `null` or leave it out);
- an order reference is malformed (a missing one means no link);
- the paging is inconsistent.

A review the mapping can't read fails the whole page instead of being dropped.
The mapping reads only the documented fields, so contact details in a response
never reach the screen.

Errors the UI expects: `403` (permission), `404` (no such review), `409` (a
reply or report already exists), `422` with field errors.

## Backend dependencies and open decisions

Backend:
- The four operations above, with the list sorted newest first and filterable
  by rating and by whether a reply exists.
- Server-side enforcement of: the 1,000-character reply limit, one reply per
  review, no reply edit or delete, one report per restaurant per review, the
  report reason list, and owner authorisation (R9).
- Audit logging of replies and reports, and idempotent handling of the key.
- Whether and when a reply or a report changes a status, and the status
  values themselves.

Open product decisions:
- The status values, and whether a reply needs approval before customers see it.
- Whether a restaurant may withdraw a report, and what Foodi tells it afterwards.
- The final report reasons.
- Whether a review's order reference is available and appropriate to show.
- Who besides the owner may reply or report, once staff and roles (module 20)
  exist.
- Whether the sidebar should show a count of unreplied reviews (that is a
  figure, so it needs a server-supplied count).

Known limits of B6a:
- The panel doesn't refresh reviews on its own. There is no live polling for
  this screen, and a new review appears on the next load.
- No review alerts (R2), no Google reviews (R2), no sentiment (R3), no
  averages or trends (analytics, B5b).
- Production can't show any review until the API exists.

## Known accessibility exception (pre-existing, not Reviews-specific)

The Reviews screens pass the automated accessibility checks (axe, WCAG 2.2 AA
tags) at rest at 390, 820 and 1440 px, and with the report dialog open **when
the pointer is not resting on one of its buttons**. They are **not** fully
compliant in that one interactive state:

- The shared default Button (`src/components/ui/button.tsx`,
  `bg-primary text-primary-foreground hover:bg-primary/90`) measures **4.27:1**
  while hovered, below the 4.5:1 minimum for 14px text.
- It predates B6a and affects every module's default buttons (confirmed on the
  B1 order history). B6a doesn't change the shared Button, and it isn't
  suppressed: it is left for its own change (a follow-up task was suggested).
- The browser tests keep this visible instead of hiding it:
  - the dialog check moves the pointer away and says so in its name;
  - a `KNOWN ISSUE` test hovers a default button, asserts that exactly this one
    `color-contrast` finding (4.27:1) is still the only serious issue, and
    carries a `known-issue` annotation in the report. It fails the day the
    Button is fixed, which is the cue to delete it and the pointer-away step.

## Tests

- **Unit** (`src/lib/reviews`):
  - URL parsing of untrusted parameters and the URL builders;
  - reply validation at 1,000 and 1,001 characters, empty, whitespace and emoji;
  - command parsing: report reason, the conditional note, unknown actions and
    dropped fields;
  - the rules: one reply, one report, no status changes;
  - strict API mapping: ratings, optional text, statuses, replies, reports,
    order references, contact details and paging;
  - the API adapter's requests;
  - the service:
    - production refusal, ignored scenarios, and no fallback;
    - filters and paging;
    - idempotent replay and key reuse;
    - the non-owner refusal tool;
    - reset;
    - isolation from orders, menu and hours.
- **Component** (`src/components/reviews`):
  - the reply form's labels, errors, counter, failure, refusal and retry
    (same key; a new key when the text changes);
  - the report dialog: reasons, the note for Other, failure, Escape and Cancel
    returning focus;
  - no second reply or report after one exists;
  - rating-only reviews, reviews without a name or an order link, and
    statuses shown only when supplied;
  - the filter and pagination links, dates in the restaurant's time zone, and
    the load-failure states.
- **Browser, preview** (`tests/e2e/preview/reviews.spec.ts`): list, filters,
  pagination, URL state across reload and history, detail navigation and the
  states; reply, report, failed requests with retry, the non-owner refusal,
  and keyboard use; axe, overflow and console checks at 390, 820 and 1440 px.
  The file runs one test at a time and each starts from the reset sample
  reviews, because replies and reports change the shared preview store; each
  test that changes a review uses its own review.
- **Browser, production** (`tests/e2e/production/production.spec.ts`): the
  navigation link, "Reviews aren't connected yet" on every URL including
  scenario parameters, and no sample reviews, reply or report controls, preview
  labels or tools.
