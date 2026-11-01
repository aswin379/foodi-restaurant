import path from "node:path"

import { defineConfig, devices } from "@playwright/test"

// Journeys against the REAL API, with no sample data and no mocks:
//   browser -> built site (port 3200) -> API (port 5100) -> throwaway database foodi_e2e.
// The API is forced onto foodi_e2e and never reads DB_NAME from server/.env. File storage (R2) is switched off
// so nothing is uploaded. Run:  npm run test:e2e:api
// `next build` runs first because NEXT_PUBLIC_API_URL is baked in at build time. It uses its own build folder
// (.next-e2e-api) so it never overwrites the build the other suites use.
const API_PORT = 5100
const SITE_PORT = 3200
const API_URL = `http://localhost:${API_PORT}`

const viewports = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 820, height: 1180 },
  mobile: { width: 390, height: 844 },
}

export default defineConfig({
  testDir: "./tests/e2e/api",
  // One seeded database that the tests change (sign in, sign out), so they run one at a time.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-api" }]],
  outputDir: "test-results-api",
  globalSetup: "./tests/e2e/api/global-setup.ts",
  use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${SITE_PORT}`, trace: "retain-on-failure" },
  projects: Object.entries(viewports).map(([name, viewport]) => ({
    name: `api-${name}`,
    use: { viewport },
  })),
  webServer: [
    {
      command: "npx tsx src/server.ts",
      cwd: path.resolve(process.cwd(), "../server"),
      url: `${API_URL}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: "development",
        PORT: String(API_PORT),
        DB_NAME: "foodi_e2e",
        CORS_ORIGINS: `http://localhost:${SITE_PORT}`,
        REDIS_URL: "",
        OTP_DUMMY_MODE: "false",
        LOG_LEVEL: "silent",
        R2_ACCOUNT_ID: "",
        R2_ACCESS_KEY_ID: "",
        R2_SECRET_ACCESS_KEY: "",
        R2_BUCKET: "",
        RATE_LIMIT_LOGIN_MAX: "1000",
        RATE_LIMIT_LOGIN_IP_MAX: "1000",
        RATE_LIMIT_REFRESH_MAX: "1000",
        RATE_LIMIT_FORGOT_MAX: "1000",
        RATE_LIMIT_FORGOT_IP_MAX: "1000",
        RATE_LIMIT_RESET_MAX: "1000",
        RATE_LIMIT_APPLY_IP_MAX: "1000",
        RATE_LIMIT_QR_IP_MAX: "1000",
      },
    },
    {
      // Build then serve. Data-source variables are blank so every module uses the real API.
      command: `npx next build && npx next start -p ${SITE_PORT}`,
      url: `http://localhost:${SITE_PORT}/login`,
      reuseExistingServer: false,
      timeout: 300_000,
      env: {
        NEXT_PUBLIC_API_URL: API_URL,
        NEXT_DIST_DIR: ".next-e2e-api",
        FOODI_ORDERS_DATA_SOURCE: "",
        FOODI_MENU_DATA_SOURCE: "",
        FOODI_RESTAURANT_DATA_SOURCE: "",
        FOODI_HOURS_DATA_SOURCE: "",
        FOODI_REVIEWS_DATA_SOURCE: "",
        FOODI_CUSTOMERS_DATA_SOURCE: "",
        FOODI_WALLET_DATA_SOURCE: "",
        FOODI_BILLING_DATA_SOURCE: "",
        FOODI_PROMOTIONS_DATA_SOURCE: "",
        FOODI_DESIGN_SYSTEM: "",
      },
    },
  ],
})

