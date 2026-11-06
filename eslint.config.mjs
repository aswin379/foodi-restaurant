import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // All browser HTTP goes through the shared client in src/api-client (see .claude/docs/api-client.md).
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["src/api-client/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "axios", message: 'Import the shared client from "@/lib/http" instead of axios.' }] },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Test output.
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
