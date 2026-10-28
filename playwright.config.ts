import { defineConfig, devices } from "@playwright/test"

// Browser tests against two servers:
// - production: `next start` on a fresh `next build` (run by `npm run test:e2e`
//   before Playwright, so the build never overlaps the dev server) with no
//   data-source variables, to prove production never shows sample data;
// - preview: `next dev` with sample data enabled, for preview-mode screens.
// Unit and component tests run in Vitest (vitest.config.mts).

const PRODUCTION_PORT = 3100
const PREVIEW_PORT = 3101
/** Changes the preview restaurant hours; see the preview projects below. */
const HOURS_SPEC = "**/hours.spec.ts"

const viewports = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 820, height: 1180 },
  mobile: { width: 390, height: 844 },
}

const PREVIEW_ENV = {
  FOODI_ORDERS_DATA_SOURCE: "preview",
  FOODI_MENU_DATA_SOURCE: "preview",
  FOODI_RESTAURANT_DATA_SOURCE: "preview",
  FOODI_HOURS_DATA_SOURCE: "preview",
  FOODI_REVIEWS_DATA_SOURCE: "preview",
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  projects: [
    ...Object.entries(viewports).map(([name, viewport]) => ({
      name: `production-${name}`,
      testDir: "./tests/e2e/production",
      use: { baseURL: `http://localhost:${PRODUCTION_PORT}`, viewport },
    })),
    // Preview tests share one in-memory preview store, so the mobile run waits
    // for the desktop run instead of changing the same orders at the same time.
    // The menu tests also read restaurant hours (the B3b hours check), so the
    // tests that change hours run in their own step, never alongside them.
    // Every other preview file still runs in parallel.
    {
      name: "preview-desktop",
      testDir: "./tests/e2e/preview",
      testIgnore: HOURS_SPEC,
      use: { baseURL: `http://localhost:${PREVIEW_PORT}`, viewport: viewports.desktop },
    },
    {
      name: "preview-hours-desktop",
      testDir: "./tests/e2e/preview",
      testMatch: HOURS_SPEC,
      dependencies: ["preview-desktop"],
      use: { baseURL: `http://localhost:${PREVIEW_PORT}`, viewport: viewports.desktop },
    },
    {
      name: "preview-mobile",
      testDir: "./tests/e2e/preview",
      testIgnore: HOURS_SPEC,
      dependencies: ["preview-hours-desktop"],
      use: { baseURL: `http://localhost:${PREVIEW_PORT}`, viewport: viewports.mobile },
    },
    {
      name: "preview-hours-mobile",
      testDir: "./tests/e2e/preview",
      testMatch: HOURS_SPEC,
      dependencies: ["preview-mobile"],
      use: { baseURL: `http://localhost:${PREVIEW_PORT}`, viewport: viewports.mobile },
    },
  ],
  webServer: [
    {
      command: `npx next start -p ${PRODUCTION_PORT}`,
      url: `http://localhost:${PRODUCTION_PORT}/login`,
      timeout: 120_000,
      // Always start fresh servers: a leftover server can serve stale code.
      reuseExistingServer: false,
      // Make sure a developer's local preview variables can't leak in.
      env: {
        FOODI_ORDERS_DATA_SOURCE: "",
        FOODI_MENU_DATA_SOURCE: "",
        FOODI_RESTAURANT_DATA_SOURCE: "",
        FOODI_REVIEWS_DATA_SOURCE: "",
      },
    },
    {
      command: `npx next dev -p ${PREVIEW_PORT}`,
      url: `http://localhost:${PREVIEW_PORT}/login`,
      timeout: 180_000,
      // Always start fresh servers: a leftover server can serve stale code.
      reuseExistingServer: false,
      env: PREVIEW_ENV,
    },
  ],
})
