import { execFileSync } from "node:child_process"
import path from "node:path"

/** Fills the throwaway database with the restaurant owners the specs sign in as (see server/tests/e2e/seed-website.ts). */
export default function globalSetup() {
  execFileSync("npx", ["tsx", "tests/e2e/seed-website.ts"], {
    cwd: path.resolve(process.cwd(), "../server"),
    env: { ...process.env, DB_NAME: "foodi_e2e", REDIS_URL: "" },
    stdio: "inherit",
    shell: true,
  })
}
