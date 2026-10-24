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

Brand logo: `public/brand/foodi-logo.png`.
