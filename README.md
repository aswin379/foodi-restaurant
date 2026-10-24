# Foodi for Restaurants

Restaurant admin app for the Foodi platform, built with Next.js (App Router),
TypeScript, Tailwind CSS v4, shadcn/ui (new-york style, Radix) and Lucide icons.

## Development

```bash
npm install
npm run dev      # http://localhost:3000 → redirects to /login
npm run lint
npm run build
```

## Login page

- Route: `/login` (`src/app/(auth)/login/`)
- `login-form.tsx` – client form: controlled inputs, client validation,
  password toggle, loading/error states.
- `actions.ts` – `signIn` Server Action: re-validates input on the server and
  calls the auth integration point.
- `src/lib/auth/validation.ts` – shared client/server validation rules.

### Remaining integration work

1. **Authentication backend** – `src/lib/auth/authenticate.ts` is the only
   integration point. It currently returns `not_configured`, so sign-in
   always fails with an explanatory message; nothing is mocked. Connect the
   real Foodi auth API there, set the session server-side (httpOnly cookie),
   and return the authorised dashboard route as `redirectTo`.
2. **Route protection** – add a `proxy.ts` / session check for the dashboard
   once the session contract exists.
3. **Auxiliary links** – set `forgotPassword`, `restaurantOnboarding`, `terms`
   and `privacy` in `src/lib/auth/routes.ts` when those pages exist; each link
   stays hidden until then.
4. **Hero photography** – add a licensed restaurant photo under
   `public/images/` and set `heroImage` in
   `src/app/(auth)/login/brand-panel.tsx`.

## Dashboard shell

- Route: `/dashboard` (`src/app/(dashboard)/`). Every page added under the
  `(dashboard)` route group gets the shell from its `layout.tsx`.
- Shared components live in `src/components/dashboard/`:
  - `dashboard-shell.tsx`: sidebar, header, content container and the
    development notice.
  - `navigation.ts`: the single nav config. A module with `href: null`
    shows as a disabled "Soon" item. Give it a route once its page exists.
  - `page-header.tsx`, `stat-card.tsx`, `empty-state.tsx`: building blocks
    for module pages.
- KPI cards and dashboard sections show empty states. No sample or live data
  is rendered.

### Not yet protected

`/dashboard` is an **unprotected development preview**: anyone who can reach
the app can open it. A banner on every dashboard page says so. Before
production:

1. Add a session check in `src/app/(dashboard)/layout.tsx` (or `proxy.ts`)
   that redirects to `/login` when there's no valid restaurant session.
2. Load the restaurant's name for the header from that session instead of the
   "Your restaurant" placeholder.
3. End the session in `src/lib/auth/sign-out.ts`. Today it only redirects to
   `/login`, because no session is ever created.
4. Remove the development notice from `dashboard-shell.tsx`.

## Orders UI

`/orders` is the live order board, `/orders/history` the order history,
`/orders/[orderId]` the order detail and `/print/orders/[orderId]` the kitchen
ticket and bill. They follow PRD v0.3 §4. No orders API exists yet, so the
pages show "Orders aren't connected yet". To try every order action against
labelled sample data in development:

```bash
FOODI_ORDERS_DATA_SOURCE=preview npm run dev
```

Changes are simulated on the development server only ("Preview only, not
saved to Foodi") and reset when it restarts. Preview data is refused in
production builds. Details and the proposed API contract:
[docs/orders-ui.md](docs/orders-ui.md).

## Menu UI

`/menu`, `/menu/new`, `/menu/[itemId]/edit` and `/menu/categories` follow PRD
v0.3 §5: categories are required, items can have sizes and option groups,
food type, allergens and tags, an availability schedule (always, or set
days with All day or time windows in the restaurant's time zone, each for
chosen order types), and can be marked sold out, archived or deleted. No menu
API exists yet, so the pages show "Menu isn't connected yet". To try every
change against labelled sample data in development:

```bash
FOODI_MENU_DATA_SOURCE=preview npm run dev
```

Changes are simulated on the development server only ("Preview only, not
saved to Foodi") and reset when it restarts. Preview data is refused in
production builds. Details and the proposed API contract:
[docs/menu-ui.md](docs/menu-ui.md).

## Availability and hours

`/hours` (weekly hours per order type, All day, overnight windows, copy
helpers, pause and status) and `/hours/special-dates` (closed or special
hours on a date, for chosen order types) follow PRD v0.3 §3.3 with decisions
H2–H9, P-1 and P-2. The dashboard shows the pause banner and each order
type's status. No hours API exists yet, so these show "Hours aren't connected
yet". To try them against labelled sample data in development:

```bash
FOODI_HOURS_DATA_SOURCE=preview npm run dev
```

In preview, status is a labelled estimate, never live availability. Details,
the proposed API contract and open backend dependencies (H4, P-2):
[docs/hours-ui.md](docs/hours-ui.md).

## Meal periods and category schedules

`/menu/meal-periods` manages reusable meal periods, like Lunch: named weekly
times with no order types of their own. Items and categories can use them
(each choosing which of its order types do), set custom times, or stay always
available. Categories now have schedules too, and the item editor shows the
category's order-type limits and an advisory check against weekly
restaurant hours that never blocks saving. Meal periods are part of the menu,
so they use `FOODI_MENU_DATA_SOURCE` (add `FOODI_HOURS_DATA_SOURCE=preview`
for the hours check). Details, the schedule shapes and backend dependencies:
[docs/meal-periods-ui.md](docs/meal-periods-ui.md).

## Shared foundations and tests

Data-source rules, preview mode, shared components and naming are described in
[docs/foundations.md](docs/foundations.md).

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # Vitest unit and component tests
npm run test:e2e    # Playwright + axe, against a production build and a preview dev server
```

Brand logo: `public/brand/foodi-logo.png`.
