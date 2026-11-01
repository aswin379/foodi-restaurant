import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The API journey (playwright.api.config.ts) builds into its own folder so it never overwrites the normal build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
